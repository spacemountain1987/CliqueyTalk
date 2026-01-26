'use client';

import { ChatPanel } from '@/components/app/mod-chat-panel';
import { PageProvider } from '@/context/page-context';
import { ClientOnly } from '@/components/util/client-only';

export default function ChatPopoutPage() {
    return (
        <ClientOnly>
            <PageProvider>
                <div className="bg-background text-foreground h-screen w-screen overflow-hidden">
                     <ChatPanel isPopup={true} />
                </div>
            </PageProvider>
        </ClientOnly>
    );
}
