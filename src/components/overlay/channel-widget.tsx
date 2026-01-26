
'use client';

import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { cn } from '@/lib/utils';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { ScrollArea } from '../ui/scroll-area';
import { doc } from 'firebase/firestore';

function WidgetUserRow({ userId }: { userId: string }) {
  const { firestore } = useFirebase();
  
  const userRef = useMemoFirebase(() => {
    if (!firestore || !userId) return null;
    return doc(firestore, 'users', userId);
  }, [firestore, userId]);
  
  const { data: user, isLoading } = useDoc<any>(userRef);

  if (isLoading || !user) {
    return null; // Or a skeleton loader
  }
  
  const isSpeaking = user.isSpeaking === true;

  return (
    <div className={cn(
        "flex items-center gap-3 p-2 rounded-md transition-all duration-200 text-white",
        isSpeaking ? "bg-green-500/30" : "bg-black/30"
    )}>
      <Avatar className={cn(
          "h-9 w-9 ring-2 ring-offset-2 ring-offset-transparent",
           isSpeaking ? "ring-green-400" : "ring-gray-500"
      )}>
        <AvatarImage src={user.profilePicture} alt={user.username} />
        <AvatarFallback>{user.username.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 overflow-hidden">
        <p className="truncate font-semibold">{user.username}</p>
      </div>
    </div>
  );
}


export function ChannelWidget({ channel }: { channel: any }) {
    const userIds = channel.participantIds || [];

    return (
        <div className="flex h-full w-full flex-col font-body text-foreground bg-transparent p-2">
            <ScrollArea className="flex-1">
                <div className="space-y-2">
                    {userIds.map((userId: string) => (
                        <WidgetUserRow key={userId} userId={userId} />
                    ))}
                     {userIds.length === 0 && (
                         <p className="text-center text-sm text-white/70 p-4">Channel is empty.</p>
                     )}
                </div>
            </ScrollArea>
        </div>
    );
}

    