'use client';

import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Card, CardContent } from '../ui/card';
import { Bed, Gamepad2, Headphones, Mic, MicOff, Volume2, VolumeX, Settings2, Video, VideoOff, LogIn, User as UserIcon, Settings, MoreVertical, Server, MonitorSpeaker, Loader2, Lock, Edit, AlertCircle, Volume, AlertTriangle, Check, Bot, TestTube2, Annoyed, Beaker, Music, Play, Pause, Layers, Twitch, ListMusic, SkipForward, Trash2, Plus, Waves, Upload, Youtube, StopCircle } from 'lucide-react';
import { Slider } from '../ui/slider';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { useUser, useFirestore, useStorage, useMemoFirebase } from '@/firebase/provider';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useCollection, type WithId } from '@/firebase/firestore/use-collection';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Skeleton } from '../ui/skeleton';
import { doc, getDoc, DocumentReference, collection, query, orderBy, limit, writeBatch, getDocs, serverTimestamp, addDoc, Unsubscribe } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { usePage } from '@/context/page-context';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';
import { EditChannelDialog } from './edit-channel-dialog';
import { useWebRTC } from '@/hooks/use-webrtc';
import { ScrollArea } from '../ui/scroll-area';
import { TwitchIcon } from '../icons/twitch-icon';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requestSongFromClient, playNextSong } from '@/lib/actions';
import { UploadSoundboardClipDialog } from './upload-soundboard-clip-dialog';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const uploadQueueSchema = z.object({
  name: z.string().min(2, 'Song name must be at least 2 characters long.').max(50, 'Song name must be 50 characters or less.'),
  audioFile: z.any()
    .refine((files): files is FileList => files?.length === 1, 'Audio file is required.')
    .refine((files) => files?.[0]?.size <= 10 * 1024 * 1024, `Max file size is 10MB.`)
    .refine(
      (files) => ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a'].includes(files?.[0]?.type),
      'Only .mp3, .wav, .ogg, or .m4a files are accepted.'
    ),
});
type UploadQueueFormValues = z.infer<typeof uploadQueueSchema>;


function AudioVisualizer({ stream, audioContext }: { stream: MediaStream | null, audioContext: AudioContext | null }) {
  const [level, setLevel] = useState(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    if (stream && stream.getAudioTracks().length > 0 && audioContext) {
      analyserRef.current = audioContext.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.3;

      try {
        sourceRef.current = audioContext.createMediaStreamSource(stream);
        sourceRef.current.connect(analyserRef.current);
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

        const draw = () => {
          if (analyserRef.current) {
            analyserRef.current.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((s, a) => s + a, 0) / dataArray.length;
            setLevel(average);
          }
          animationFrameRef.current = requestAnimationFrame(draw);
        };
        draw();
      } catch (error) {
        console.warn("Could not create media stream source for visualizer:", error);
      }

    } else {
      setLevel(0);
    }
    
    return () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        try {
            sourceRef.current?.disconnect();
        } catch(e) {
            // Can ignore if it's already disconnected
        }
    };
  }, [stream, audioContext]);

  return (
    <div className="w-full h-2 rounded-full bg-muted">
       <Progress value={level} className="h-2 transition-all" />
    </div>
  )
}


