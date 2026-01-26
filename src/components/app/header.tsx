
'use client';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { usePage } from '@/context/page-context';
import { Menu, MessageSquare } from 'lucide-react';
import { AppSidebar } from './app-sidebar';
import { useUser } from '@/firebase';
import { NotificationsPopover } from './notifications-popover';

export function Header() {
  const { pageTitle, headerActions, isChatOpen, setIsChatOpen } = usePage();
  const { user } = useUser();

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] p-0">
            <AppSidebar />
          </SheetContent>
        </Sheet>
      </div>

      <h1 className="flex-1 font-headline text-2xl font-bold tracking-tight">
        {pageTitle}
      </h1>
      <div className="flex items-center gap-2">
        {headerActions}
        {user && <NotificationsPopover />}
        {user && (
           <Button variant={isChatOpen ? "secondary" : "outline"} size="icon" onClick={() => setIsChatOpen(!isChatOpen)}>
              <MessageSquare className="h-5 w-5" />
              <span className="sr-only">Toggle Chat</span>
            </Button>
        )}
      </div>
    </header>
  );
}
