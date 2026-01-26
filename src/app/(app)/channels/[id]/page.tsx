
'use client';

import { usePage } from '@/context/page-context';
import { useDoc, useFirebase, useUser, useMemoFirebase } from '@/firebase';
import { Loader2 } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useCallback } from 'react';
import { doc } from 'firebase/firestore';
import { ChannelView } from '@/components/channel/channel-view';

export default function ChannelPage() {
  const { setPageTitle, setShowSidebar } = usePage();
  const params = useParams();
  const { firestore } = useFirebase();
  const { user, isUserLoading } = useUser();
  const searchParams = useSearchParams();

  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const discordId = user?.id;

  const channelRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'voice_channels', id);
  }, [firestore, id]);

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !discordId) return null;
    return doc(firestore, 'users', discordId);
  }, [firestore, discordId]);

  const { data: channel, isLoading: isLoadingChannel } = useDoc<any>(channelRef);
  const { data: userProfile, isLoading: isLoadingProfile } = useDoc<any>(userProfileRef);

  const isUserInChannel = useMemo(() => {
    if (!discordId || !channel) return false;
    return channel.participantIds?.includes(discordId);
  }, [discordId, channel]);

  const isOwner = useMemo(() => {
    if (!discordId || !channel) return false;
    return channel.creatorId === discordId;
  }, [discordId, channel]);

  const isUserAdmin = userProfile?.isAdmin === true;
  const canManageChannel = useMemo(() => isOwner || isUserAdmin, [isOwner, isUserAdmin]);
  
  const isLoading = isUserLoading || isLoadingProfile || isLoadingChannel;
  
  const isCompact = searchParams.get('layout') === 'compact';

  useEffect(() => {
    if (isCompact) {
        setShowSidebar(false);
        setPageTitle('Compact View');
        return;
    }

    if (channel) {
      setPageTitle(channel.name);
    } else if (!isLoading) {
      setPageTitle('Channel Not Found');
    } else {
      setPageTitle('Loading Channel...');
    }

    return () => {
        setShowSidebar(true);
    }
  }, [channel, isLoading, setPageTitle, isCompact, setShowSidebar]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }
  
  if (!channel) {
    return (
        <div className="flex flex-col items-center justify-center h-full">
          <h2 className="text-2xl font-semibold">Channel Not Found</h2>
          <p className="text-muted-foreground">This channel may have been closed or never existed.</p>
        </div>
    )
  }

  return (
    <ChannelView 
        channel={channel} 
        user={user} 
        userProfile={userProfile} 
        isUserInChannel={isUserInChannel} 
        canManageChannel={canManageChannel} 
        channelRef={channelRef}
        discordId={discordId}
        id={id}
    />
  );
}
