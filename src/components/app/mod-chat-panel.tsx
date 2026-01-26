
'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Loader2, MessageSquare, PanelRightClose, Radio, Smile, User, PictureInPicture, Rows3, Columns3, Split, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '../ui/input';
import { usePage } from '@/context/page-context';
import { useUser, useFirestore, setDocumentNonBlocking, useDoc, useMemoFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import Image from 'next/image';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { DiscordIcon } from '../icons/discord-icon';
import { TwitchIcon } from '../icons/twitch-icon';
import { useRouter } from 'next/navigation';
import { Separator } from '../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export interface DiscordMessage {
    id: string;
    content: string;
    author: {
        id: string;
        username: string;
        global_name: string | null;
        avatar: string | null;
        discriminator: string;
    };
    mentions: {
        id:string;
        username: string;
        global_name: string | null;
    }[],
    embeds: {
        url?: string;
        thumbnail?: {
            url: string;
        };
        image?: {
            url: string;
        };
    }[];
    attachments: {
        url: string;
        content_type?: string;
    }[];
    timestamp: string;
}

interface DiscordChannel {
    id: string;
    name: string;
    type: number;
}

interface DiscordEmoji {
    id: string;
    name: string;
    animated: boolean;
}

const parseDiscordContent = (content: string, message: DiscordMessage) => {
    let parsedContent = content;

    // 1. Parse Mentions
    message.mentions.forEach(mention => {
        const mentionTag = `<@${mention.id}>`;
        const mentionTagWithNickname = `<@!${mention.id}>`;
        const displayName = `@${mention.global_name || mention.username}`;
        
        parsedContent = parsedContent.replace(new RegExp(mentionTag, 'g'), `<span class="bg-primary/20 text-primary font-semibold rounded px-1">${displayName}</span>`);
        parsedContent = parsedContent.replace(new RegExp(mentionTagWithNickname, 'g'), `<span class="bg-primary/20 text-primary font-semibold rounded px-1">${displayName}</span>`);
    });

    // 2. Parse Custom Emojis
    parsedContent = parsedContent.replace(/<a?:(\w+):(\d+)>/g, (match, name, id) => {
        const url = `https://cdn.discordapp.com/emojis/${id}.${match.startsWith('<a:') ? 'gif' : 'png'}`;
        return `<img src="${url}" alt="${name}" class="inline-block h-5 w-5 mx-0.5" />`;
    });

    let mediaContent = '';
    
    // 3. Handle Embeds (like Tenor GIFs)
    if (message.embeds && message.embeds.length > 0) {
        message.embeds.forEach(embed => {
            const thumbnailUrl = embed.thumbnail?.url;
            const mediaUrl = embed.image?.url || embed.url;
            const contentUrl = embed.url;

            if (thumbnailUrl && contentUrl) {
                 mediaContent += `<a href="${mediaUrl || contentUrl}" target="_blank" rel="noopener noreferrer"><img src="${thumbnailUrl}" class="mt-2 rounded-lg max-w-full h-auto cursor-pointer" /></a>`;
                 // Remove the raw link from the text if it's there
                 if(contentUrl && parsedContent.includes(contentUrl)) {
                    parsedContent = parsedContent.replace(contentUrl, '');
                 }
            } else if (mediaUrl) { // Handle image-only embeds
                mediaContent += `<a href="${mediaUrl}" target="_blank" rel="noopener noreferrer"><img src="${mediaUrl}" class="mt-2 rounded-lg max-w-full h-auto" /></a>`;
                if(contentUrl && parsedContent.includes(contentUrl)) {
                    parsedContent = parsedContent.replace(contentUrl, '');
                 }
            }
        });
    }

    // 4. Handle Attachments
    if (message.attachments && message.attachments.length > 0) {
        message.attachments.forEach(attachment => {
            if (attachment.content_type?.startsWith('image/')) {
                mediaContent += `<a href="${attachment.url}" target="_blank" rel="noopener noreferrer"><img src="${attachment.url}" class="mt-2 rounded-lg max-w-full h-auto" /></a>`;
            }
        });
    }

    return parsedContent + mediaContent;
};

