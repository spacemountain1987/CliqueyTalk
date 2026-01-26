
'use client';

import { CreateChannelDialog } from "@/components/channel/create-channel-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ArrowRight, Lock, Waves, Loader2, Video, Mic, RefreshCw, Bot, TestTube2, Twitch } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { usePage } from "@/context/page-context";
import { useUser, useFirestore, useCollection, useMemoFirebase, useAuth, setDocumentNonBlocking, useDoc } from "@/firebase";
import { collection, query, doc, Timestamp, writeBatch, getDoc } from "firebase/firestore";
import type { WithId } from "@/firebase";
import { useRouter } from "next/navigation";
import { signInWithCustomToken, updateProfile } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { TwitchIcon } from '@/components/icons/twitch-icon';

async function fetchWithRetry(url: string, options: RequestInit, retries = 5, delay = 5000): Promise<Response> {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) {
                return response;
            }
            console.warn(`Attempt ${i + 1}/${retries} failed for ${url}. Status: ${response.status}`);
        } catch (error) {
            console.warn(`Attempt ${i + 1}/${retries} failed for ${url} with error:`, error);
        }
        if (i < retries - 1) {
            await new Promise(res => setTimeout(res, delay));
        }
    }
    throw new Error(`Failed to fetch ${url} after ${retries} attempts.`);
}


async function getDiscordUser() {
    const response = await fetchWithRetry('/api/discord/me', {
      cache: 'no-store',
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({} as any));
        throw new Error(err.error || 'Not authenticated with Discord.');
    }
    return response.json();
}

