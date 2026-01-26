
'use client';

import { AdminPanel } from "@/components/admin/admin-panel";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePage } from "@/context/page-context";
import { useUser, useDoc, useFirebase, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { ShieldAlert, Loader2 } from "lucide-react";
import { useEffect } from "react";

export default function AdminPage() {
  const { setPageTitle, discordId } = usePage();
  const { isUserLoading } = useUser();
  const { firestore } = useFirebase();

  useEffect(() => {
    setPageTitle('Admin Panel');
  }, [setPageTitle]);
  
  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !discordId) return null;
    return doc(firestore, 'users', discordId);
  }, [firestore, discordId]);

  const { data: userProfile, isLoading: isLoadingProfile } = useDoc<any>(userProfileRef);

  const isUserAdmin = userProfile?.isAdmin === true;
  const isLoading = isUserLoading || isLoadingProfile;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isUserAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <CardHeader>
            <div className="mx-auto bg-destructive/10 rounded-full p-3 w-fit">
              <ShieldAlert className="h-10 w-10 text-destructive" />
            </div>
            <CardTitle className="font-headline text-2xl mt-4">Admin Access Required</CardTitle>
            <CardDescription>
              You do not have the necessary permissions to view this page. This right is reserved for server staff. Please contact the server owner if you believe this is an error.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return <AdminPanel />;
}
