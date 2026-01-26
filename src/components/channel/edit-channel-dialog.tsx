
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
import { Loader2, Globe, Lock, Twitch } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '../ui/form';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { TwitchIcon } from '../icons/twitch-icon';

const formSchema = z.object({
  name: z.string().min(3, 'Channel name must be at least 3 characters long.'),
  privacy: z.enum(['public', 'private']),
  password: z.string().optional(),
  twitchChannel: z.string().optional(),
}).refine(data => data.privacy === 'private' ? !!data.password && data.password.length > 0 : true, {
  message: "A password is required for private channels.",
  path: ["password"],
});

export function EditChannelDialog({ channel, children }: { channel: any, children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: channel.name || '',
      privacy: channel.privacy || 'public',
      password: '', // Password should not be pre-filled
      twitchChannel: channel.twitchChannel || '',
    },
  });

  const privacyValue = form.watch('privacy');

  // When opening the dialog, reset the form to the current channel state
  useEffect(() => {
    if (open) {
      form.reset({
        name: channel.name,
        privacy: channel.privacy,
        password: '',
        twitchChannel: channel.twitchChannel || '',
      });
    }
  }, [open, channel, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!firestore || !channel?.id) {
      toast({
        variant: 'destructive',
        title: 'Database Error',
        description: 'Firestore is not available or channel ID is missing.',
      });
      return;
    }

    setIsSubmitting(true);
    
    const channelRef = doc(firestore, 'voice_channels', channel.id);
    
    const dataToUpdate: any = {
        name: values.name,
        privacy: values.privacy,
        twitchChannel: (values.twitchChannel || '').toLowerCase(),
    };

    if (values.privacy === 'private' && values.password) {
        dataToUpdate.password = values.password;
    } else {
        // It's good practice to remove the password if it's public
        dataToUpdate.password = '';
    }

    updateDocumentNonBlocking(channelRef, dataToUpdate);
    
    toast({
      title: 'Channel Update Initiated!',
      description: `The channel settings are being updated.`,
    });
    
    setIsSubmitting(false);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="font-headline">Edit Channel Settings</DialogTitle>
          <DialogDescription>
            Modify your channel settings. Changes will be applied immediately.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                          <RadioGroupItem value="public" id="edit-privacy-public" />
                        </FormControl>
                          <FormLabel htmlFor="edit-privacy-public" className="flex items-center gap-2 font-normal">
                          <Globe className="h-4 w-4" /> Public
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="private" id="edit-privacy-private" />
                        </FormControl>
                        <FormLabel htmlFor="edit-privacy-private" className="flex items-center gap-2 font-normal">
                          <Lock className="h-4 w-4" /> Private
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {privacyValue === 'private' && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Channel Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter a new password or leave blank" {...field} />
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
                  <FormLabel className="flex items-center gap-2"><TwitchIcon className="h-4 w-4" /> Twitch Bot Integration</FormLabel>
                  <FormControl>
                    <Input placeholder="Your Twitch username" {...field} />
                  </FormControl>
                  <FormDescription>Link a Twitch channel for song requests.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
               <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
