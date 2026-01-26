
'use client';

import React from 'react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Drama, Home, LogOut, Mic, PanelLeft, Settings, Shield, Users, Lock, Video } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { useAuth, useUser, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { signOut } from 'firebase/auth';
import { collection, query, doc } from 'firebase/firestore';
import { useCollection, WithId } from '@/firebase/firestore/use-collection';
import { usePage } from '@/context/page-context';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { discordId, setDiscordId, showSidebar } = usePage();

  const channelsQuery = useMemoFirebase(() => {
    if (!firestore || !discordId) return null;
    return query(collection(firestore, 'voice_channels'));
  }, [firestore, discordId]);

  const { data: channels, isLoading: isLoadingChannels } = useCollection<any>(channelsQuery);

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !discordId) return null;
    return doc(firestore, 'users', discordId);
  }, [firestore, discordId]);

  const { data: userProfile, isLoading: isLoadingProfile } = useDoc<any>(userProfileRef);

  const isUserAdmin = userProfile?.isAdmin === true;
  const isCheckingAdmin = isLoadingProfile || !discordId;
  
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    } finally {
      signOut(auth).then(() => {
        localStorage.removeItem('discordUserId');
        setDiscordId(null);
        router.push('/login');
      });
    }
  };

  const isUiLoading = isUserLoading || (discordId && isLoadingProfile);
  const displayName = userProfile?.username || user?.displayName || 'User';
  const avatarUrl = userProfile?.profilePicture || user?.photoURL;
  const avatarFallback = displayName?.charAt(0) || '?';

  return (
    <Sidebar 
      collapsible="icon" 
      className={cn("border-r flex flex-col", !showSidebar && "md:hidden")}
    >
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="shrink-0" asChild>
                <a href="/dashboard">
                    <Drama className="h-6 w-6 text-primary" />
                </a>
            </Button>
            <h1 className="font-headline text-xl font-semibold">CliqueyTalk</h1>
            <SidebarTrigger asChild className="ml-auto">
                 <Button variant="ghost" size="icon" className="h-7 w-7">
                    <PanelLeft />
                </Button>
            </SidebarTrigger>
        </div>
      </SidebarHeader>

      <SidebarContent className='p-0 flex-1 flex flex-col min-h-0'>
        <div className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 p-2">
              <SidebarMenu>
                  <SidebarMenuItem>
                  <SidebarMenuButton
                      onClick={() => router.push('/dashboard')}
                      isActive={pathname === '/dashboard'}
                      tooltip="Dashboard"
                  >
                      <Home />
                      <span>Dashboard</span>
                  </SidebarMenuButton>
                  </SidebarMenuItem>
                  {isCheckingAdmin ? (
                    <Skeleton className="h-8 w-full rounded-md" />
                  ): isUserAdmin && (
                    <SidebarMenuItem>
                        <SidebarMenuButton
                        onClick={() => router.push('/admin')}
                        isActive={pathname === '/admin'}
                        tooltip="Admin"
                        >
                        <Shield />
                        <span>Admin Panel</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
              </SidebarMenu>
              <SidebarSeparator />
              <SidebarGroup>
              <SidebarGroupLabel className="flex items-center">
                  <Users className="mr-2" />
                  <span>Channels</span>
              </SidebarGroupLabel>
              <SidebarMenu>
                  {discordId && isLoadingChannels && (
                    <>
                      <SidebarMenuSkeleton showIcon />
                      <SidebarMenuSkeleton showIcon />
                    </>
                  )}
                  {discordId && !isLoadingChannels && channels && channels.map((channel: WithId<any>) => (
                      <SidebarMenuItem key={channel.id}>
                          <SidebarMenuButton
                            onClick={() => router.push(`/channels/${channel.id}`)}
                            isActive={pathname === `/channels/${channel.id}`}
                            className="justify-between"
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                                {channel.privacy === 'private' ? <Lock /> : (channel.type === 'video' ? <Video /> : <Mic />)}
                                <span className="truncate">{channel.name}</span>
                            </div>
                            <Badge variant="secondary" className="shrink-0">{channel.participantIds?.length || 0}</Badge>
                          </SidebarMenuButton>
                      </SidebarMenuItem>
                  ))}
              </SidebarMenu>
              </SidebarGroup>
          </ScrollArea>
        </div>
      </SidebarContent>
      
      <SidebarFooter className="p-4 border-t">
        {isUiLoading ? (
            <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                </div>
                 <Skeleton className="h-8 w-8" />
            </div>
        ) : discordId && user ? (
            <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                    <AvatarImage src={avatarUrl} alt={displayName} />
                    <AvatarFallback>{avatarFallback}</AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                    <p className="truncate font-semibold">{displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">Online</p>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                       <Button variant="ghost" size="icon" onClick={() => router.push('/settings')}>
                          <Settings className="h-5 w-5" />
                       </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">User Settings</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                     <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={handleLogout}>
                            <LogOut className="h-5 w-5" />
                        </Button>
                     </TooltipTrigger>
                     <TooltipContent side="top">Logout</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
            </div>
        ) : (
             <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                    <AvatarFallback>?</AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                    <p className="truncate font-semibold">Not Logged In</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => router.push('/login')}>
                    <LogOut className="h-5 w-5" />
                </Button>
            </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