function CurrentUserCard({ user, isVideoChannel, channel, stream, mediaError, isSpeaking, onToggleAudioBot, audioContext, availableDevices }: { user: any, isVideoChannel?: boolean, channel: any, stream: MediaStream | null, mediaError: Error | null, isSpeaking: boolean, onToggleAudioBot: () => void, audioContext: AudioContext | null, availableDevices: {inputs: MediaDeviceInfo[], outputs: MediaDeviceInfo[]} }) {
  const [isSelfMuted, setIsSelfMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(isVideoChannel);
  const [usePushToTalk, setUsePushToTalk] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const PTT_KEY = '`';

  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitorVolume, setMonitorVolume] = useState(50);
  const localAudioRef = useRef<HTMLAudioElement>(null);


  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const firestore = useFirestore();
  const { discordId } = usePage();

  const [inputDeviceId, setInputDeviceId] = useState('default');
  const [outputDeviceId, setOutputDeviceId] = useState('default');
  const [inputVolume, setInputVolume] = useState(100);
  const [outputVolume, setOutputVolume] = useState(100);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  
  const {toast} = useToast();

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !discordId) return null;
    return doc(firestore, 'users', discordId);
  }, [firestore, discordId]);

  const { data: userProfile, isLoading: isLoadingProfile } = useDoc<any>(userProfileRef);

  const isGloballyMuted = userProfile?.isGloballyMuted === true;

  // Final mute state depends on self-mute, global mute, and PTT state
  const isMuted = isGloballyMuted || isSelfMuted || (usePushToTalk && !isTransmitting);

  const handleSaveAudioSettings = useCallback(async (settingsToSave: any) => {
      if (!userProfileRef) return;
      setIsSavingSettings(true);
      
      const currentSettings = userProfile?.audioSettings || {};
      updateDocumentNonBlocking(userProfileRef, { audioSettings: {...currentSettings, ...settingsToSave} });
      
      toast({
          title: "Settings Saved",
          description: "Your audio settings have been updated.",
      });

      setIsSavingSettings(false);
  }, [userProfileRef, toast, userProfile?.audioSettings]);

  const handleMuteToggle = () => {
    const newMuteState = !isSelfMuted;
    setIsSelfMuted(newMuteState);
    handleSaveAudioSettings({ isMuted: newMuteState });
  };

  const handlePttToggle = (checked: boolean) => {
    setUsePushToTalk(checked);
    handleSaveAudioSettings({ usePushToTalk: checked });
  }

  const handleSaveDevices = () => {
    handleSaveAudioSettings({ inputDeviceId, outputDeviceId });
  }

  // PTT logic
  useEffect(() => {
    if (!usePushToTalk) {
      return;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === PTT_KEY && !e.repeat) {
            setIsTransmitting(true);
        }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === PTT_KEY) {
            setIsTransmitting(false);
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [usePushToTalk]);


  useEffect(() => {
      if (userProfile?.audioSettings) {
          const { inputDeviceId, outputDeviceId, inputVolume, outputVolume, isMuted: savedMute, usePushToTalk: savedPtt } = userProfile.audioSettings;
          if (inputDeviceId) setInputDeviceId(inputDeviceId);
          if (outputDeviceId) setOutputDeviceId(outputDeviceId);
          if (inputVolume !== undefined) setInputVolume(inputVolume);
          if (outputVolume !== undefined) setOutputVolume(outputVolume);
          if (savedMute !== undefined) setIsSelfMuted(savedMute);
          if (savedPtt !== undefined) setUsePushToTalk(savedPtt);
      }
  }, [userProfile]);

  
  const displayName = user?.displayName || 'Anonymous';
  const avatarUrl = user?.photoURL || `https://cdn.discordapp.com/embed/avatars/${discordId ? Number(discordId.slice(-1)) % 5 : 0}.png`;
  const avatarFallback = displayName?.charAt(0) || '?';
  
  const isOwner = useMemo(() => {
    if (!discordId || !channel) return false;
    return channel.creatorId === discordId;
  }, [discordId, channel]);
  
  const isUserAdmin = userProfile?.isAdmin === true;
  const canManageChannel = useMemo(() => isOwner || isUserAdmin, [isOwner, isUserAdmin]);

  // Effect for stream assignment
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
    if (stream && localAudioRef.current) {
      localAudioRef.current.srcObject = stream;
    }
  }, [stream]);

  // Effect for monitoring controls (for voice card)
  useEffect(() => {
    if (localAudioRef.current) {
      localAudioRef.current.muted = !isMonitoring;
      localAudioRef.current.volume = monitorVolume / 100;
      if (isMonitoring) {
        localAudioRef.current.play().catch(e => console.error("Monitor audio play failed:", e));
      }
    }
  }, [isMonitoring, monitorVolume]);
  
    // Effect for setting output device for self-monitoring
  useEffect(() => {
    const audioEl = localAudioRef.current;
    // @ts-ignore
    if (audioEl && typeof audioEl.setSinkId === 'function') {
        // @ts-ignore
        audioEl.setSinkId(outputDeviceId).catch(e => console.error("Error setting sink ID for local monitor", e));
    }
  }, [outputDeviceId]);


   useEffect(() => {
    if (stream) {
      stream.getAudioTracks().forEach(track => (track.enabled = !isMuted));
      if (isVideoChannel) {
        stream.getVideoTracks().forEach(track => (track.enabled = isCameraOn));
      }
    }
  }, [isMuted, isCameraOn, stream, isVideoChannel]);

    const settingsContent = (
      <div className="flex flex-col max-h-[60vh]">
        <div className="p-4 border-b shrink-0">
            <h4 className="font-medium leading-none">Audio Settings</h4>
            <p className="text-sm text-muted-foreground mt-1">
                Manage your personal audio settings.
            </p>
        </div>
        <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
                <div className="space-y-4">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Personal Audio</Label>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                            <Label htmlFor="push-to-talk" className='flex items-center gap-2'><Annoyed className='h-4 w-4' />Push to Talk</Label>
                            <p className="text-xs text-muted-foreground">Mute your mic automatically.</p>
                        </div>
                        <Switch id="push-to-talk" checked={usePushToTalk} onCheckedChange={handlePttToggle} />
                    </div>
                    {usePushToTalk && (
                        <div className="text-xs text-center text-muted-foreground p-2 rounded-md bg-muted">
                            Hold ` to talk
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="input-device">Input Device</Label>
                        <Select value={inputDeviceId} onValueChange={setInputDeviceId}>
                            <SelectTrigger id="input-device" className="w-full">
                                <SelectValue placeholder="Select device" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableDevices.inputs.map(d => <SelectItem key={d.deviceId} value={d.deviceId}>{d.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <AudioVisualizer stream={stream} audioContext={audioContext} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="output-device">Output Device</Label>
                        <Select value={outputDeviceId} onValueChange={setOutputDeviceId}>
                            <SelectTrigger id="output-device" className="w-full">
                                <SelectValue placeholder="Select device" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableDevices.outputs.map(d => <SelectItem key={d.deviceId} value={d.deviceId}>{d.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handleSaveDevices} disabled={isSavingSettings} className="w-full">
                        {isSavingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                        Save Devices
                    </Button>
                     <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="monitor-switch" className="flex items-center gap-2"><Headphones className="h-4 w-4" /> Monitor Self</Label>
                            <Switch id="monitor-switch" checked={isMonitoring} onCheckedChange={setIsMonitoring} />
                        </div>
                        {isMonitoring && (
                            <Slider value={[monitorVolume]} onValueChange={(v) => setMonitorVolume(v[0])} max={100} step={1} />
                        )}
                    </div>
                </div>
            </div>
        </ScrollArea>
      </div>
    );

  if (isVideoChannel) {
    return (
      <Card className={cn("relative overflow-hidden border-2 shadow-lg aspect-video flex flex-col bg-muted transition-all", isSpeaking && !isMuted ? 'border-green-500' : 'border-primary' )}>
        <video ref={videoRef} className={cn("w-full h-full object-cover", !isCameraOn && "hidden")} autoPlay muted={!isMonitoring} playsInline />
        {(!isCameraOn || !stream) && !mediaError && (
            <div className="w-full h-full flex items-center justify-center">
                <Avatar className="h-24 w-24">
                    <AvatarImage src={avatarUrl} alt={displayName} />
                    <AvatarFallback>{avatarFallback}</AvatarFallback>
                </Avatar>
            </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-2">
          <div className="flex justify-between items-center">
            <p className="font-semibold text-white text-sm">{displayName} (You)</p>
            <div className="flex items-center gap-1">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={handleMuteToggle} disabled={isGloballyMuted} className={cn('h-8 w-8 text-white hover:bg-white/20', isMuted && 'bg-destructive/50 text-white')}>
                                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>{isMuted ? 'Unmute' : 'Mute'}</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => setIsCameraOn(!isCameraOn)} disabled={!stream || !!mediaError} className={cn('h-8 w-8 text-white hover:bg-white/20', !isCameraOn && 'bg-destructive/50 text-white')}>
                                {isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>{isCameraOn ? 'Turn off camera' : 'Turn on camera'}</p></TooltipContent>
                    </Tooltip>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20">
                            <Settings className="h-5 w-5" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0" side="top" align="end">
                         {settingsContent}
                      </PopoverContent>
                    </Popover>
                </TooltipProvider>
            </div>
          </div>
           {canManageChannel && (
                <div className="mt-2 pt-2 border-t border-white/20 flex items-center gap-2">
                    <Label className="text-xs text-white/70">ADMIN:</Label>
                    <EditChannelDialog channel={channel}>
                        <Button variant="outline" size="sm" className="h-7 bg-transparent border-white/50 text-white hover:bg-white/20 hover:text-white">
                            <Server className="mr-1 h-3 w-3" /> Channel
                        </Button>
                    </EditChannelDialog>
                    <Button variant="outline" size="sm" className="h-7 bg-transparent border-white/50 text-white hover:bg-white/20 hover:text-white" onClick={onToggleAudioBot}>
                        <Music className="mr-1 h-3 w-3" /> Audio Bot
                    </Button>
                </div>
            )}
        </div>
        {mediaError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4">
                <Alert variant="destructive" className="max-w-sm">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Camera Error</AlertTitle>
                    <AlertDescription>
                        Could not start video source. Another app or browser tab might be using the camera. Please check your system settings.
                    </AlertDescription>
                </Alert>
            </div>
        )}
      </Card>
    )
  }

  return (
    <Card className="relative overflow-hidden border-2 border-primary shadow-lg">
      <audio ref={localAudioRef} autoPlay playsInline />
      <CardContent className="p-4 text-center">
        <Avatar className={cn("mx-auto h-20 w-20 border-4 border-background ring-2 ring-primary transition-all", isSpeaking && !isMuted && "ring-green-500")}>
          <AvatarImage src={avatarUrl} alt={displayName} />
          <AvatarFallback>{avatarFallback}</AvatarFallback>
        </Avatar>
        <h3 className="mt-3 font-semibold">{displayName} (You)</h3>
        <div className='h-6 my-1 flex items-center justify-center'>
            <AudioVisualizer stream={stream} audioContext={audioContext} />
        </div>
        
        <div className="mt-2 flex items-center justify-center gap-2">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={handleMuteToggle} disabled={isGloballyMuted} className={cn('h-8 w-8', isMuted && 'bg-destructive/20 text-destructive')}>
                            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{isMuted ? 'Unmute' : 'Mute'}</p>
                    </TooltipContent>
                </Tooltip>
                
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8">
                            <Headphones className="h-5 w-5" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" side="top" align="center">
                       {settingsContent}
                    </PopoverContent>
                </Popover>
            </TooltipProvider>
        </div>

        {canManageChannel && (
            <>
                <Separator className="my-4" />
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground tracking-wider">ADMIN CONTROLS</Label>
                    <div className="flex flex-wrap gap-2 justify-center">
                        <EditChannelDialog channel={channel}>
                            <Button variant="outline" size="sm"><Server className="mr-2 h-4 w-4" /> Channel</Button>
                        </EditChannelDialog>
                        <Button variant="outline" size="sm" onClick={onToggleAudioBot}><Music className="mr-2 h-4 w-4" /> Audio Bot</Button>
                    </div>
                </div>
            </>
        )}

      </CardContent>
       {mediaError && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 p-4">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Mic Error</AlertTitle>
                    <AlertDescription>
                       Could not access your microphone. Please check browser permissions.
                    </AlertDescription>
                </Alert>
            </div>
        )}
         {isGloballyMuted && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 p-4">
                <Alert variant="destructive">
                    <MicOff className="h-4 w-4" />
                    <AlertTitle>You are muted</AlertTitle>
                    <AlertDescription>
                       An admin has globally muted you.
                    </AlertDescription>
                </Alert>
            </div>
        )}
    </Card>
  );
}


function UserCard({ user, isVideoChannel, stream, mediaError, isSpeaking, audioContext, outputDeviceId }: { user: any, isVideoChannel?: boolean, stream: MediaStream | null, mediaError: Error | null, isSpeaking: boolean, audioContext: AudioContext | null, outputDeviceId: string }) {
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const displayName = user?.username || '...';
  const avatarUrl = user?.profilePicture;
  const avatarFallback = displayName.charAt(0).toUpperCase();
  
  useEffect(() => {
    if (stream && videoRef.current) {
        videoRef.current.srcObject = stream;
    }
    if (stream && audioRef.current) {
        audioRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted, stream])
  
  useEffect(() => {
    const audioEl = audioRef.current;
    // @ts-ignore
    if (audioEl && outputDeviceId && typeof audioEl.setSinkId === 'function') {
        // @ts-ignore
        audioEl.setSinkId(outputDeviceId).catch(e => console.error(`Error setting sinkId for user ${user?.id}`, e));
    }
  }, [outputDeviceId, audioRef, user?.id]);

  if (isVideoChannel) {
    return (
      <Card className={cn("relative overflow-hidden border-2 transition-all hover:border-primary hover:shadow-lg aspect-video flex flex-col bg-muted", isSpeaking ? 'border-green-500' : 'border-transparent')}>
        <video ref={videoRef} className={cn("w-full h-full object-cover", (!stream || mediaError) && "hidden")} autoPlay playsInline />
         {(!stream || mediaError) && (
            <div className="w-full h-full flex items-center justify-center flex-col gap-2">
                <Avatar className="h-24 w-24">
                    <AvatarImage src={avatarUrl} alt={displayName} />
                    <AvatarFallback>{avatarFallback}</AvatarFallback>
                </Avatar>
                {mediaError && (
                    <Alert variant="destructive" className="w-auto">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Media Error</AlertTitle>
                    </Alert>
                )}
            </div>
         )}
        <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-2">
          <p className="font-semibold text-white text-sm truncate">{displayName}</p>
        </div>
      </Card>
    );
  }


  return (
    <Card className="relative overflow-hidden border-2 border-transparent transition-all hover:border-primary hover:shadow-lg">
      <CardContent className="p-4 text-center">
         {stream && <audio ref={audioRef} autoPlay playsInline />}
        <Avatar className={cn("mx-auto h-20 w-20 border-4 border-background ring-2 ring-muted transition-all", isSpeaking && "ring-green-500")}>
          <AvatarImage src={avatarUrl} alt={displayName} />
          <AvatarFallback>{avatarFallback}</AvatarFallback>
        </Avatar>
        <h3 className="mt-3 font-semibold">{displayName}</h3>
        <div className='h-6 my-1 flex items-center justify-center'>
            {mediaError ? (
                <p className="text-xs text-destructive">Stream Error</p>
            ) : (
                <AudioVisualizer stream={stream} audioContext={audioContext} />
            )}
        </div>
        
        <div className="mt-2 flex items-center gap-2">
            <button onClick={() => setIsMuted(!isMuted)}>
                {isMuted || volume === 0 ? <VolumeX className="h-5 w-5 text-muted-foreground" /> : <Volume className="h-5 w-5 text-muted-foreground" />}
            </button>
            <Slider
              value={[isMuted ? 0 : volume]}
              onValueChange={(value) => {
                  setVolume(value[0]);
                  if (value[0] > 0 && isMuted) {
                      setIsMuted(false);
                  }
              }}
              max={100}
              step={1}
            />
        </div>
      </CardContent>
    </Card>
  );
}

function AudioBotCard({ channel, isVideoChannel, isController, audioContext, outputDeviceId, availableDevices }: { channel: any, isVideoChannel?: boolean, isController: boolean, audioContext: AudioContext | null, outputDeviceId: string, availableDevices: {outputs: MediaDeviceInfo[]} }) {
    const firestore = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();
    const { discordId } = usePage();
    const { user: currentUser } = useUser();
    const [songRequestInput, setSongRequestInput] = useState('');
    const [isRequesting, setIsRequesting] = useState(false);
    const [botVolume, setBotVolume] = useState(50);
    const [botOutputDeviceId, setBotOutputDeviceId] = useState(outputDeviceId || 'default');
    
    const { register, handleSubmit, formState: { errors, isSubmitting: isUploading }, reset } = useForm<UploadQueueFormValues>({
        resolver: zodResolver(uploadQueueSchema),
    });
    
    const audioBotStateRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'app_settings', 'audio_bot_state');
    }, [firestore]);
    const { data: audioBotState } = useDoc<any>(audioBotStateRef);

    const queueQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'music_queue'), orderBy('addedAt', 'asc'));
    }, [firestore]);
    const { data: songQueue } = useCollection<any>(queueQuery);

    const soundboardQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'soundboard_clips'), orderBy('createdAt', 'desc'));
    }, [firestore]);
    const { data: soundboardClips } = useCollection<any>(soundboardQuery);
    
    const ephemeralStateRef = useMemoFirebase(() => {
        if (!firestore || !channel?.id) return null;
        return doc(firestore, `voice_channels/${channel.id}/ephemeral_state/soundboard`);
    }, [firestore, channel?.id]);
    const { data: soundboardState } = useDoc<any>(soundboardState);

    const audioPlayerRef = useRef<HTMLAudioElement>(null);
    const soundboardPlayerRef = useRef<HTMLAudioElement>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [audioStreamForViz, setAudioStreamForViz] = useState<MediaStream | null>(null);
    const [isClipPlaying, setIsClipPlaying] = useState(false);
    
    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !discordId) return null;
        return doc(firestore, 'users', discordId);
    }, [firestore, discordId]);
    const { data: userProfile } = useDoc<any>(userProfileRef);

    useEffect(() => {
        if (userProfile?.preferences?.botOutputDeviceId) {
            setBotOutputDeviceId(userProfile.preferences.botOutputDeviceId);
        } else {
            setBotOutputDeviceId(outputDeviceId || 'default');
        }
    }, [userProfile, outputDeviceId]);

    const handleBotOutputDeviceChange = (deviceId: string) => {
        setBotOutputDeviceId(deviceId);
        if (userProfileRef) {
            updateDocumentNonBlocking(userProfileRef, {
                'preferences.botOutputDeviceId': deviceId,
            });
            toast({
                title: 'Bot Audio Output Saved',
                description: 'The bot will now play through the selected device.',
            });
        }
    };
    
    const playNextInQueue = useCallback(async () => {
        if (isController) {
            playNextSong();
        }
    }, [isController]);

    const handleStop = () => {
        if (!audioBotStateRef || !isController) return;
        setDocumentNonBlocking(audioBotStateRef, {
            currentSongVideoId: null,
            currentSongStoragePath: null,
            currentSongTitle: null,
            requestedBy: null,
            status: 'stopped'
        }, { merge: true });
        if (audioPlayerRef.current) {
            audioPlayerRef.current.pause();
            audioPlayerRef.current.src = '';
        }
    }

    const handlePlayPause = () => {
        const audioEl = audioPlayerRef.current;
        if (!audioEl || !isController) return;

        if (audioEl.paused) {
            if (audioEl.src) {
                audioEl.play().catch(e => console.error("Manual play failed:", e));
            } else if (songQueue && songQueue.length > 0) {
                playNextInQueue(); // Start playing from queue if nothing is loaded
            }
        } else {
            audioEl.pause();
        }
    }

    const handleUiSongRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!songRequestInput || !discordId || !currentUser?.displayName || !isController) return;

        setIsRequesting(true);
        try {
            const result = await requestSongFromClient(songRequestInput, discordId, currentUser.displayName);

            if (result.success) {
                toast({ title: "Request Sent", description: "Your request has been added to the queue." });
                setSongRequestInput('');
            } else {
                toast({ variant: 'destructive', title: "Request Failed", description: result.message });
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message || "An unknown error occurred." });
        }
        setIsRequesting(false);
    };

    const onUploadSubmit: SubmitHandler<UploadQueueFormValues> = async (data) => {
        if (!discordId || !firestore || !currentUser?.displayName) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to upload.' });
            return;
        }

        try {
            const file = data.audioFile[0];

            const formData = new FormData();
            formData.append('file', file);
            formData.append('destination', 'queued-songs');

            const uploadResponse = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!uploadResponse.ok) {
                let errorMessage = 'Upload failed.';
                try {
                    const errorData = await uploadResponse.json();
                    errorMessage = errorData.error || `Server responded with status ${uploadResponse.status}`;
                } catch (jsonError) {
                    const rawText = await uploadResponse.text().catch(() => "Could not read server response.");
                    errorMessage = `Server responded with status ${uploadResponse.status}. Response: ${rawText}`;
                }
                throw new Error(errorMessage);
            }
    
            const { storagePath } = await uploadResponse.json();

            const songData = {
                storagePath,
                title: data.name,
                requestedBy: currentUser.displayName,
                requesterId: discordId,
                addedAt: serverTimestamp(),
            };
            
            const queueCollection = collection(firestore, 'music_queue');
            await addDoc(queueCollection, songData);

            toast({ title: 'Song Uploaded', description: `"${data.name}" has been added to the queue.` });
            reset();

            const botStateSnap = await getDoc(audioBotStateRef);
            if (!botStateSnap.exists() || botStateSnap.data()?.status === 'stopped') {
                playNextInQueue();
            }

        } catch (error: any) {
            console.error("Error uploading queue song:", error);
            toast({ variant: 'destructive', title: 'Upload Failed', description: error.message || 'An unexpected error occurred.' });
        }
    };


    const handlePlayClip = useCallback(async (clip: WithId<any>) => {
        if (!isController || !ephemeralStateRef) {
            if (!isController) toast({ variant: 'destructive', title: 'Only the channel creator can play soundboard clips.' });
            return;
        }
        // Controller triggers playback for everyone by updating Firestore
        setDocumentNonBlocking(ephemeralStateRef, {
            storagePath: clip.storagePath,
            timestamp: serverTimestamp(),
        }, {merge: true});

    }, [isController, ephemeralStateRef, toast]);
    
    // This effect runs on ALL clients to play soundboard clips
    useEffect(() => {
        const fiveSecondsAgo = Date.now() - 5000;
        if (soundboardState && soundboardState.timestamp?.toMillis() > fiveSecondsAgo) {
            if (!storage || !soundboardPlayerRef.current) return;
            
            setIsClipPlaying(true);
            const wasMusicPlaying = audioPlayerRef.current && !audioPlayerRef.current.paused;
            if (wasMusicPlaying) {
                audioPlayerRef.current?.pause();
            }

            const play = async () => {
                try {
                    const clipRef = ref(storage, soundboardState.storagePath);
                    const url = await getDownloadURL(clipRef);
                    soundboardPlayerRef.current!.src = url;
                    soundboardPlayerRef.current!.play();
                } catch (error) {
                    console.error("Error playing sound clip:", error);
                    setIsClipPlaying(false);
                }
            }
            play();
            
            const onEnded = () => {
                setIsClipPlaying(false);
                if (wasMusicPlaying) {
                    audioPlayerRef.current?.play();
                }
            };
            soundboardPlayerRef.current.addEventListener('ended', onEnded, { once: true });
        }
    }, [soundboardState, storage]);


    const handleRemoveFromQueue = (songId: string) => {
        if (!firestore || !isController) return;
        const songRef = doc(firestore, 'music_queue', songId);
        deleteDocumentNonBlocking(songRef);
        toast({ title: "Song Removed", description: "The song has been removed from the queue." });
    };
    
    // This effect runs on ALL clients to play music from the queue
    useEffect(() => {
        const audioEl = audioPlayerRef.current;
        if (!audioEl) return;
    
        const newSongVideoId = audioBotState?.currentSongVideoId;
        const newSongStoragePath = audioBotState?.currentSongStoragePath;
    
        let audioUrl = '';
        if (newSongVideoId) {
            audioUrl = `/api/youtube/audio?videoId=${newSongVideoId}`;
        } else if (newSongStoragePath) {
            audioUrl = `/api/storage/audio?path=${encodeURIComponent(newSongStoragePath)}`;
        }
    
        const currentFullSrc = audioEl.currentSrc;
        const isSrcSet = currentFullSrc && audioUrl && currentFullSrc.endsWith(audioUrl);
    
        if (audioUrl) {
            if (!isSrcSet) {
                audioEl.src = audioUrl;
                audioEl.crossOrigin = 'anonymous';
                audioEl.load();
                audioEl.play().catch(e => { 
                     // This error is common and expected as browsers block autoplay.
                     // The user must interact to start playback if it fails.
                     console.warn("Auto-play was blocked. User interaction may be required.");
                });
            }
        } else {
            audioEl.src = '';
            setIsPlaying(false);
        }
    }, [audioBotState?.currentSongVideoId, audioBotState?.currentSongStoragePath]);

  
    useEffect(() => {
        const audioEl = audioPlayerRef.current;
        if (!audioEl || !audioContext) return;
        
        const handlePlay = () => {
            setIsPlaying(true);
            if (!audioStreamForViz) {
                try {
                    const source = audioContext.createMediaElementSource(audioEl);
                    const dest = audioContext.createMediaStreamDestination();
                    source.connect(dest);
                    setAudioStreamForViz(dest.stream);
                } catch(e) {
                    console.error("Failed to create media element source for visualizer:", e);
                }
            }
        };
        
        const handlePause = () => setIsPlaying(false);

        const handleEnded = () => {
            setIsPlaying(false);
            playNextInQueue();
        };
        
        const handleLoadError = (e: Event) => {
            toast({
                title: "Audio Playback Error",
                description: `Format error or stream not found. Trying next song.`,
                variant: 'destructive'
            });
            handleEnded();
        };

        audioEl.addEventListener('play', handlePlay);
        audioEl.addEventListener('pause', handlePause);
        audioEl.addEventListener('ended', handleEnded);
        audioEl.addEventListener('error', handleLoadError);
        
        return () => {
            audioEl.removeEventListener('play', handlePlay);
            audioEl.removeEventListener('pause', handlePause);
            audioEl.removeEventListener('ended', handleEnded);
            audioEl.removeEventListener('error', handleLoadError);
        }
    }, [toast, audioContext, audioStreamForViz, playNextInQueue]);


    const handleClearQueue = async () => {
        if (!firestore || !isController) return;
        const queueRef = collection(firestore, 'music_queue');
        const queueSnapshot = await getDocs(queueRef);
        const batch = writeBatch(firestore);
        queueSnapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        toast({ title: "Queue Cleared", description: "All songs have been removed from the queue."});
    }

    useEffect(() => {
        if (audioPlayerRef.current) {
            audioPlayerRef.current.volume = botVolume / 100;
        }
        if (soundboardPlayerRef.current) {
            soundboardPlayerRef.current.volume = botVolume / 100;
        }
    }, [botVolume]);
    
    useEffect(() => {
        const players = [audioPlayerRef.current, soundboardPlayerRef.current];
        players.forEach(player => {
             // @ts-ignore
            if (player && botOutputDeviceId && typeof player.setSinkId === 'function') {
                 // @ts-ignore
                player.setSinkId(botOutputDeviceId).catch(e => console.error("Error setting sinkId for audio bot", e));
            }
        });
    }, [botOutputDeviceId]);

    const displayName = 'CliqueyTalk Bot';
  
    const botControls = (
      <Tabs defaultValue="queue" className="w-full">
          {isController ? (
              <TabsList className="grid w-full grid-cols-5 h-9">
                  <TabsTrigger value="youtube" className="text-xs"><Youtube className="mr-1 h-3.5 w-3.5"/>YouTube</TabsTrigger>
                  <TabsTrigger value="upload" className="text-xs"><Upload className="mr-1 h-3.5 w-3.5"/>Upload</TabsTrigger>
                  <TabsTrigger value="queue" className="text-xs"><ListMusic className="mr-1 h-3.5 w-3.5"/>Queue</TabsTrigger>
                  <TabsTrigger value="soundboard" className="text-xs"><Waves className="mr-1 h-3.5 w-3.5"/>Board</TabsTrigger>
                  <TabsTrigger value="debug" className="text-xs"><Beaker className="mr-1 h-3.5 w-3.5"/>Debug</TabsTrigger>
              </TabsList>
          ) : (
               <TabsList className="grid w-full grid-cols-1 h-9">
                  <TabsTrigger value="queue" className="text-xs"><ListMusic className="mr-1 h-3.5 w-3.5"/>Queue</TabsTrigger>
              </TabsList>
          )}
          
          {isController && (
              <>
                  <TabsContent value="youtube" className="mt-2">
                      <form onSubmit={handleUiSongRequest} className="space-y-2">
                          <Input
                              placeholder="Song name or YouTube URL"
                              value={songRequestInput}
                              onChange={(e) => setSongRequestInput(e.target.value)}
                              disabled={isRequesting}
                          />
                          <Button type="submit" className="w-full h-8" disabled={isRequesting || !songRequestInput}>
                              {isRequesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                              Add to Queue
                          </Button>
                      </form>
                  </TabsContent>
                  <TabsContent value="upload" className="mt-2">
                       <form onSubmit={handleSubmit(onUploadSubmit)} className="space-y-2">
                          <div>
                              <Label htmlFor="name" className="sr-only">Song Name</Label>
                              <Input id="name" placeholder="Song Name" {...register('name')} />
                              {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
                          </div>
                           <div>
                              <Label htmlFor="audioFile" className="sr-only">Audio File</Label>
                              <Input id="audioFile" type="file" accept="audio/mpeg,audio/wav,audio/ogg,audio/mp3,audio/mp4,audio/x-m4a,.m4a" {...register('audioFile')} />
                              {errors.audioFile && <p className="text-sm text-destructive mt-1">{errors.audioFile.message}</p>}
                          </div>
                          <Button type="submit" className="w-full h-8" disabled={isUploading}>
                              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                              Upload to Queue
                          </Button>
                      </form>
                  </TabsContent>
                  <TabsContent value="soundboard" className="mt-2">
                      <div className="space-y-2">
                          <UploadSoundboardClipDialog />
                          <ScrollArea className="h-32 w-full rounded-md border">
                              <div className="p-2 grid grid-cols-2 gap-2">
                              {soundboardClips && soundboardClips.length > 0 ? (
                                  soundboardClips.map(clip => (
                                      <Button key={clip.id} variant="secondary" onClick={() => handlePlayClip(clip)} disabled={isClipPlaying}>
                                          {clip.name}
                                      </Button>
                                  ))
                              ) : (
                                  <p className="col-span-2 text-center text-xs text-muted-foreground p-4">No soundboard clips yet. Upload one!</p>
                              )}
                              </div>
                          </ScrollArea>
                      </div>
                  </TabsContent>
                  <TabsContent value="debug" className="mt-2 space-y-2">
                      <Alert variant="default" className="text-left w-full">
                          <Bot className="h-4 w-4" />
                          <AlertTitle className="text-xs font-semibold">How this works</AlertTitle>
                          <AlertDescription className="text-xs">
                             Each user plays the bot audio locally, synced via Firestore. Only the channel creator has controls.
                          </AlertDescription>
                      </Alert>
                      <div>
                          <Label className="text-xs text-muted-foreground">Live Bot State</Label>
                          <pre className="mt-1 text-xs p-2 bg-muted rounded-md overflow-x-auto">
                              {JSON.stringify(audioBotState, null, 2) || 'Loading state...'}
                          </pre>
                      </div>
                  </TabsContent>
              </>
          )}

          <TabsContent value="queue" className="mt-2">
              <div className="space-y-2">
                  {isController && (
                      <div className="flex items-center gap-2">
                           <Button variant="destructive" size="sm" className="h-8 flex-1" onClick={handleClearQueue} disabled={!songQueue || songQueue.length === 0}>
                              <Trash2 className="mr-2 h-4 w-4"/> Clear
                          </Button>
                      </div>
                  )}
                  <ScrollArea className={cn("w-full rounded-md border", isController ? "h-32" : "h-48")}>
                      <div className="p-2 text-left">
                      {songQueue && songQueue.length > 0 ? (
                          songQueue.map(song => (
                              <div key={song.id} className="text-sm p-1.5 border-b border-border/50 flex items-center justify-between group">
                                  <div>
                                      <p className="font-medium truncate flex items-center gap-1.5">
                                          {song.storagePath ? <Upload className="h-3 w-3" /> : <Youtube className="h-3 w-3" />}
                                          {song.title}
                                      </p>
                                      <p className="text-xs text-muted-foreground">Requested by {song.requestedBy}</p>
                                  </div>
                                  {isController && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => handleRemoveFromQueue(song.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  )}
                              </div>
                          ))
                      ) : (
                          <p className="text-center text-xs text-muted-foreground p-4">The queue is empty.</p>
                      )}
                      </div>
                  </ScrollArea>
              </div>
          </TabsContent>
      </Tabs>
    );

    return (
        <Card className="relative overflow-hidden border-2 border-transparent transition-all hover:border-primary hover:shadow-lg">
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-foreground">
                        <Settings className="h-4 w-4" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="end">
                    <div className="space-y-2">
                        <Label htmlFor="bot-output-device">Bot Audio Output</Label>
                        <Select value={botOutputDeviceId} onValueChange={handleBotOutputDeviceChange}>
                            <SelectTrigger id="bot-output-device">
                                <SelectValue placeholder="Select device" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableDevices.outputs.map(d => <SelectItem key={d.deviceId} value={d.deviceId}>{d.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Choose where bot audio plays.</p>
                    </div>
                </PopoverContent>
            </Popover>
            <audio ref={audioPlayerRef} className="hidden" />
            <audio ref={soundboardPlayerRef} className="hidden" />
            <CardContent className="p-4 text-center">
                <Avatar className={cn("mx-auto h-20 w-20 border-4 border-background ring-2 ring-muted transition-all", isPlaying && "ring-green-500")}>
                <AvatarFallback><Music /></AvatarFallback>
                </Avatar>
                <h3 className="mt-3 font-semibold">{displayName}</h3>
                <div className='h-6 my-1 flex items-center justify-center'>
                    <AudioVisualizer stream={audioStreamForViz} audioContext={audioContext} />
                </div>
                <p className="text-xs text-muted-foreground mt-2 truncate h-4">{audioBotState?.currentSongTitle || 'Soundboard & Song Requests'}</p>
                
                <div className="flex items-center justify-center gap-2 mt-2">
                    <TooltipProvider>
                        {isController && (
                            <>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePlayPause}>
                                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{isPlaying ? 'Pause' : 'Play'}</p></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleStop}>
                                        <StopCircle className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Stop</p></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={playNextInQueue}>
                                        <SkipForward className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Skip</p></TooltipContent>
                            </Tooltip>
                            </>
                        )}
                    </TooltipProvider>
                </div>
                <div className="flex items-center gap-2 mt-2">
                    <Volume className="h-4 w-4 text-muted-foreground" />
                    <Slider
                        value={[botVolume]}
                        onValueChange={(v) => setBotVolume(v[0])}
                        max={100}
                        step={1}
                    />
                </div>
                
                <div className="mt-4">
                    {botControls}
                </div>
            </CardContent>
        </Card>
    )
}

function OtherUserCard({ userId, isVideoChannel, stream, mediaError, isSpeaking, audioContext, outputDeviceId }: { userId: string, isVideoChannel?: boolean, stream: MediaStream | null, mediaError: Error | null, isSpeaking: boolean, audioContext: AudioContext | null, outputDeviceId: string }) {
    const firestore = useFirestore();
    const userRef = useMemoFirebase(() => {
        if (!firestore || !userId) return null;
        return doc(firestore, 'users', userId);
    }, [firestore, userId]);
    
    const { data: user, isLoading } = useDoc<any>(userRef);

    if (isLoading) {
        return <Skeleton className="aspect-[3/4] rounded-lg" />;
    }

    if (!user) {
        return null;
    }

    return <UserCard user={user} isVideoChannel={isVideoChannel} stream={stream} mediaError={mediaError} isSpeaking={isSpeaking} audioContext={audioContext} outputDeviceId={outputDeviceId} />;
}


export function VoiceChannel({ channel, onJoin }: { channel: any, onJoin: (password?: string) => Promise<boolean> }) {
  const { user: currentUser, isUserLoading } = useUser();
  const { discordId, setDiscordId } = usePage();
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [showAudioBot, setShowAudioBot] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<{inputs: MediaDeviceInfo[], outputs: MediaDeviceInfo[]}>({inputs: [], outputs: []});

  const isUserInChannel = discordId ? channel?.participantIds?.includes(discordId) : false;
  const isVideoChannel = channel?.type === 'video';
  const isController = channel.creatorId === discordId;
  
  const firestore = useFirestore();
  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !discordId) return null;
    return doc(firestore, 'users', discordId);
  }, [firestore, discordId]);

  const { data: userProfile } = useDoc<any>(userProfileRef);
  const outputDeviceId = userProfile?.audioSettings?.outputDeviceId || 'default';

  const audioBotStateRef = useMemoFirebase(() => {
      if (!firestore) return null;
      return doc(firestore, 'app_settings', 'audio_bot_state');
  }, [firestore]);
  const { data: audioBotState } = useDoc<any>(audioBotStateRef);
  const isSongQueued = !!audioBotState?.currentSongVideoId || !!audioBotState?.currentSongStoragePath;
  
  useEffect(() => {
    const getDevices = async () => {
      try {
        // We only enumerate devices. The useWebRTC hook is responsible for requesting media permissions.
        // Once permission is granted by the user for that hook, this will return the full list of devices.
        if (!navigator.mediaDevices?.enumerateDevices) {
          console.warn("enumerateDevices() not supported.");
          return;
        }
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter(d => d.kind === 'audioinput');
        const outputs = devices.filter(d => d.kind === 'audiooutput');
        setAvailableDevices({ inputs, outputs });
      } catch (error) {
        console.warn("Could not enumerate media devices:", error);
      }
    };
    
    if (isUserInChannel) {
        getDevices();
        // Also listen for changes
        navigator.mediaDevices.addEventListener('devicechange', getDevices);
    }
    
    return () => {
        if (isUserInChannel) {
            navigator.mediaDevices.removeEventListener('devicechange', getDevices);
        }
    }
  }, [isUserInChannel]);
  
  const { 
      localStream, 
      remoteStreams, 
      mediaError, 
      remoteMediaErrors, 
      isSpeaking, 
      remoteSpeakingStatus,
    } = useWebRTC(channel.id, isVideoChannel, isUserInChannel, userProfileRef, null, audioContext);
  
  useEffect(() => {
    const twitchChannelName = channel?.twitchChannel;
    let intervalId: NodeJS.Timeout | null = null;
    
    const joinTwitch = async () => {
        if (twitchChannelName && isUserInChannel) {
            try {
                const res = await fetch('/api/twitch/bot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ channel: twitchChannelName }),
                });
                if (!res.ok) {
                    throw new Error(`Failed to join Twitch channel: ${res.statusText}`);
                }
            } catch (error) {
                console.warn("Failed to connect to Twitch bot:", error);
            }
        }
    };
    
    if (twitchChannelName && isUserInChannel) {
        joinTwitch(); // Initial attempt
        intervalId = setInterval(joinTwitch, 30000); // Retry every 30 seconds
    }
    
    return () => {
        if (intervalId) {
            clearInterval(intervalId);
        }
    };
}, [channel?.twitchChannel, isUserInChannel]);

  if (!channel) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-destructive/50 py-24 text-center m-4 md:m-6">
          <Mic className="h-16 w-16 text-destructive/50" />
          <h2 className="mt-4 font-headline text-2xl font-semibold">Channel Not Found</h2>
          <p className="mt-2 text-muted-foreground">This channel may have been deleted or you don't have permission to view it.</p>
      </div>
    )
  }

  const otherUserIds = channel.participantIds?.filter((id: string) => id !== discordId) || [];
  
  const gridCols = isVideoChannel 
    ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
  
  const handleJoinClick = () => {
    // Lazy-initialize AudioContext on user interaction
    if (!audioContext) {
        try {
            setAudioContext(new (window.AudioContext || (window as any).webkitAudioContext)());
        } catch (e) {
            console.error("AudioContext not supported by this browser.");
        }
    }
    onJoin();
  }

  const handleToggleAudioBot = () => {
    setShowAudioBot(prev => !prev);
  }

  return (
    <div className="p-4 md:p-6">
       {isUserLoading && !isUserInChannel ? (
        <div className={cn("grid gap-4", gridCols)}>
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-lg" />)}
        </div>
      ) : isUserInChannel && currentUser ? (
        <div className={cn("grid gap-4", gridCols)}>
          <CurrentUserCard 
            user={currentUser} 
            isVideoChannel={isVideoChannel} 
            channel={channel} 
            stream={localStream} 
            mediaError={mediaError} 
            isSpeaking={isSpeaking}
            onToggleAudioBot={handleToggleAudioBot}
            audioContext={audioContext}
            availableDevices={availableDevices}
          />
          {otherUserIds.map((userId: string) => (
            <OtherUserCard 
                key={userId} 
                userId={userId} 
                isVideoChannel={isVideoChannel} 
                stream={remoteStreams[userId]} 
                mediaError={remoteMediaErrors[userId]}
                isSpeaking={remoteSpeakingStatus[userId] || false}
                audioContext={audioContext}
                outputDeviceId={outputDeviceId}
            />
          ))}
          {(showAudioBot || isSongQueued) && (
            <AudioBotCard 
                channel={channel}
                isVideoChannel={isVideoChannel}
                isController={isController}
                audioContext={audioContext}
                outputDeviceId={outputDeviceId}
                availableDevices={availableDevices}
            />
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 py-24 text-center">
            {isVideoChannel ? <Video className="h-16 w-16 text-muted-foreground/50" /> : <Mic className="h-16 w-16 text-muted-foreground/50" />}
            <h2 className="mt-4 font-headline text-2xl font-semibold">You are not in this channel</h2>
            <p className="mt-2 text-muted-foreground">Join the channel to see participants and start talking.</p>
            <Button onClick={handleJoinClick} className="mt-6">
                <LogIn className="mr-2 h-4 w-4" />
                Join Channel
            </Button>
        </div>
      )}
    </div>
  );
}
