'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  Unsubscribe,
  addDoc,
  query,
  where,
  DocumentReference,
  serverTimestamp,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { usePage } from '@/context/page-context';

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

const SPEAKING_THRESHOLD = 5;
const SPEAKING_DELAY_FRAMES = 2;
const SILENCE_DELAY_FRAMES = 20;

const audioConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
};

export function useWebRTC(
  channelId: string | null,
  isVideo: boolean,
  isUserInChannel: boolean,
  userProfileRef: DocumentReference | null,
  botAudioTrack: MediaStreamTrack | null,
  audioContext: AudioContext | null,
) {
  const firestore = useFirestore();
  const { discordId } = usePage();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  const peerSenders = useRef<Record<string, {audio?: RTCRtpSender, video?: RTCRtpSender}>>({});
  const [mediaError, setMediaError] = useState<Error | null>(null);
  const [remoteMediaErrors, setRemoteMediaErrors] = useState<Record<string, Error>>({});
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [remoteSpeakingStatus, setRemoteSpeakingStatus] = useState<Record<string, boolean>>({});

  const localAudioAnalysers = useRef<{ analyser: AnalyserNode, source: MediaStreamAudioSourceNode } | null>(null);
  const remoteAudioAnalysers = useRef<Record<string, { analyser: AnalyserNode, source: MediaStreamAudioSourceNode }>>({});
  const animationFrameId = useRef<number>();
  
  const speakingCounters = useRef<Record<string, number>>({});
  const silenceCounters = useRef<Record<string, number>>({});

  // 1. Core Cleanup Logic
  const cleanupPeerConnection = useCallback((peerId: string) => {
    if (peerConnections.current[peerId]) {
      peerConnections.current[peerId].close();
      delete peerConnections.current[peerId];
    }
    delete peerSenders.current[peerId];
    setRemoteStreams(prev => {
      const newStreams = { ...prev };
      delete newStreams[peerId];
      return newStreams;
    });
    setRemoteMediaErrors(prev => {
        const newErrors = {...prev};
        delete newErrors[peerId];
        return newErrors;
    });
     setRemoteSpeakingStatus(prev => {
      const newStatus = { ...prev };
      delete newStatus[peerId];
      return newStatus;
    });
    if (remoteAudioAnalysers.current[peerId]) {
        try {
            remoteAudioAnalysers.current[peerId].source.disconnect();
        } catch (e) {}
        delete remoteAudioAnalysers.current[peerId];
    }
    delete speakingCounters.current[peerId];
    delete silenceCounters.current[peerId];
  }, []);

  // 2. Get User Media
  useEffect(() => {
    if (!isUserInChannel) {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
      return;
    }

    let didCancel = false;
    let userMediaStream: MediaStream | null = null;

    const setupStream = async () => {
      try {
        userMediaStream = await navigator.mediaDevices.getUserMedia({
          video: isVideo,
          audio: audioConstraints,
        });

        if (didCancel) {
            userMediaStream.getTracks().forEach(track => track.stop());
            return;
        }
        
        setLocalStream(userMediaStream);
        setMediaError(null);

      } catch (error) {
        console.error('Error setting up local stream.', error);
        setMediaError(error instanceof Error ? error : new Error('Unknown media error.'));
      }
    };

    setupStream();

    return () => {
      didCancel = true;
      userMediaStream?.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    };
  }, [isUserInChannel, isVideo]);

  // 3. Update 'isSpeaking' status in Firestore
  useEffect(() => {
    if (!userProfileRef || !isUserInChannel) return;
    
    setDocumentNonBlocking(userProfileRef, { isSpeaking: isSpeaking }, { merge: true });
    
    return () => {
      if (userProfileRef) {
        setDocumentNonBlocking(userProfileRef, { isSpeaking: false }, { merge: true });
      }
    }
  }, [isSpeaking, userProfileRef, isUserInChannel]);
  
  // 4. Speaking Detection Logic
  useEffect(() => {
    if (!isUserInChannel || !audioContext) {
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        return;
    };
    
    const context = audioContext;

    const setupAnalyser = (stream: MediaStream, id: string, isLocal: boolean) => {
        if (stream.getAudioTracks().length === 0) return;
        
        const existingAnalyser = isLocal ? localAudioAnalysers.current : remoteAudioAnalysers.current[id];
        if (existingAnalyser) return;

        try {
            const source = context.createMediaStreamSource(stream);
            const analyser = context.createAnalyser();
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.5;
            source.connect(analyser);

            if (isLocal) {
                localAudioAnalysers.current = { source, analyser };
            } else {
                remoteAudioAnalysers.current[id] = { source, analyser };
            }
            speakingCounters.current[id] = 0;
            silenceCounters.current[id] = 0;
        } catch (e) {
            console.error(`Error setting up analyser for ${id}:`, e);
        }
    };
    
    if (localStream) setupAnalyser(localStream, 'local', true);
    Object.entries(remoteStreams).forEach(([peerId, stream]) => {
      setupAnalyser(stream, peerId, false);
    });

    const checkSpeaking = () => {
        let hasChanged = false;
        const newRemoteStatus: Record<string, boolean> = { ...remoteSpeakingStatus };
        let localSpeaking = isSpeaking;

        const checkId = (id: string, analyser: AnalyserNode) => {
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((s, v) => s + v, 0) / dataArray.length;

            let currentSpeakingState = (id === 'local' ? localSpeaking : newRemoteStatus[id]) || false;
            
            if (average > SPEAKING_THRESHOLD) {
                speakingCounters.current[id] = (speakingCounters.current[id] || 0) + 1;
                silenceCounters.current[id] = 0;
                if (speakingCounters.current[id] >= SPEAKING_DELAY_FRAMES && !currentSpeakingState) {
                    currentSpeakingState = true;
                    hasChanged = true;
                }
            } else {
                silenceCounters.current[id] = (silenceCounters.current[id] || 0) + 1;
                speakingCounters.current[id] = 0;
                if (silenceCounters.current[id] >= SILENCE_DELAY_FRAMES && currentSpeakingState) {
                    currentSpeakingState = false;
                    hasChanged = true;
                }
            }

            if (id === 'local') localSpeaking = currentSpeakingState;
            else newRemoteStatus[id] = currentSpeakingState;
        };

        if (localAudioAnalysers.current) checkId('local', localAudioAnalysers.current.analyser);
        Object.entries(remoteAudioAnalysers.current).forEach(([peerId, { analyser }]) => {
            checkId(peerId, analyser);
        });

        if (hasChanged) {
            if (localSpeaking !== isSpeaking) setIsSpeaking(localSpeaking);
            setRemoteSpeakingStatus(newRemoteStatus);
        }
        
        animationFrameId.current = requestAnimationFrame(checkSpeaking);
    };

    if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    animationFrameId.current = requestAnimationFrame(checkSpeaking);
    
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      if (localAudioAnalysers.current) {
          try { localAudioAnalysers.current.source.disconnect(); } catch(e) {}
          localAudioAnalysers.current = null;
      }
      Object.values(remoteAudioAnalysers.current).forEach(({ source }) => {
          try { source.disconnect(); } catch(e) {}
      });
      remoteAudioAnalysers.current = {};
    };
  }, [localStream, remoteStreams, isUserInChannel, isSpeaking, remoteSpeakingStatus, audioContext]);

  // 5. Update Peer Connection Tracks on Stream Change
  useEffect(() => {
    if (!isUserInChannel) return;

    const newAudioTrack = localStream?.getAudioTracks()[0] || null;
    const newVideoTrack = localStream?.getVideoTracks()[0] || null;
    
    Object.values(peerSenders.current).forEach(senders => {
        senders.audio?.replaceTrack(newAudioTrack);
        senders.video?.replaceTrack(newVideoTrack);
    });

  }, [localStream, isUserInChannel]);
  
  // 6. Main WebRTC Signaling Effect
  useEffect(() => {
    if (!isUserInChannel || !localStream || !firestore || !discordId || !channelId) {
      return; 
    }

    const channelRef = doc(firestore, 'voice_channels', channelId);
    let participantUnsub: Unsubscribe | null = null;
    const peerUnsubscribers: Record<string, Unsubscribe[]> = {};

    const createPeerConnection = (peerId: string) => {
        if (peerConnections.current[peerId] || peerId === discordId) {
            return;
        }
        
        console.log(`[${discordId}] Creating peer connection to: ${peerId}`);
        
        try {
            const pc = new RTCPeerConnection(servers);
            peerConnections.current[peerId] = pc;
            peerUnsubscribers[peerId] = [];
            peerSenders.current[peerId] = {};

            // Add user's own audio/video tracks
            localStream.getTracks().forEach(track => {
                const sender = pc.addTrack(track, localStream);
                if (track.kind === 'audio') peerSenders.current[peerId].audio = sender;
                if (track.kind === 'video') peerSenders.current[peerId].video = sender;
            });

            pc.ontrack = (event) => {
                setRemoteStreams(prev => ({ ...prev, [peerId]: event.streams[0] }));
                setRemoteMediaErrors(prev => {
                    const newErrors = {...prev};
                    delete newErrors[peerId];
                    return newErrors;
                });
            };

            pc.oniceconnectionstatechange = () => {
                if (['failed', 'disconnected', 'closed'].includes(pc.iceConnectionState)) {
                    console.warn(`[${discordId}] ICE connection to ${peerId} failed or disconnected.`);
                    setRemoteMediaErrors(prev => ({...prev, [peerId]: new Error("Connection failed")}))
                    if (pc.iceConnectionState === 'failed') {
                        // pc.restartIce(); // This can be aggressive, handle reconnection more gracefully
                    }
                }
            };
            
            const localPeerDocRef = doc(firestore, 'voice_channels', channelId, 'peers', discordId);
            const remotePeerDocRef = doc(firestore, 'voice_channels', channelId, 'peers', peerId);
            
            const localIceCandidatesCol = collection(localPeerDocRef, 'iceCandidates');
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    addDoc(localIceCandidatesCol, { ...event.candidate.toJSON(), targetId: peerId });
                }
            };

            const remoteIceCandidatesCol = collection(remotePeerDocRef, 'iceCandidates');
            const iceUnsub = onSnapshot(query(remoteIceCandidatesCol, where('targetId', '==', discordId)), snapshot => {
                snapshot.docChanges().forEach(async change => {
                    if (change.type === 'added' && pc.signalingState !== 'closed') {
                        try {
                            await pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
                            // Don't delete here, let the sender clean up their own candidates maybe? or use TTL
                        } catch (e) {
                             console.error(`[${discordId}] Error adding received ICE candidate from ${peerId}:`, e);
                        }
                    }
                });
            });
            peerUnsubscribers[peerId].push(iceUnsub);

            const offersCol = collection(remotePeerDocRef, 'offers');
            const offerUnsub = onSnapshot(query(offersCol, where('targetId', '==', discordId)), async snapshot => {
                for (const docChange of snapshot.docChanges()) {
                    if (docChange.type === 'added' && pc.signalingState === 'stable') {
                        const offer = docChange.doc.data();
                        if (offer.sdp) {
                            await pc.setRemoteDescription(new RTCSessionDescription(offer.sdp));
                            
                            const answer = await pc.createAnswer();
                            await pc.setLocalDescription(answer);

                            if (pc.localDescription) {
                                await addDoc(collection(localPeerDocRef, 'answers'), { sdp: pc.localDescription.toJSON(), targetId: peerId });
                            }
                            await deleteDoc(docChange.doc.ref); // Clean up the offer
                        }
                    }
                }
            });
            peerUnsubscribers[peerId].push(offerUnsub);

            const answersCol = collection(remotePeerDocRef, 'answers');
            const answerUnsub = onSnapshot(query(answersCol, where('targetId', '==', discordId)), async snapshot => {
                 for (const docChange of snapshot.docChanges()) {
                    if (docChange.type === 'added' && pc.signalingState === 'have-local-offer') {
                       const answer = docChange.doc.data();
                        if (answer.sdp) {
                           await pc.setRemoteDescription(new RTCSessionDescription(answer.sdp));
                           await deleteDoc(docChange.doc.ref); // Clean up the answer
                        }
                    }
                }
            });
            peerUnsubscribers[peerId].push(answerUnsub);
            
            // Decide who initiates the offer
            if (discordId > peerId) {
                console.log(`[${discordId}] Initiating offer to ${peerId}`);
                pc.createOffer()
                  .then(offer => pc.setLocalDescription(offer))
                  .then(() => {
                      if (pc.localDescription) {
                        addDoc(collection(localPeerDocRef, 'offers'), { sdp: pc.localDescription.toJSON(), targetId: peerId });
                      }
                  })
                  .catch(e => console.error(`[${discordId}] Error creating offer for ${peerId}:`, e));
            }
        } catch (e) {
            console.error(`[${discordId}] Failed to create peer connection for ${peerId}:`, e);
        }
    };

    participantUnsub = onSnapshot(channelRef, (channelSnap) => {
        if (!channelSnap.exists()) return;
        
        const remotePeers = (channelSnap.data().participantIds || []).filter((id: string) => id !== discordId);
        const existingPeers = Object.keys(peerConnections.current);
        
        const newPeers = remotePeers.filter((id: string) => !existingPeers.includes(id));
        newPeers.forEach((peerId: string) => createPeerConnection(peerId));

        const removedPeers = existingPeers.filter((id: string) => !remotePeers.includes(id));
        removedPeers.forEach((peerId: string) => {
            if (peerUnsubscribers[peerId]) {
                peerUnsubscribers[peerId].forEach((unsub: () => void) => unsub());
                delete peerUnsubscribers[peerId];
            }
            cleanupPeerConnection(peerId);
        });
    });

    const localPeerDocRef = doc(firestore, 'voice_channels', channelId, 'peers', discordId);
    setDoc(localPeerDocRef, {id: discordId, lastSeen: serverTimestamp()}, {merge: true});

    return () => {
        console.log(`[${discordId}] Main signaling effect cleaning up...`);
        if (participantUnsub) participantUnsub();
        
        Object.keys(peerConnections.current).forEach(peerId => {
            if (peerUnsubscribers[peerId]) {
                peerUnsubscribers[peerId].forEach(unsub => unsub());
                delete peerUnsubscribers[peerId];
            }
            cleanupPeerConnection(peerId);
        });

        // Asynchronous cleanup of Firestore data
        (async () => {
            if (firestore && discordId && channelId) {
                console.log(`[${discordId}] Cleaning up Firestore signaling data for self.`);
                try {
                    const peerDocRef = doc(firestore, 'voice_channels', channelId, 'peers', discordId);
                    const batch = writeBatch(firestore);
                    // More robustly, query for docs to delete instead of assuming refs
                    const [offersSnap, answersSnap, candidatesSnap] = await Promise.all([
                        getDocs(collection(peerDocRef, 'offers')),
                        getDocs(collection(peerDocRef, 'answers')),
                        getDocs(collection(peerDocRef, 'iceCandidates'))
                    ]);
                    
                    offersSnap.forEach(d => batch.delete(d.ref));
                    answersSnap.forEach(d => batch.delete(d.ref));
                    candidatesSnap.forEach(d => batch.delete(d.ref));
                    
                    // Also clean up candidates pointed at this user from others
                    // This is more complex and might be better handled by a TTL policy in Firestore
                    
                    batch.delete(peerDocRef); // Finally remove the peer document itself
                    
                    await batch.commit();
                    console.log(`[${discordId}] Self cleanup successful.`);
                } catch (error) {
                     console.error("Error during self-cleanup of Firestore signaling data:", error);
                }
            }
        })();
    };
}, [isUserInChannel, localStream, firestore, discordId, channelId, cleanupPeerConnection]);


  return { localStream, remoteStreams, mediaError, remoteMediaErrors, isSpeaking, remoteSpeakingStatus };
}
