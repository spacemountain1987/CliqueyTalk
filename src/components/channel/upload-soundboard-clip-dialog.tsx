
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
import { Loader2, Music, Upload } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore } from '@/firebase/provider';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, serverTimestamp } from 'firebase/firestore';
import { usePage } from '@/context/page-context';

const formSchema = z.object({
  name: z.string().min(2, 'Clip name must be at least 2 characters long.').max(30, 'Clip name must be 30 characters or less.'),
  audioFile: z.instanceof(FileList)
    .refine(files => files?.length === 1, 'Audio file is required.')
    .refine(files => files?.[0]?.size <= 2 * 1024 * 1024, `Max file size is 2MB.`)
    .refine(
      files => ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a'].includes(files?.[0]?.type),
      'Only .mp3, .wav, .ogg, or .m4a files are accepted.'
    ),
});

type FormValues = z.infer<typeof formSchema>;

export function UploadSoundboardClipDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { discordId } = usePage();
  const firestore = useFirestore();

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    if (!discordId || !firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to upload.' });
      return;
    }

    try {
      const file = data.audioFile[0];
      
      // 1. Get the signed URL from our server
      const signedUrlResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          contentType: file.type,
          destination: 'soundboard',
        }),
      });

      if (!signedUrlResponse.ok) {
        const errorData = await signedUrlResponse.json();
        throw new Error(errorData.error || 'Could not get an upload URL.');
      }

      const { signedUrl, storagePath } = await signedUrlResponse.json();

      // 2. Upload the file directly to Google Cloud Storage
      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('File upload to storage failed.');
      }
      
      // 3. Add document to Firestore
      const newClip = {
        name: data.name,
        storagePath: storagePath,
        creatorId: discordId,
        createdAt: serverTimestamp(),
      };
      
      const clipsCollection = collection(firestore, 'soundboard_clips');
      addDocumentNonBlocking(clipsCollection, newClip);

      toast({
        title: 'Upload Successful',
        description: `"${data.name}" has been added to the soundboard.`,
      });
      
      reset();
      setOpen(false);

    } catch (error: any) {
      console.error("Error uploading clip:", error);
      toast({ variant: 'destructive', title: 'Upload Failed', description: error.message || 'An unexpected error occurred.' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
            <Upload className="mr-2 h-4 w-4"/>
            Upload Clip
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline">Upload Soundboard Clip</DialogTitle>
          <DialogDescription>
            Upload a short audio file (.mp3, .wav, .ogg, .m4a). Max 2MB.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
                <Label htmlFor="name">Clip Name</Label>
                <Input id="name" {...register('name')} />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
            </div>
             <div>
                <Label htmlFor="audioFile">Audio File</Label>
                <Input id="audioFile" type="file" accept="audio/mpeg,audio/wav,audio/ogg,audio/mp3,audio/mp4,audio/x-m4a,.m4a" {...register('audioFile')} />
                {errors.audioFile && <p className="text-sm text-destructive mt-1">{errors.audioFile.message}</p>}
            </div>
            <DialogFooter>
               <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Music className="mr-2 h-4 w-4" />}
                Save Clip
              </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
