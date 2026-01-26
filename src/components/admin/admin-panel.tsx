
'use client';

import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Ban, XCircle, Mic, Lock, Video, Axe, DoorClosed, MoveRight, Loader2, Check, ShieldCheck, Trash2, ShieldX, Eraser, VolumeX, MicOff, UserPlus, Server, AlertTriangle, MessageSquare, Radio as RadioIcon, Music, Plus, ListMusic, KeyRound, TestTube2, Upload, RefreshCw, Copy } from 'lucide-react';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { useCollection, useFirestore, useMemoFirebase, useDoc, useUser, setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, arrayRemove, arrayUnion, writeBatch, Timestamp, serverTimestamp, getDoc } from 'firebase/firestore';
import type { WithId } from '@/firebase';
import { Skeleton } from '../ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { usePage } from '@/context/page-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import React, { useEffect, useState, useCallback } from 'react';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { TwitchIcon } from '../icons/twitch-icon';
import { cn } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { Textarea } from '../ui/textarea';


// --- Ban Manager Component ---
function BanManager() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { addNotification } = usePage();
    const [banId, setBanId] = useState('');
    const [isBanning, setIsBanning] = useState(false);

    const bannedUsersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'banned_users') : null, [firestore]);
    const { data: bannedUsers, isLoading: isLoadingBans, refetch: refetchBans } = useCollection<any>(bannedUsersQuery);

    const handleBanUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !banId) return;

        setIsBanning(true);
        const userToBanRef = doc(firestore, 'users', banId);
        const banDocRef = doc(firestore, 'banned_users', banId);

        try {
            const userDoc = await getDoc(userToBanRef);
            if (!userDoc.exists()) {
                toast({ variant: 'destructive', title: 'User not found', description: 'No user exists with that ID.'});
                return;
            }

            const userData = userDoc.data();
            const banData = {
                userId: banId,
                username: userData.username,
                bannedAt: serverTimestamp(),
                reason: "Banned via admin panel"
            };
            
            setDocumentNonBlocking(banDocRef, banData, {});
            
            addNotification({
                title: "User Banned",
                description: `${userData.username} has been banned from the application.`
            });
            setBanId('');
            refetchBans?.();
        } catch (error) {
             toast({ variant: 'destructive', title: 'Error', description: 'Could not ban user.'});
        } finally {
            setIsBanning(false);
        }
    };
    
    const handleUnbanUser = (userId: string, username: string) => {
        if(!firestore) return;
        const banDocRef = doc(firestore, 'banned_users', userId);
        deleteDocumentNonBlocking(banDocRef);
        addNotification({ title: 'User Unbanned', description: `${username} (${userId}) has been unbanned.`});
        refetchBans?.();
    }

    return (
         <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline"><Axe className="h-6 w-6"/> Ban Management</CardTitle>
                <CardDescription>Ban users by their Discord ID. Banned users will be unable to access the application.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleBanUser} className="flex items-center gap-2">
                    <Input 
                        placeholder="Enter Discord User ID to ban" 
                        value={banId}
                        onChange={(e) => setBanId(e.target.value)}
                    />
                    <Button type="submit" disabled={isBanning || !banId}>
                        {isBanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Ban className="mr-2 h-4 w-4" />}
                        Ban
                    </Button>
                </form>

                <div className="mt-4 space-y-2">
                    <h4 className="font-medium text-sm">Banned Users</h4>
                     <div className="max-h-40 overflow-y-auto rounded-md border">
                        {isLoadingBans ? (
                             [...Array(2)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
                        ) : bannedUsers && bannedUsers.length > 0 ? (
                            bannedUsers.map(user => (
                                <div key={user.id} className="flex items-center justify-between p-2 border-b">
                                    <div>
                                        <p className="font-medium">{user.username}</p>
                                        <p className="text-xs text-muted-foreground">{user.id}</p>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => handleUnbanUser(user.id, user.username)}>
                                        <Eraser className="mr-2 h-4 w-4" /> Unban
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <p className="p-4 text-center text-sm text-muted-foreground">No users are banned.</p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

function SettingsManager() {
    const [allChannels, setAllChannels] = useState<any[]>([]);
    const [isLoadingChannels, setIsLoadingChannels] = useState(true);
    const [selectedAnnounceChannel, setSelectedAnnounceChannel] = useState<string | undefined>();
    const [selectedMusicChannel, setSelectedMusicChannel] = useState<string | undefined>();
    const [isSaving, setIsSaving] = useState(false);

    const firestore = useFirestore();
    const { toast } = useToast();
    const { discordId } = usePage();

    const announcementChannelRef = useMemoFirebase(() => firestore ? doc(firestore, 'app_settings', 'announcement_channel') : null, [firestore]);
    const musicBotChannelRef = useMemoFirebase(() => firestore ? doc(firestore, 'app_settings', 'music_bot_channel') : null, [firestore]);

    const { data: savedAnnounceChannel, isLoading: isLoadingAnnounce } = useDoc<any>(announcementChannelRef);
    const { data: savedMusicChannel, isLoading: isLoadingMusic } = useDoc<any>(musicBotChannelRef);

    useEffect(() => {
        if (savedAnnounceChannel?.channelId) setSelectedAnnounceChannel(savedAnnounceChannel.channelId);
        if (savedMusicChannel?.channelId) setSelectedMusicChannel(savedMusicChannel.channelId);
    }, [savedAnnounceChannel, savedMusicChannel]);
    
    useEffect(() => {
        async function fetchDiscordChannels() {
            if (!discordId) {
                setIsLoadingChannels(false);
                return;
            }
            setIsLoadingChannels(true);
            try {
                const res = await fetch(`/api/discord/channels?userId=${discordId}`);
                if (res.ok) {
                    const data = await res.json();
                    setAllChannels(data);
                } else {
                    toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch Discord channels.' });
                }
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch Discord channels.' });
            } finally {
                setIsLoadingChannels(false);
            }
        }
        fetchDiscordChannels();
    }, [toast, discordId]);
    
    const handleSave = () => {
        if (!firestore) return;
        
        let changesMade = false;
        if (selectedAnnounceChannel && announcementChannelRef) {
            setDocumentNonBlocking(announcementChannelRef, { channelId: selectedAnnounceChannel }, { merge: true });
            changesMade = true;
        }
        if (selectedMusicChannel && musicBotChannelRef) {
            setDocumentNonBlocking(musicBotChannelRef, { channelId: selectedMusicChannel }, { merge: true });
            changesMade = true;
        }

        if (changesMade) {
            toast({ title: 'Settings Saved', description: 'Your changes have been saved.' });
        }
    }
    
    const somethingIsSelected = selectedAnnounceChannel || selectedMusicChannel;

    return (
         <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline"><Server className="h-6 w-6"/> Application Settings</CardTitle>
                <CardDescription>Manage global settings for the CliqueyTalk application.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="space-y-2">
                    <Label htmlFor='announcement-channel'>Announcement Channel</Label>
                       <Select value={selectedAnnounceChannel} onValueChange={setSelectedAnnounceChannel} disabled={isLoadingChannels}>
                           <SelectTrigger id="announcement-channel">
                                <SelectValue placeholder={isLoadingChannels ? "Loading..." : "Select a channel..."} />
                           </SelectTrigger>
                           <SelectContent>
                               {allChannels.map(channel => (
                                   <SelectItem key={channel.id} value={channel.id}>
                                       <div className="flex items-center gap-2">
                                           {[2, 13].includes(channel.type) ? <Mic className="h-4 w-4 text-muted-foreground" /> : <span className="font-mono text-muted-foreground">#</span>}
                                           <span>{channel.name}</span>
                                       </div>
                                   </SelectItem>
                               ))}
                           </SelectContent>
                       </Select>
                     <p className="text-xs text-muted-foreground">Select the text channel where "Share to Discord" embeds will be posted.</p>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor='music-bot-channel'>Music Bot Channel (Legacy)</Label>
                       <Select value={selectedMusicChannel} onValueChange={setSelectedMusicChannel} disabled={isLoadingChannels}>
                           <SelectTrigger id="music-bot-channel">
                                <SelectValue placeholder={isLoadingChannels ? "Loading..." : "Select a channel..."} />
                           </SelectTrigger>
                           <SelectContent>
                               {allChannels.map(channel => (
                                   <SelectItem key={channel.id} value={channel.id}>
                                       <div className="flex items-center gap-2">
                                            {[2, 13].includes(channel.type) ? <Mic className="h-4 w-4 text-muted-foreground" /> : <span className="font-mono text-muted-foreground">#</span>}
                                           <span>{channel.name}</span>
                                       </div>
                                   </SelectItem>
                               ))}
                           </SelectContent>
                       </Select>
                     <p className="text-xs text-muted-foreground">This setting is now legacy. Music is played in the voice channel where the `!sr` command originated.</p>
                </div>
            </CardContent>
            <CardFooter className="border-t pt-4 flex justify-end">
                 <Button onClick={handleSave} disabled={isSaving || !somethingIsSelected}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4" />}
                    Save All Settings
                </Button>
            </CardFooter>
        </Card>
    )
}

function BackupPlaylistManager() {
    const [url, setUrl] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const firestore = useFirestore();
    const { toast } = useToast();

    const playlistRef = useMemoFirebase(() => firestore ? doc(firestore, 'app_settings', 'backup_playlist') : null, [firestore]);
    const { data: playlistData, isLoading } = useDoc<any>(playlistRef);

    useEffect(() => {
        if (playlistData?.url) {
            setUrl(playlistData.url);
        }
    }, [playlistData]);

    const handleSave = () => {
        if (!playlistRef) return;
        setIsSaving(true);
        setDocumentNonBlocking(playlistRef, { url }, { merge: true });
        toast({
            title: 'Backup Playlist Saved',
            description: 'The bot will now play songs from this playlist when the queue is empty.',
        });
        setIsSaving(false);
    }
    
    if (isLoading) {
        return <Skeleton className="h-48 w-full" />
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline"><ListMusic className="h-6 w-6"/> Backup Playlist</CardTitle>
                <CardDescription>Provide a YouTube playlist URL to play when the main song queue is empty.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-2">
                    <Input 
                        placeholder="YouTube Playlist URL" 
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                    />
                    <Button onClick={handleSave} disabled={isSaving}>
                         {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4" />}
                        Save
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

function QueueToolsManager() {
    const [isSyncing, setIsSyncing] = useState(false);
    const { toast } = useToast();

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const response = await fetch('/api/admin/sync-storage-queue', {
                method: 'POST',
            });
            const data = await response.json();
            if (response.ok) {
                toast({
                    title: 'Sync Complete',
                    description: data.message,
                });
            } else {
                throw new Error(data.error || 'Failed to sync queue.');
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Sync Failed',
                description: error.message,
            });
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline"><Music className="h-6 w-6"/> Music Queue Tools</CardTitle>
                <CardDescription>Tools for managing the global music queue.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                    If you've manually uploaded songs to the `queued-songs` folder in Firebase Storage, use this tool to add them to the playable queue.
                </p>
                <Button onClick={handleSync} disabled={isSyncing} className="w-full">
                    {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Sync Storage to Queue
                </Button>
            </CardContent>
        </Card>
    )
}


// --- Role Manager Component ---
function RoleManager() {
    const [roles, setRoles] = useState<any[]>([]);
    const [isLoadingRoles, setIsLoadingRoles] = useState(true);
    const [selectedRoles, setSelectedRoles] = useState<Record<string, boolean>>({});
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();
    const firestore = useFirestore();

    const adminRolesRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'app_settings', 'admin_roles');
    }, [firestore]);

    const { data: savedAdminRoles, isLoading: isLoadingSavedRoles } = useDoc<any>(adminRolesRef);

    useEffect(() => {
        async function fetchRoles() {
            setIsLoadingRoles(true);
            try {
                const res = await fetch('/api/discord/roles');
                if (res.ok) {
                    const data = await res.json();
                    // Filter out @everyone role and sort by position
                    const filteredAndSortedRoles = data
                        .filter((r: any) => r.name !== '@everyone' && !r.tags?.bot_id)
                        .sort((a: any, b: any) => b.position - a.position);
                    setRoles(filteredAndSortedRoles);
                }
            } catch (error) {
                console.error("Failed to fetch roles", error);
            }
            setIsLoadingRoles(false);
        }
        fetchRoles();
    }, []);

    useEffect(() => {
        if (savedAdminRoles) {
            const selected: Record<string, boolean> = {};
            (savedAdminRoles.roles || []).forEach((roleId: string) => {
                selected[roleId] = true;
            });
            setSelectedRoles(selected);
        }
    }, [savedAdminRoles]);

    const handleRoleToggle = (roleId: string) => {
        setSelectedRoles(prev => ({
            ...prev,
            [roleId]: !prev[roleId]
        }));
    };
    
    const handleSaveChanges = async () => {
        if (!firestore || !adminRolesRef) return;
        setIsSaving(true);
        const roleIdsToSave = Object.keys(selectedRoles).filter(id => selectedRoles[id]);

        setDocumentNonBlocking(adminRolesRef, { roles: roleIdsToSave }, { merge: true });

        toast({
            title: 'Admin Roles Updated',
            description: 'Your changes to admin roles have been saved.',
        });
        
        setIsSaving(false);
    }

    const isLoading = isLoadingRoles || isLoadingSavedRoles;
    
    const getRoleStyle = (color: number) => {
        if (color === 0) {
            return { borderColor: '#888' };
        }
        const hexColor = `#${color.toString(16).padStart(6, '0')}`;
        return { borderColor: hexColor, color: hexColor };
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline"><ShieldCheck className="h-6 w-6"/> Admin Role Management</CardTitle>
                <CardDescription>Select which Discord roles should have admin privileges within this application. The server owner always has admin access.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                    {isLoading ? (
                        [...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
                    ) : roles.map(role => (
                         <div key={role.id} className="flex items-center space-x-3 rounded-md border p-3" style={getRoleStyle(role.color)}>
                            <Checkbox 
                                id={`role-${role.id}`}
                                checked={!!selectedRoles[role.id]}
                                onCheckedChange={() => handleRoleToggle(role.id)}
                            />
                            <Label htmlFor={`role-${role.id}`} className="font-medium cursor-pointer flex-1" style={{color: getRoleStyle(role.color).color}}>
                                {role.name}
                            </Label>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end mt-4">
                    <Button onClick={handleSaveChanges} disabled={isSaving || isLoading}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4" />}
                        Save Changes
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

function TwitchAuthCard() {
    const firestore = useFirestore();
    const credsRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'app_settings', 'twitch_bot_credentials');
    }, [firestore]);
    const { data: credentials, isLoading: isLoadingCreds } = useDoc<any>(credsRef);
    const { toast } = useToast();
    
    const handleDisconnect = () => {
        if (!credsRef) return;
        deleteDocumentNonBlocking(credsRef);
        toast({
            title: "Twitch Bot Disconnected",
            description: "The bot's credentials have been removed."
        });
    }

    if (isLoadingCreds) {
        return <Skeleton className="h-48 w-full" />;
    }

    if (!credentials) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-headline"><TwitchIcon className="h-6 w-6"/> Twitch Bot Authorization</CardTitle>
                    <CardDescription>Authorize the bot to join channels and listen for commands like `!sr`.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild className="w-full">
                        <a href="/api/auth/twitch/login"><TwitchIcon className="mr-2 h-5 w-5" /> Connect with Twitch</a>
                    </Button>
                </CardContent>
            </Card>
        );
    }
    
    return (
        <Card>
            <CardHeader>
                 <CardTitle className="flex items-center gap-2 font-headline"><TwitchIcon className="h-6 w-6"/> Twitch Bot Authorized</CardTitle>
                 <CardDescription>The bot is authorized. Channel owners can now link their Twitch channels in their voice channel settings.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button variant="destructive" className="w-full" onClick={handleDisconnect}>
                    Disconnect Twitch Account
                </Button>
            </CardContent>
        </Card>
    )
}

function YouTubeCookieManager() {
    const [status, setStatus] = useState<'unknown' | 'testing' | 'valid' | 'stale' | 'error'>('unknown');
    const [testErrorMessage, setTestErrorMessage] = useState('');
    const { toast } = useToast();
    const [newCookie, setNewCookie] = useState('');
    const [generatedCommand, setGeneratedCommand] = useState('');

    const handleTestCookie = useCallback(async () => {
        setStatus('testing');
        setTestErrorMessage('');
        try {
            const response = await fetch('/api/youtube/cookie-manager');
            const data = await response.json();
            if (response.ok) {
                setStatus(data.status);
                if(data.status !== 'valid') {
                    setTestErrorMessage(data.error || 'The cookie is stale or invalid.');
                }
            } else {
                setStatus('error');
                setTestErrorMessage(data.error || 'An unknown error occurred during testing.');
            }
        } catch (error) {
            setStatus('error');
            setTestErrorMessage('Failed to connect to the test API.');
        }
    }, []);

    // Automatically test the cookie on component mount.
    useEffect(() => {
        handleTestCookie();
    }, [handleTestCookie]);
    
    const handleGenerateCommand = () => {
        if (!newCookie) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please paste a cookie string first.' });
            return;
        }
        // This handles escaping single quotes within the cookie string for the shell command
        const escapedCookie = newCookie.replace(/'/g, "'\\''");
        const command = `echo -n '${escapedCookie}' | gcloud secrets versions add YOUTUBE_COOKIE --data-file=- --project="studio-2042788331-2555f"`;
        setGeneratedCommand(command);
    };

    const handleCopyCommand = () => {
        if (!generatedCommand) return;
        navigator.clipboard.writeText(generatedCommand);
        toast({ title: 'Command Copied!', description: 'The command has been copied to your clipboard.'});
    };

    const getStatusContent = () => {
        switch (status) {
            case 'testing':
                return <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/> Testing...</span>;
            case 'valid':
                return <span className="flex items-center gap-2 text-green-600"><Check className="h-4 w-4"/> Cookie is valid.</span>;
            case 'stale':
                return <span className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4"/> Cookie is stale or expired.</span>;
            case 'error':
                 return <span className="flex items-center gap-2 text-destructive"><XCircle className="h-4 w-4"/> Error testing cookie.</span>;
            default:
                return <span className="text-muted-foreground">Status unknown.</span>;
        }
    }
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline"><KeyRound className="h-6 w-6"/> YouTube Cookie Manager</CardTitle>
                <CardDescription>A refresh station for the YouTube cookie. Paste your new cookie below and generate a command to update it.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                        <Label>Current Cookie Status</Label>
                        <div className="text-sm">
                           {getStatusContent()}
                        </div>
                         {testErrorMessage && (status === 'stale' || status === 'error') && (
                            <p className="text-xs text-destructive max-w-xs">{testErrorMessage}</p>
                        )}
                    </div>
                    <Button onClick={handleTestCookie} disabled={status === 'testing'}>
                       {status === 'testing' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <TestTube2 className="mr-2 h-4 w-4"/>}
                        Re-Test
                    </Button>
                </div>
                 
                 <div className="space-y-2">
                    <Label htmlFor="youtube-cookie-input">New YouTube Cookie</Label>
                     <Textarea 
                        id="youtube-cookie-input"
                        placeholder="Paste the full cookie string from your browser's developer tools here."
                        className="font-mono text-xs h-24"
                        value={newCookie}
                        onChange={(e) => setNewCookie(e.target.value)}
                     />
                    <Button className="w-full" onClick={handleGenerateCommand} disabled={!newCookie}>
                        Generate Update Command
                    </Button>
                 </div>

                 {generatedCommand && (
                    <div className="space-y-2">
                         <Label>Generated Command</Label>
                         <div className="relative">
                            <Textarea 
                                readOnly
                                value={generatedCommand}
                                className="font-mono text-xs h-28 bg-muted"
                            />
                            <Button size="sm" variant="ghost" className="absolute top-2 right-2 h-7" onClick={handleCopyCommand}>
                                <Copy className="mr-2 h-4 w-4" /> Copy
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Run this command in a terminal where you are authenticated with `gcloud`. This will update the secret.
                        </p>
                    </div>
                 )}
            </CardContent>
        </Card>
    );
}

function UserCard({ user, channelId, allChannels }: { user: WithId<any>; channelId: string, allChannels: WithId<any>[] | null }) {
  const { addNotification } = usePage();
  const firestore = useFirestore();

  const displayName = user.username || '...';
  const avatarFallback = displayName.charAt(0).toUpperCase();

  const handleKick = async () => {
    if (!firestore) return;
    const channelRef = doc(firestore, 'voice_channels', channelId);
    updateDocumentNonBlocking(channelRef, {
      participantIds: arrayRemove(user.id),
    });
    addNotification({
      title: 'User Kicked',
      description: `${displayName} has been kicked from the channel.`,
    });
  };
  
   const handleAdminMute = () => {
    if (!firestore || !user.id) return;
    const userRef = doc(firestore, 'users', user.id);
    const newMuteState = !user.isGloballyMuted;
    updateDocumentNonBlocking(userRef, {
        isGloballyMuted: newMuteState
    });
    addNotification({
      title: newMuteState ? 'User Muted' : 'User Unmuted',
      description: `${displayName} has been ${newMuteState ? 'globally muted' : 'unmuted'}.`,
    });
  };

  const handleBan = () => {
      if(!firestore || !user.id || !user.username) return;
      const banDocRef = doc(firestore, 'banned_users', user.id);
      const banData = {
          userId: user.id,
          username: user.username,
          bannedAt: serverTimestamp(),
          reason: "Banned from admin panel"
      };
      setDocumentNonBlocking(banDocRef, banData, {});
      handleKick();
      addNotification({
          title: "User Banned",
          description: `${displayName} has been banned and kicked.`
      });
  }

  const handleMoveUser = async (destinationChannelId: string) => {
    if (!firestore || channelId === destinationChannelId) return;

    const sourceChannelRef = doc(firestore, 'voice_channels', channelId);
    const destinationChannelRef = doc(firestore, 'voice_channels', destinationChannelId);
    const destinationChannelName = allChannels?.find(c => c.id === destinationChannelId)?.name || 'the new channel';

    // Non-blocking updates
    updateDocumentNonBlocking(destinationChannelRef, {
      participantIds: arrayUnion(user.id)
    });
    updateDocumentNonBlocking(sourceChannelRef, {
      participantIds: arrayRemove(user.id)
    });
    
    addNotification({
      title: 'User Moved',
      description: `${displayName} has been moved to ${destinationChannelName}.`,
    });
  };

  const availableChannels = allChannels?.filter(c => c.id !== channelId && c.privacy === 'public') || [];

  return (
    <div className="group flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-accent">
      <Avatar className="h-9 w-9">
        <AvatarImage src={user.profilePicture} alt={displayName} />
        <AvatarFallback>{avatarFallback}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <p className="font-medium">{displayName}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
            {user.isGloballyMuted && <MicOff className="h-3 w-3 text-destructive" />}
            Online
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <DropdownMenu>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoveRight className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Move User</TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent align="end">
                 <DropdownMenuLabel>Move to...</DropdownMenuLabel>
                 <DropdownMenuSeparator />
                 {availableChannels.length > 0 ? (
                    availableChannels.map(channel => (
                        <DropdownMenuItem key={channel.id} onClick={() => handleMoveUser(channel.id)}>
                            <span>{channel.name}</span>
                        </DropdownMenuItem>
                    ))
                 ) : (
                    <DropdownMenuItem disabled>No other public channels</DropdownMenuItem>
                 )}
            </DropdownMenuContent>
        </DropdownMenu>

        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className={cn("h-7 w-7 text-orange-500 hover:text-orange-600 hover:bg-orange-100", user.isGloballyMuted && "bg-orange-100")} onClick={handleAdminMute}>
                        <MicOff className="h-4 w-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Admin Mute</TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-yellow-500 hover:text-yellow-600 hover:bg-yellow-100" onClick={handleKick}>
                        <DoorClosed className="h-4 w-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Kick User</TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-100" onClick={handleBan}>
                        <Ban className="h-4 w-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Ban User</TooltipContent>
            </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

function ChannelCard({ channel, allUsers, allChannels }: { channel: WithId<any>, allUsers: WithId<any>[] | null, allChannels: WithId<any>[] | null }) {
    const firestore = useFirestore();
    const { addNotification } = usePage();
    const router = useRouter();
    const participants = allUsers?.filter(u => channel.participantIds?.includes(u.id)) || [];

    const handleCloseChannel = async () => {
        if (!firestore) return;
        const channelRef = doc(firestore, 'voice_channels', channel.id);
        deleteDocumentNonBlocking(channelRef);
        addNotification({
            title: "Channel Closed",
            description: `The channel "${channel.name}" has been closed.`,
        });
    };


    return (
        <Card className="flex flex-col">
            <CardHeader>
                <button onClick={() => router.push(`/channels/${channel.id}`)} className="text-left w-full">
                    <div className="flex items-center gap-2">
                        {channel.privacy === 'private' 
                        ? <Lock className="h-5 w-5" /> 
                        : (channel.type === 'video' ? <Video className="h-5 w-5" /> : <Mic className="h-5 w-5" />)
                        }
                        <CardTitle className="hover:underline">{channel.name}</CardTitle>
                    </div>
                </button>
            <CardDescription>{participants.length} users online</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-2">
            {participants.length > 0 ? participants.map(user => (
                <UserCard key={user.id} user={user} channelId={channel.id} allChannels={allChannels} />
            )) : <p className="text-sm text-muted-foreground p-2">Empty channel</p>}
            </CardContent>
            <CardFooter className='border-t pt-4'>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                         <Button variant="destructive" className="w-full">
                            <Trash2 className="mr-2 h-4 w-4" /> Close Channel
                         </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently close the channel "{channel.name}" and kick all participants. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleCloseChannel}>Confirm</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardFooter>
        </Card>
    )
}

export function AdminPanel() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { discordId, addNotification } = usePage();
  const { toast } = useToast();
  
  const channelsQuery = useMemoFirebase(() => {
    if (!firestore || !discordId) return null;
    return collection(firestore, 'voice_channels');
  }, [firestore, discordId]);
  
  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);
  
  const { data: channels, isLoading: isLoadingChannels } = useCollection<any>(channelsQuery);
  const { data: users, isLoading: isLoadingUsers } = useCollection<any>(usersQuery);

  const handleAssistanceRequest = () => {
    addNotification({
        title: "Admin Assistance Requested",
        description: `${user?.displayName || 'An admin'} has requested assistance.`,
    });
     toast({
        title: "Assistance Requested",
        description: "A notification has been sent to other admins.",
    });
  }

  const isLoading = isLoadingChannels || isLoadingUsers;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 p-4 md:p-6 space-y-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <RoleManager />
            <BanManager />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <TwitchAuthCard />
            <YouTubeCookieManager />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <SettingsManager />
             <div className="space-y-8">
                <BackupPlaylistManager />
                <QueueToolsManager />
            </div>
        </div>


        <div>
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="font-headline text-2xl font-bold">Channel Management</h2>
                    <p className="text-muted-foreground">Manage users across all active voice channels.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleAssistanceRequest}>
                        <AlertTriangle className="mr-2 h-4 w-4" />
                        Request Assistance
                    </Button>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {isLoading ? (
                [...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)
            ) : (
                channels?.map(channel => (
                    <ChannelCard key={channel.id} channel={channel} allUsers={users} allChannels={channels} />
                ))
            )}
            {!isLoading && channels?.length === 0 && (
                <div className="text-muted-foreground md:col-span-2 xl:col-span-3 text-center p-8 border-2 border-dashed rounded-lg">
                    <p>No active channels.</p>
                </div>
            )}
            </div>
        </div>
      </div>
    </div>
  );
}
