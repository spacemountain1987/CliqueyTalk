
'use client';

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell } from "lucide-react";
import { usePage } from "@/context/page-context";
import { ScrollArea } from "../ui/scroll-area";
import { formatDistanceToNow } from "date-fns";

export function NotificationsPopover() {
    const { notifications, clearNotifications } = usePage();
    const hasNotifications = notifications.length > 0;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {hasNotifications && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                        </span>
                    )}
                    <span className="sr-only">Open notifications</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between border-b p-4">
                    <h3 className="font-semibold">Notifications</h3>
                    {hasNotifications && (
                        <Button variant="link" size="sm" className="h-auto p-0" onClick={clearNotifications}>
                            Clear All
                        </Button>
                    )}
                </div>
                <ScrollArea className="h-auto max-h-96">
                    {hasNotifications ? (
                        <div className="divide-y">
                            {notifications.map((notif) => (
                                <div key={notif.id} className="p-4 space-y-1">
                                    <p className="font-medium text-sm">{notif.title}</p>
                                    <p className="text-sm text-muted-foreground">{notif.description}</p>
                                     <p className="text-xs text-muted-foreground/70">
                                        {formatDistanceToNow(notif.createdAt, { addSuffix: true })}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="p-8 text-center text-sm text-muted-foreground">
                            You're all caught up!
                        </p>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    )
}