function EmojiPicker({ onEmojiSelect }: { onEmojiSelect: (emojiString: string) => void }) {
    const [emojis, setEmojis] = useState<DiscordEmoji[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchEmojis() {
            setIsLoading(true);
            try {
                const res = await fetch('/api/discord/emojis');
                if (res.ok) {
                    const data = await res.json();
                    setEmojis(data);
                }
            } catch (error) {
                console.error("Failed to fetch emojis", error);
            }
            setIsLoading(false);
        }
        fetchEmojis();
    }, []);

    const handleEmojiClick = (emoji: DiscordEmoji) => {
        const emojiString = `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`;
        onEmojiSelect(emojiString);
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <Smile className="h-5 w-5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2">
                <ScrollArea className="h-60">
                    <div className="grid grid-cols-8 gap-1">
                        {isLoading ? (
                            <div className="col-span-8 flex justify-center items-center h-full">
                                <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                        ) : emojis.length > 0 ? (
                            emojis.map(emoji => (
                                <TooltipProvider key={emoji.id} delayDuration={100}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                onClick={() => handleEmojiClick(emoji)}
                                                className="aspect-square rounded-md p-1 hover:bg-accent transition-colors"
                                            >
                                                <Image
                                                    src={`https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}`}
                                                    alt={emoji.name}
                                                    width={24}
                                                    height={24}
                                                    unoptimized
                                                />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>:{emoji.name}:</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ))
                        ) : (
                            <p className="col-span-8 text-sm text-muted-foreground text-center p-4">No custom emojis found.</p>
                        )}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}

