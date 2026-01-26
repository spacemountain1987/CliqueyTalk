"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Drama } from "lucide-react";
import { DiscordIcon } from "../icons/discord-icon";

export function LoginForm() {

  return (
    <Card className="w-full max-w-sm shadow-2xl">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 rounded-full bg-primary/10 p-3">
            <Drama className="h-10 w-10 text-primary" />
        </div>
        <CardTitle className="font-headline text-3xl">CliqueyTalk</CardTitle>
        <CardDescription>
          Private voice channels for your clique.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button
            asChild
            className="w-full"
          >
            <a href="/api/auth/login">
              <DiscordIcon className="mr-2 h-5 w-5" />
              Login with Discord
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
