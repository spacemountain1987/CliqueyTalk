
'use client';
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function ProfilePage() {
    const router = useRouter();

    useEffect(() => {
        // This page is deprecated, redirect to the new settings page.
        router.replace('/settings');
    }, [router]);

    // Show a loading spinner while redirecting.
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
    );
}