async function getDiscordMember(userId: string) {
    if (!userId) return null;
    const response = await fetch(`/api/discord/member?userId=${userId}`);
    if (!response.ok) {
        console.warn('Could not fetch Discord member data. User may not be in the guild or bot permissions are insufficient.');
        return null;
    }
    return response.json();
}

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const { setPageTitle, setHeaderActions, discordId, setDiscordId } = usePage();
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isProcessingLogin, setIsProcessingLogin] = useState(true);
  
  const firestoreQuery = useMemoFirebase(() => {
    // CRITICAL: Do not run the query until we have a discordId
    if (!firestore || !discordId) return null;
    return query(collection(firestore, 'voice_channels'));
  }, [firestore, discordId]);

  const { data: channels, isLoading: isLoadingChannels, refetch } = useCollection<any>(firestoreQuery);

  const banRef = useMemoFirebase(() => {
    if (!firestore || !discordId) return null;
    return doc(firestore, 'banned_users', discordId);
  }, [firestore, discordId]);

  const { data: banData, isLoading: isLoadingBan } = useDoc(banRef);

  useEffect(() => {
    if (!isLoadingBan && banData) {
        router.replace('/banned');
    }
  }, [banData, isLoadingBan, router]);


  const handleRefresh = useCallback(() => {
    if (refetch) {
      refetch();
      toast({
        title: "Dashboard Refreshed",
        description: "The list of channels has been updated.",
      });
    }
  }, [refetch, toast]);
  
  useEffect(() => {
    setPageTitle('Dashboard');
    
    const actions = (
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Force Refresh
        </Button>
        {user && <CreateChannelDialog />}
      </div>
    );

    if (!isUserLoading && user) {
      setHeaderActions(actions);
    } else {
      setHeaderActions(null);
    }

    return () => setHeaderActions(null);
  }, [setPageTitle, setHeaderActions, user, isUserLoading, handleRefresh]);
  
  useEffect(() => {
    const processLogin = async () => {
      if (!auth || !firestore) {
        toast({ variant: "destructive", title: "Login Error", description: "Firebase is not ready." });
        setIsProcessingLogin(false);
        return;
      }
      
      try {
        const discordUser = await getDiscordUser();

        // Ensure Firebase auth user is the Discord user (custom token login)
        let firebaseUser = auth.currentUser;
        if (!firebaseUser || firebaseUser.uid !== discordUser.id) {
          const tokenRes = await fetchWithRetry('/api/auth/firebase-token', { cache: 'no-store' });
          const tokenData = await tokenRes.json();
          if (!tokenRes.ok) {
            throw new Error(tokenData.error || 'Could not create Firebase session.');
          }
          const credential = await signInWithCustomToken(auth, tokenData.token);
          firebaseUser = credential.user;
        }

        const idTokenResult = await firebaseUser.getIdTokenResult().catch(() => null);
        const isAdminClaim = (idTokenResult?.claims as any)?.isAdmin === true;

        const guildRes = await fetchWithRetry('/api/discord/guild', {});
        const guildData = await guildRes.json();
        const guildId = guildData?.id;
        const guildOwnerId = guildData?.owner_id;

        if (!guildId) {
          throw new Error("Discord Guild ID could not be retrieved from the server.");
        }
        
        // Use the bot to fetch member data, not the user's token
        const discordMember = await getDiscordMember(discordUser.id);

        setDiscordId(discordUser.id);
        localStorage.setItem('discordUserId', discordUser.id);
        
        const displayName = discordMember?.nick || discordUser.global_name || discordUser.username;
        const profilePicture = discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
          : `https://cdn.discordapp.com/embed/avatars/${Number(discordUser.discriminator || 0) % 5}.png`;

        const userDiscordRoles = discordMember?.roles || [];
        const isGuildOwner = discordUser.id === guildOwnerId;
        // Trust server-issued claims for authorization; guild owner is informational.
        const isAdmin = isAdminClaim || isGuildOwner;

        const userRef = doc(firestore, "users", discordUser.id);
        // Firebase UID is the Discord ID (custom token login).
        
        const userProfileData = {
          id: discordUser.id,
          firebaseUid: firebaseUser.uid,
          username: displayName,
          email: discordUser.email || null,
          profilePicture: profilePicture,
          discordRoles: userDiscordRoles,
          isAdmin: isAdmin,
          isGloballyMuted: false,
          preferences: {},
          audioSettings: {
            inputDeviceId: 'default',
            outputDeviceId: 'default',
            inputVolume: 100,
            outputVolume: 100,
            isMuted: false,
          },
        };
        
        // Non-blocking writes for performance
        setDocumentNonBlocking(userRef, userProfileData, { merge: true });

        if (firebaseUser.displayName !== displayName || firebaseUser.photoURL !== profilePicture) {
            await updateProfile(firebaseUser, {
                displayName: displayName,
                photoURL: profilePicture
            });
        }
        
        router.replace('/dashboard', { scroll: false });

      } catch (error: any) {
        console.error("Failed to process Discord login:", error);
        toast({
            variant: "destructive",
            title: "Login Failed",
            description: error.message || "Could not complete sign-in with Discord.",
        });
        router.replace('/login');
      } finally {
        setIsProcessingLogin(false);
      }
    };

    // Attempt to bootstrap from server-side Discord session cookie.
    processLogin();

  }, [auth, firestore, toast, setDiscordId, router]);
  
  const isLoading = isUserLoading || isProcessingLogin || isLoadingBan;

  if (isLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary"/>
                <p className="text-muted-foreground">Authenticating & loading dashboard...</p>
            </div>
        </div>
      )
  }

  // Prevent rendering dashboard content if user is banned
  if (banData) return null;

  return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <div>
          {user ? (
            <>
              <h2 className="font-headline text-3xl font-bold">Welcome{user.displayName ? `, ${user.displayName}` : ''}!</h2>
              <p className="text-muted-foreground">
                Jump into a public channel or create your own.
              </p>
            </>
          ) : (
            <>
              <h2 className="font-headline text-3xl font-bold">Welcome!</h2>
              <p className="text-muted-foreground">
                Login to create your own channels and see your friends.
              </p>
            </>
          )}
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isLoadingChannels && discordId ? (
            [...Array(4)].map((_, i) => (
                <Card key={i}><CardHeader><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /></CardHeader><CardContent><Skeleton className="h-10 w-full" /></CardContent><CardFooter><Skeleton className="h-10 w-full" /></CardFooter></Card>
            ))
          ) : channels?.map((channel: WithId<any>) => (
            <Card key={channel.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-headline flex items-center gap-2">
                    {channel.type === 'video' ? <Video className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    {channel.name}
                  </CardTitle>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {channel.twitchChannel && <TwitchIcon className="h-4 w-4 text-primary" />}
                    {channel.privacy === 'private' && <Lock className="h-4 w-4" />}
                  </div>
                </div>
                <CardDescription className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>
                    {channel.participantIds?.length || 0} members online
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                 <div className="text-sm text-muted-foreground h-full">
                    {channel.description ? (
                      <p className="text-sm text-foreground italic">"{channel.description}"</p>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        {channel.privacy === 'private' ? (
                          <>
                            <Lock className="h-5 w-5 mr-2" />
                            <span>Invite only</span>
                          </>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                {channel.participantIds?.length > 0 ? `${channel.participantIds.length} members already here` : "No one's here yet. Be the first!"}
                            </p>
                        )}
                      </div>
                    )}
                 </div>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full">
                  <Link href={`/channels/${channel.id}`}>
                    Join Channel <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        { !isLoadingChannels && channels?.length === 0 && discordId && (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 py-24 text-center mt-6">
                <Mic className="h-16 w-16 text-muted-foreground/50" />
                <h2 className="mt-4 font-headline text-2xl font-semibold">No Channels Yet</h2>
                <p className="mt-2 text-muted-foreground">Be the first to create a new voice channel.</p>
                <div className='mt-6'>
                    <CreateChannelDialog />
                </div>
            </div>
        )}

        { !user && !isUserLoading && (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 py-24 text-center mt-6">
                <Mic className="h-16 w-16 text-muted-foreground/50" />
                <h2 className="mt-4 font-headline text-2xl font-semibold">Login to Get Started</h2>
                <p className="mt-2 text-muted-foreground">Login with Discord to see channels and create your own.</p>
                <Button asChild className="mt-6">
                    <Link href="/login">Login with Discord</Link>
                </Button>
            </div>
        )}
      </div>
  );
}
