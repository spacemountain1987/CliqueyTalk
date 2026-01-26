
'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, PlusCircle, Lock, Globe, Radio, Waves, Video, Twitch } from 'lucide-react';
import { useState } from 'react';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Switch } from '../ui/switch';
import { useRouter } from 'next/navigation';
import { useFirestore, useUser, addDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp } from 'firebase/firestore';
import { usePage } from '@/context/page-context';
import { Textarea } from '../ui/textarea';
import { TwitchIcon } from '../icons/twitch-icon';

const formSchema = z.object({
  name: z.string().min(3, 'Channel name must be at least 3 characters long.'),
  description: z.string().optional(),
  privacy: z.enum(['public', 'private']),
  password: z.string().optional(),
  type: z.enum(['voice', 'video']),
  twitchChannel: z.string().optional(),
}).refine(data => data.privacy === 'private' ? !!data.password && data.password.length > 0 : true, {
  message: "A password is required for private channels.",
  path: ["password"],
});


export function CreateChannelDialog() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();
  const { discordId, addNotification } = usePage();
  const router = useRouter();
  const firestore = useFirestore();


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      privacy: 'public',
      password: '',
      type: 'voice',
      twitchChannel: '',
    },
  });

  const privacyValue = form.watch('privacy');

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user || !discordId || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'You must be logged in and the database must be available to create a channel.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const newChannel: any = {
        name: values.name,
        description: values.description || '',
        creatorId: discordId,
        creationDate: serverTimestamp(),
        privacy: values.privacy,
        type: values.type,
        twitchChannel: (values.twitchChannel || '').toLowerCase(),
        settings: JSON.stringify({
          volume: 'Normal',
          muting: 'Open',
        }),
        participantIds: [discordId],
      };

      if (values.privacy === 'private' && values.password) {
          newChannel.password = values.password;
      }
    
      const channelsCollection = collection(firestore, 'voice_channels');
      const docRefPromise = addDocumentNonBlocking(channelsCollection, newChannel);
      
      addNotification({
        title: 'Channel Created!',
        description: `The channel "${values.name}" is now open.`,
      });
      setOpen(false);
      form.reset();

      // No need to await here for UI purposes, but we can to get the ID for redirection
      const docRef = await docRefPromise;
      if (docRef) {
        router.push(`/channels/${docRef.id}`);
      } else {
        // Fallback in case the non-blocking function returns nothing immediately
        router.push('/dashboard');
      }

    } catch (error) {
        // This catch block might not be hit for permission errors due to the non-blocking call.
        // Those are handled globally. This will catch other errors.
        console.error("Error creating channel: ", error);
        toast({
          variant: 'destructive',
          title: 'Creation Failed',
          description: 'An unexpected error occurred. Please try again.',
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Channel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="font-headline">Create a New Channel</DialogTitle>
          <DialogDescription>
            Fill in the details below to create a new channel.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Channel Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Late Night Gamers" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Let people know what this channel is about."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="privacy"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Privacy</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex space-x-4"
                      >
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="public" id="privacy-public" />
                          </FormControl>
                           <Label htmlFor="privacy-public" className="flex items-center gap-2 font-normal">
                            <Globe className="h-4 w-4" /> Public
                          </Label>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="private" id="privacy-private" />
                          </FormControl>
                          <Label htmlFor="privacy-private" className="flex items-center gap-2 font-normal">
                            <Lock className="h-4 w-4" /> Private
                          </Label>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Channel Type</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex space-x-4"
                      >
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="voice" id="type-voice" />
                          </FormControl>
                           <Label htmlFor="type-voice" className="flex items-center gap-2 font-normal">
                            <Radio className="h-4 w-4" /> Voice
                          </Label>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="video" id="type-video" />
                          </FormControl>
                          <Label htmlFor="type-video" className="flex items-center gap-2 font-normal">
                            <Video className="h-4 w-4" /> Video
                          </Label>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {privacyValue === 'private' && (
               <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Channel Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Set a password for your private channel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="twitchChannel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2"><TwitchIcon className="h-4 w-4" /> Twitch Bot Integration (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Your Twitch username" {...field} />
                  </FormControl>
                  <FormDescription>
                    Enable song requests by linking a Twitch channel.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
               <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Channel
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
