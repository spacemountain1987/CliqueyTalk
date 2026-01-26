
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert } from "lucide-react";
import { usePage } from "@/context/page-context";
import { useUser } from "@/firebase";

export default function BannedPage() {
    const { toast } = useToast();
    const { addNotification } = usePage();
    const { user } = useUser();

    const handleAppeal = () => {
        // In a real app, this would trigger a more complex workflow.
        // For now, it creates a toast and a persistent notification for admins.
        addNotification({
            title: "Ban Appeal Request",
            description: `User ${user?.displayName || 'Unknown'} has requested a ban appeal.`,
        });

        toast({
            title: "Ban Appeal Requested",
            description: "An admin has been notified of your request.",
        });
    };

    return (
        <div className="flex-1 flex items-center justify-center p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                     <div className="mx-auto bg-destructive/10 rounded-full p-3 w-fit">
                        <ShieldAlert className="h-10 w-10 text-destructive" />
                    </div>
                    <CardTitle className="font-headline text-2xl mt-4">You Have Been Banned</CardTitle>
                    <CardDescription>
                        Your account does not have permission to access this application. If you believe this is an error, you can submit an appeal.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleAppeal} className="w-full">
                        Request Ban Appeal
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
