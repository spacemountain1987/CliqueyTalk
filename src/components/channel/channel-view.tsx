
'use client';

import { VoiceChannel } from '@/components/channel/voice-channel';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { usePage } from '@/context/page-context';
import { useFirebase, useUser, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { Loader2, LogOut, Trash2, Lock } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useCallback, useState, useMemo } from 'react';
import { doc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

function PasswordPrompt({ onJoin, channel }: { onJoin: (password: string) => Promise<boolean>, channel: any }) {
    const [password, setPassword] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsJoining(true);
        const success = await onJoin(password);
        if (!success) {
            setError('Incorrect password. Please try again.');
        }
        setIsJoining(false);
    };

    return (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 py-24 text-center">
            <Lock className="h-16 w-16 text-muted-foreground/50" />
            <h2 className="mt-4 font-headline text-2xl font-semibold">Private Channel</h2>
            <p className="mt-2 text-muted-foreground">This channel requires a password to join.</p>
            <form onSubmit={handleSubmit} className="mt-6 flex w-full max-w-sm flex-col gap-3">
                 <div className="w-full text-left">
                    <Label htmlFor="password">Password</Label>
                    <Input 
                        id="password" 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter channel password" 
                        className="text-center"
                    />
                 </div>
                 {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" disabled={isJoining}>
                    {isJoining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Join Channel
                </Button>
            </form>
        </div>
    );
}


export function ChannelView({ channel, user, userProfile, isUserInChannel, canManageChannel, channelRef, discordId, id }: any) {
    const { setHeaderActions, addNotification, setShowSidebar } = usePage();
    const router = useRouter();
    const { toast } = useToast();
    const [isClosing, setIsClosing] = useState(false);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const searchParams = useSearchParams();
    const isCompact = searchParams.get('layout') === 'compact';


    const handleJoinChannel = useCallback(async (password?: string): Promise<boolean> => {
        if (!channelRef || !discordId || !channel) return false;
    
        if (userProfile?.isAdmin && channel.privacy === 'private' && !isUserInChannel) {
            // No password check needed for admins
        } else if (channel.privacy === 'private' && !isUserInChannel) {
            if (channel.password !== password) {
                toast({
                    variant: "destructive",
                    title: "Incorrect Password",
                    description: "The password you entered is incorrect.",
                });
                return false;
            }
        }
    
        updateDocumentNonBlocking(channelRef, {
            participantIds: arrayUnion(discordId),
        });
        return true;
      }, [channelRef, discordId, channel, userProfile?.isAdmin, isUserInChannel, toast]);
    
    
      const handleLeaveChannel = useCallback(async () => {
        if (!channelRef || !discordId) return;
        updateDocumentNonBlocking(channelRef, {
          participantIds: arrayRemove(discordId),
        });
        router.push('/dashboard');
      }, [channelRef, discordId, router]);
    
      const handleCloseChannel = async () => {
        if (!id || !canManageChannel || !channelRef) return;
        setIsClosing(true);
        deleteDocumentNonBlocking(channelRef);
        addNotification({
            title: "Channel Closed",
            description: `You closed the channel "${channel.name}".`
        });
        router.push('/dashboard');
        setIsClosing(false);
        setShowCloseConfirm(false);
      };

    useEffect(() => {
        if (isCompact) {
          setShowSidebar(false);
          return;
        }
        if (isUserInChannel) {
          setShowSidebar(false);
        } else {
          setShowSidebar(true);
        }
    
        return () => {
          setShowSidebar(true);
        };
      }, [isUserInChannel, setShowSidebar, isCompact]);
    
      useEffect(() => {
        if (isCompact) {
          setHeaderActions(null);
          return;
        }
        if (channel) {
          setHeaderActions(
            <div className="flex items-center gap-2">
              {isUserInChannel && (
                <Button variant="outline" size="sm" onClick={handleLeaveChannel}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Leave Channel
                </Button>
              )}
              {canManageChannel && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowCloseConfirm(true)}
                  disabled={isClosing}
                >
                  {isClosing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Close Channel
                </Button>
              )}
            </div>
          );
        }
        return () => setHeaderActions(null);
      }, [setHeaderActions, id, channel, isUserInChannel, canManageChannel, isClosing, handleLeaveChannel, isCompact]);

    const showPasswordPrompt = channel?.privacy === 'private' && !isUserInChannel && !userProfile?.isAdmin;

    return (
        <>
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
                {showPasswordPrompt ? (
                    <PasswordPrompt onJoin={handleJoinChannel} channel={channel} />
                ) : (
                    <VoiceChannel channel={channel} onJoin={handleJoinChannel} />
                )}
            </div>
            <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently close the channel.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCloseChannel} disabled={isClosing}>
                            {isClosing ? 'Closing...' : 'Confirm'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
