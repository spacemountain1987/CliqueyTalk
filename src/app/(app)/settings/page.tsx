
'use client';

import { usePage } from '@/context/page-context';
import { useUser, useFirestore, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Check, Twitch } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { TwitchIcon } from '@/components/icons/twitch-icon';

export default function SettingsPage() {
  const { setPageTitle } = usePage();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { discordId } = usePage();
  const { toast } = useToast();

  const [twitchChannel, setTwitchChannel] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setPageTitle('My Settings');
  }, [setPageTitle]);

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !discordId) return null;
    return doc(firestore, 'users', discordId);
  }, [firestore, discordId]);

  const { data: userProfile, isLoading: isLoadingProfile } = useDoc<any>(userProfileRef);

  useEffect(() => {
    if (userProfile?.preferences?.twitchChannel) {
      setTwitchChannel(userProfile.preferences.twitchChannel);
    }
  }, [userProfile]);

  const handleSave = () => {
    if (!userProfileRef) return;
    setIsSaving(true);
    
    updateDocumentNonBlocking(userProfileRef, {
        'preferences.twitchChannel': twitchChannel,
    });
    
    toast({
        title: "Settings Saved",
        description: "Your preferences have been updated.",
    });

    setIsSaving(false);
  };
  
  const isLoading = isUserLoading || isLoadingProfile;

  if (isLoading) {
    return (
        <div className="p-4 md:p-6 space-y-4">
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-10 w-full" />
                </CardContent>
                <CardFooter>
                     <Skeleton className="h-10 w-24" />
                </CardFooter>
            </Card>
        </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>My Settings</CardTitle>
          <CardDescription>
            Manage your personal settings for the CliqueyTalk application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="twitch-channel-pref" className="flex items-center gap-2"><TwitchIcon className="h-4 w-4" /> Personal Twitch Chat</Label>
                <Input 
                    id="twitch-channel-pref" 
                    placeholder="Your Twitch username" 
                    value={twitchChannel} 
                    onChange={(e) => setTwitchChannel(e.target.value)} 
                />
                <p className="text-xs text-muted-foreground">
                    This sets the default Twitch chat to show in the side panel.
                </p>
            </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Save Settings
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
