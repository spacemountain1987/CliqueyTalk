
'use client';

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUser } from "@/firebase";
import { Loader2 } from "lucide-react";

export default function RootPage() {
    const router = useRouter();
    const { isUserLoading } = useUser();

    useEffect(() => {
        // We just want to redirect to dashboard, which will handle auth.
        router.replace('/dashboard');
    }, [router]);

    // Show a loading spinner while redirecting to prevent flashing content
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
    );
}
