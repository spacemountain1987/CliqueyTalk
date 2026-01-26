'use client';

import { AppSidebar } from '@/components/app/app-sidebar';
import { Header } from '@/components/app/header';
import { ClientOnly } from '@/components/util/client-only';
import { SidebarProvider } from '@/components/ui/sidebar';
import { PageProvider, usePage } from '@/context/page-context';
import { cn } from '@/lib/utils';
import { ChatPanel } from '@/components/app/mod-chat-panel';
import { useUser } from '@/firebase';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

function AppContent({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const isCompact = searchParams.get('layout') === 'compact';

  const { isChatOpen } = usePage();
  const { user } = useUser();

  if (isCompact) {
    // Render only the children for compact view, no layout shell.
    return <div className="h-screen bg-background">{children}</div>;
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main
        className={cn(
          "flex-1 flex flex-col transition-all duration-300 ease-in-out",
          (isChatOpen && user) ? "md:mr-[384px]" : "md:mr-0"
        )}
      >
        <Header />
        {children}
      </main>
      {user && <ChatPanel />}
    </div>
  );
}

function CompactLayoutSuspenseWrapper({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>}>
            <AppContent>
                {children}
            </AppContent>
        </Suspense>
    );
}

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <ClientOnly>
        <PageProvider>
          <SidebarProvider>
            <CompactLayoutSuspenseWrapper>
                {children}
            </CompactLayoutSuspenseWrapper>
          </SidebarProvider>
        </PageProvider>
      </ClientOnly>
  );
}
