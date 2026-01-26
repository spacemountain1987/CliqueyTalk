
'use client';

import { ChannelWidget } from "@/components/overlay/channel-widget";
import { useSearchParams } from "next/navigation";
import { ClientOnly } from "@/components/util/client-only";
import { useDoc, useFirebase, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { useMemo, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { FirebaseClientProvider } from "@/firebase/client-provider";

function OverlayContent() {
    const searchParams = useSearchParams();
    const { firestore } = useFirebase();
    const channelId = searchParams.get('channelId');

    const channelRef = useMemoFirebase(() => {
        if (!firestore || !channelId) return null;
        return doc(firestore, 'voice_channels', channelId);
    }, [firestore, channelId]);

    const {data: channel, isLoading} = useDoc<any>(channelRef);


    if (!channelId) {
        return <div className="flex items-center justify-center h-full text-white bg-red-500 text-lg p-4">No Channel ID provided in the URL.</div>;
    }

    if (isLoading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-white" /></div>
    }

    if (!channel) {
        return <div className="flex items-center justify-center h-full text-white bg-red-500 text-lg p-4">Channel not found. Check the ID or permissions.</div>;
    }

    return (
        <div className="h-screen w-screen bg-transparent">
            <ChannelWidget channel={channel} />
        </div>
    );
}

function OverlayLoading() {
    return (
        <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
    )
}


export default function OverlayPage() {
    return (
      <ClientOnly>
        <FirebaseClientProvider>
            <Suspense fallback={<OverlayLoading />}>
                <OverlayContent />
            </Suspense>
        </FirebaseClientProvider>
      </ClientOnly>
    )
}

    