function SubmitButton({ isPending }: { isPending: boolean }) {
    return (
        <Button type="submit" size="sm" disabled={isPending}>
             {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
        </Button>
    )
}

function DiscordChat() {
    const { user } = useUser();
    const { isChatOpen, addNotification, discordId } = usePage();
    const firestore = useFirestore();
    const STREAM_CHAT_ID = '1340315377774755890';

    const [messages, setMessages] = React.useState<DiscordMessage[]>([]);
    const [channels, setChannels] = React.useState<DiscordChannel[]>([]);
    const [selectedChannel, setSelectedChannel] = React.useState<string | undefined>();
    const [webhookUrl, setWebhookUrl] = React.useState<string | null>(null);
    const [isLoadingMessages, setIsLoadingMessages] = React.useState(false);
    const [isLoadingChannels, setIsLoadingChannels] = React.useState(true);
    const [isSending, setIsSending] = useState(false);
    const [isManagingWebhook, setIsManagingWebhook] = useState(false);
    const [messageInput, setMessageInput] = useState('');

    const formRef = useRef<HTMLFormElement>(null);
    const scrollViewportRef = useRef<HTMLDivElement>(null);
    const lastMessageIdRef = useRef<string | null>(null);

    const { toast } = useToast();
    
    const sendDiscordChatMessage = async (formData: FormData) => {
        const message = messageInput;
        if (!message || !selectedChannel || !user || !webhookUrl) {
            toast({ variant: 'destructive', title: 'Cannot Send', description: 'Webhook is not ready.' });
            return;
        };

        setIsSending(true);

        try {
            const response = await fetch('/api/discord/webhook', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    webhookUrl: webhookUrl,
                    content: message,
                    username: user.displayName,
                    avatar_url: user.photoURL,
                })
            });
            
            if (response.ok) {
                setMessageInput('');
                fetchMessages(selectedChannel, true); // Refresh and force scroll
            } else {
                 const errorData = await response.json();
                 toast({
                    variant: 'destructive',
                    title: 'Message Failed',
                    description: errorData.error || 'Could not send message.',
                });
            }
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Network Error',
                description: 'Could not send message. Please check your connection.',
            });
        } finally {
            setIsSending(false);
        }
    }

    const handleEmojiSelect = (emojiString: string) => {
        setMessageInput(prev => prev + emojiString);
    };

    const fetchMessages = useCallback(async (channelId: string, forceScroll = false) => {
        if (!channelId) return;
        
        if (messages.length === 0 && !forceScroll) {
            setIsLoadingMessages(true);
        }

        try {
            const response = await fetch(`/api/discord/messages?channelId=${channelId}`);
            if (response.ok) {
                const data: DiscordMessage[] = await response.json();
                const newMessages = data.reverse();

                // Notification Logic
                if (lastMessageIdRef.current && !isChatOpen && newMessages.length > 0) {
                    const lastKnownIndex = newMessages.findIndex(m => m.id === lastMessageIdRef.current);
                    const newestMessages = lastKnownIndex === -1 ? newMessages : newMessages.slice(lastKnownIndex + 1);

                    newestMessages.forEach(msg => {
                        // Don't notify for user's own messages sent via webhook
                        const isSelf = msg.author.username.toLowerCase() === user?.displayName?.toLowerCase();
                        if (!isSelf) {
                            addNotification({
                                title: `New Chat Message`,
                                description: `${msg.author.global_name || msg.author.username}: ${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}`
                            });
                        }
                    });
                }
                if (newMessages.length > 0) {
                    lastMessageIdRef.current = newMessages[newMessages.length - 1].id;
                }

                setMessages(currentMessages => {
                    const lastCurrentId = currentMessages[currentMessages.length - 1]?.id;
                    const lastNewId = newMessages[newMessages.length - 1]?.id;
                    
                    if (lastCurrentId !== lastNewId || currentMessages.length !== newMessages.length) {
                        const viewport = scrollViewportRef.current;
                        const isScrolledToBottom = viewport ? viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 50 : true;

                        setTimeout(() => {
                           if ((isScrolledToBottom || forceScroll) && scrollViewportRef.current) {
                                scrollViewportRef.current.scrollTo({ top: scrollViewportRef.current.scrollHeight, behavior: 'smooth' });
                           }
                        }, 100);

                        return newMessages;
                    }
                    
                    return currentMessages;
                });
            } else {
                 let errorData;
                 try {
                     errorData = await response.json();
                 } catch (e) {
                     errorData = { error: response.statusText || 'An unknown error occurred.' };
                 }
                 console.error("Failed to fetch messages:", errorData);
                 setMessages([]);
                 toast({
                    variant: 'destructive',
                    title: 'Could not fetch messages',
                    description: errorData.error || 'Please check server configuration.',
                 });
            }
        } catch (error: any) {
            console.error("Failed to fetch messages:", error);
            setMessages([]);
            toast({ variant: 'destructive', title: 'Error', description: 'An error occurred while fetching messages.' });
        } finally {
            setIsLoadingMessages(false);
        }
    }, [toast, messages.length, isChatOpen, addNotification, user?.displayName]);

    useEffect(() => {
        const manageWebhook = async (channelId: string) => {
            if (!firestore) return;
            setIsManagingWebhook(true);
            setWebhookUrl(null);

            const webhookDocRef = doc(firestore, 'channel_webhooks', channelId);
            
            try {
                const docSnap = await getDoc(webhookDocRef);
                if (docSnap.exists()) {
                    setWebhookUrl(docSnap.data().webhookUrl);
                } else {
                    const res = await fetch('/api/discord/webhook-manager', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ channelId }),
                    });
    
                    if (!res.ok) throw new Error(await res.text());
    
                    const { webhook } = await res.json();
                    
                    setDocumentNonBlocking(webhookDocRef, {
                        channelId: channelId,
                        webhookUrl: webhook.url,
                        webhookId: webhook.id
                    }, {});

                    setWebhookUrl(webhook.url);
                }
            } catch (error: any) {
                toast({
                    variant: 'destructive',
                    title: 'Webhook Management Failed',
                    description: error.message || 'Could not set up the chat integration for this channel.',
                });
            } finally {
                setIsManagingWebhook(false);
            }
        };

        if(selectedChannel) {
            manageWebhook(selectedChannel);
        }

    }, [selectedChannel, firestore, toast]);

    useEffect(() => {
        const fetchChannels = async () => {
            if (!discordId) {
                setIsLoadingChannels(false);
                return;
            }
            setIsLoadingChannels(true);
            try {
                const response = await fetch(`/api/discord/channels?userId=${discordId}`);
                if (response.ok) {
                    const data: DiscordChannel[] = await response.json();
                    setChannels(data);
                    
                    const streamChatExists = data.some(c => c.id === STREAM_CHAT_ID);
                    if (selectedChannel && !data.some(c => c.id === selectedChannel)) {
                         setSelectedChannel(streamChatExists ? STREAM_CHAT_ID : (data[0]?.id || undefined));
                    } else if (!selectedChannel) {
                        setSelectedChannel(streamChatExists ? STREAM_CHAT_ID : (data[0]?.id || undefined));
                    }
                } else {
                    const errorData = await response.json();
                    toast({ 
                        variant: 'destructive', 
                        title: 'Could not fetch channels', 
                        description: errorData.error || 'Please check server configuration.'
                    });
                }
            } catch (error) {
                console.error("Failed to fetch channels:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'An error occurred while fetching channels.'})
            } finally {
                setIsLoadingChannels(false);
            }
        };
        fetchChannels();
    }, [discordId, toast]);

    useEffect(() => {
        if (!selectedChannel) return;

        let isMounted = true;
        
        const initialFetch = async () => {
            if (isMounted) {
                await fetchMessages(selectedChannel, true);
            }
        };

        initialFetch();
        
        const intervalId = setInterval(() => {
             if(isMounted) fetchMessages(selectedChannel);
        }, 5000); 

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        }
    }, [selectedChannel, fetchMessages]);
    

    return (
        <div className="flex h-full flex-col bg-background">
            <ScrollArea className="flex-1 min-h-0" viewportRef={scrollViewportRef}>
                 <div className="p-4 space-y-4">
                    {isLoadingMessages || isManagingWebhook ? (
                        <div className="flex items-center justify-center h-full py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-center py-10">
                            {channels.length > 0 ? (
                                <p className="text-sm text-muted-foreground">No messages yet. <br/> Start the conversation!</p>
                            ) : (
                                <p className="text-sm text-muted-foreground">No channels found. <br /> Admins can configure this.</p>
                            )}
                        </div>
                    ) : (
                        messages.map(msg => {
                            const authorName = msg.author.global_name || msg.author.username;
                            const authorAvatar = msg.author.avatar
                                ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png`
                                : `https://cdn.discordapp.com/embed/avatars/${Number(msg.author.discriminator) % 5}.png`;

                            const isCurrentUser = msg.author.username.toLowerCase() === user?.displayName?.toLowerCase() && !msg.author.id;
                            const parsedContent = parseDiscordContent(msg.content, msg);

                            return (
                                <div key={msg.id} className={cn("flex items-start gap-2.5", isCurrentUser && "justify-end")}>
                                    {!isCurrentUser && (
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={authorAvatar} />
                                            <AvatarFallback>{authorName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                    )}
                                    <div className={cn("grid w-full max-w-[280px] leading-1.5 p-2.5", isCurrentUser ? "bg-accent text-accent-foreground rounded-s-xl rounded-ee-xl" : "bg-muted rounded-e-xl rounded-es-xl")}>
                                        <div className="flex items-center space-x-2 rtl:space-x-reverse">
                                            <span className={cn("text-sm font-semibold", !isCurrentUser && "text-card-foreground")}>{authorName}</span>
                                        </div>
                                        <div className="text-sm font-normal py-1 break-words" dangerouslySetInnerHTML={{ __html: parsedContent }}></div>
                                    </div>
                                     {isCurrentUser && (
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={user?.photoURL || authorAvatar} />
                                            <AvatarFallback>{authorName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>
            </ScrollArea>
            <div className="p-2 border-t flex items-center gap-2">
                 <Select 
                    value={selectedChannel} 
                    onValueChange={(value) => { if (value) setSelectedChannel(value) }}
                    disabled={isLoadingChannels || channels.length === 0}
                 >
                    <SelectTrigger className="h-9 w-auto flex-shrink-0" style={{flexGrow: 0.2}}>
                        <div className="flex items-center gap-1.5 truncate">
                         <MessageSquare className="h-4 w-4 shrink-0" />
                         <SelectValue placeholder="Select..." asChild>
                            <span className="truncate">{channels.find(c => c.id === selectedChannel)?.name}</span>
                         </SelectValue>
                        </div>
                    </SelectTrigger>
                    <SelectContent position="item-aligned">
                        {isLoadingChannels ? (
                            <div className="flex items-center justify-center p-2"><Loader2 className="h-4 w-4 animate-spin"/></div>
                        ) : channels.map(channel => (
                            <SelectItem key={channel.id} value={channel.id}>
                                <div className="flex items-center gap-2">
                                     {[2, 13].includes(channel.type) ? <Mic className="h-4 w-4 text-muted-foreground" /> : <span className="font-mono text-muted-foreground">#</span>}
                                     <span className="truncate">{channel.name}</span>
                                 </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                 </Select>

                <form onSubmit={(e) => { e.preventDefault(); sendDiscordChatMessage(new FormData(e.currentTarget)); }} ref={formRef} className="relative flex-1 flex items-center">
                    <Input 
                        name="message" 
                        placeholder={selectedChannel ? `Message #${channels.find(c => c.id === selectedChannel)?.name || '...'}` : 'Select a channel'}
                        className="pr-24 h-9" 
                        autoComplete="off" 
                        disabled={!selectedChannel || isSending || !webhookUrl || isLoadingChannels}
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-1">
                        <EmojiPicker onEmojiSelect={handleEmojiSelect} />
                        <SubmitButton isPending={isSending} />
                    </div>
                </form>
            </div>
        </div>
    )
}

function TwitchChat() {
    const { discordId } = usePage();
    const firestore = useFirestore();
    const router = useRouter();
    const [iframeUrl, setIframeUrl] = useState<string | null>(null);

    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !discordId) return null;
        return doc(firestore, 'users', discordId);
    }, [firestore, discordId]);

    const { data: userProfile, isLoading: isLoadingProfile } = useDoc<any>(userProfileRef);

    useEffect(() => {
        const twitchChannel = userProfile?.preferences?.twitchChannel;
        if (twitchChannel) {
            const parentDomain = window.location.hostname;
            setIframeUrl(`https://www.twitch.tv/embed/${twitchChannel}/chat?parent=${parentDomain}&darkpopout`);
        } else {
            setIframeUrl(null);
        }
    }, [userProfile]);

    if (isLoadingProfile) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        );
    }
    
    if (!userProfile?.preferences?.twitchChannel) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <TwitchIcon className="h-10 w-10 text-muted-foreground" />
                <h3 className="mt-4 font-semibold">Twitch Channel Not Set</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                    Go to your settings page to link your Twitch channel.
                </p>
            </div>
        )
    }

    if (!iframeUrl) {
         return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className='ml-2'>Loading Twitch Chat...</p>
            </div>
        );
    }

    return (
        <iframe
            src={iframeUrl}
            className="w-full h-full border-0 relative z-10"
            title="Twitch Chat"
        />
    );
}

export function ChatPanel({ isPopup = false }: { isPopup?: boolean }) {
    const { isChatOpen, setIsChatOpen } = usePage();
    const [layout, setLayout] = useState<'vertical' | 'horizontal'>('vertical');
    const [ratio, setRatio] = useState<'50/50' | '75/25' | '25/75'>('50/50');


    const handlePopOut = () => {
        window.open('/chat-popout', '_blank', 'width=400,height=800,popup,noopener,noreferrer');
        if (!isPopup) {
            setIsChatOpen(false);
        }
    };
    
    const cycleRatio = () => {
        if (ratio === '50/50') setRatio('75/25');
        else if (ratio === '75/25') setRatio('25/75');
        else setRatio('50/50');
    };

    const RootComponent = isPopup ? 'div' : 'aside';
    
    const pane1FlexClass = ratio === '50/50' ? 'flex-1' : ratio === '75/25' ? 'flex-[3]' : 'flex-[1]';
    const pane2FlexClass = ratio === '50/50' ? 'flex-1' : ratio === '75/25' ? 'flex-[1]' : 'flex-[3]';

    return (
        <RootComponent className={cn(
            "flex flex-col",
            isPopup
                ? "h-screen w-screen bg-card"
                : [
                    "fixed top-0 right-0 h-screen w-96 bg-card border-l flex flex-col transition-transform duration-300 ease-in-out z-20",
                    isChatOpen ? "translate-x-0" : "translate-x-full"
                ]
        )}>
            <header className="flex items-center justify-between p-2 border-b shrink-0 h-16 gap-1">
                 {!isPopup && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className='h-8 w-8' onClick={() => setIsChatOpen(false)}>
                                    <PanelRightClose className="h-5 w-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom"><p>Close Panel</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                 )}

                <div className="flex-1 flex items-center justify-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    <h3 className="font-semibold text-foreground">
                        Live Chats
                    </h3>
                </div>
                
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className='h-8 w-8' onClick={cycleRatio}>
                                <Split className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom"><p>Cycle Split ({ratio})</p></TooltipContent>
                    </Tooltip>
                     <Tooltip>
                        <TooltipTrigger asChild>
                           <Button variant="ghost" size="icon" className='h-8 w-8' onClick={() => setLayout(layout === 'vertical' ? 'horizontal' : 'vertical')}>
                                {layout === 'vertical' ? <Columns3 className="h-5 w-5" /> : <Rows3 className="h-5 w-5" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom"><p>Toggle Layout</p></TooltipContent>
                    </Tooltip>
                    {!isPopup && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className='h-8 w-8' onClick={handlePopOut}>
                                    <PictureInPicture className="h-5 w-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom"><p>Pop-out Chat</p></TooltipContent>
                        </Tooltip>
                    )}
                </TooltipProvider>
            </header>
            <div className={cn(
                "flex flex-1 min-h-0",
                layout === 'vertical' ? 'flex-col' : 'flex-row'
            )}>
                 <div className={cn("flex flex-col min-h-0 overflow-hidden", pane1FlexClass)}>
                    <DiscordChat />
                 </div>
                 <Separator orientation={layout === 'vertical' ? 'horizontal' : 'vertical'} />
                 <div className={cn("relative flex flex-col min-h-0 overflow-hidden", pane2FlexClass)}>
                    <TwitchChat />
                 </div>
            </div>
        </RootComponent>
    )
}
