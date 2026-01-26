# Copilot instructions (CliqueyTalk)

## Big picture
- Next.js App Router project under `src/app/` with route groups:
  - `src/app/(auth)/` for login pages.
  - `src/app/(app)/` for the authenticated app shell (sidebar/header/chat).
  - Server endpoints live in `src/app/api/**/route.ts`.
- Firebase is the core data plane:
  - Client SDK via `src/firebase/*` + hooks (`useDoc`, `useCollection`).
  - Admin SDK for server-only work via `src/firebase/admin.ts`.

## Key flows to preserve
- **Discord login**: `src/app/api/auth/login/route.ts` + `src/app/api/auth/callback/route.ts` redirect back to `/dashboard?access_token=...`; `src/app/(app)/dashboard/page.tsx` then:
  - Fetches `/api/discord/guild` + `/api/discord/member` (bot-token calls).
  - Signs into Firebase **anonymously** and writes the user profile to `users/{discordId}`.
- **Firestore reads**: Use `useDoc` / `useCollection` from `src/firebase/firestore/*`.
  - Inputs MUST be memoized with `useMemoFirebase(...)` (from `src/firebase/provider.tsx`) or the hook will throw.
- **Firestore writes**: Prefer the non-blocking helpers in `src/firebase/non-blocking-updates.ts` (`setDocumentNonBlocking`, `updateDocumentNonBlocking`, etc.). These emit contextual errors via `src/firebase/error-emitter.ts`.
- **Global Firestore permission errors**: `src/components/FirebaseErrorListener.tsx` listens for `permission-error` and throws it to the Next.js error boundary.

## WebRTC/voice architecture
- Voice/video is WebRTC, but signaling/state is stored in Firestore.
  - Signaling logic: `src/hooks/use-webrtc.ts`.
  - UI + channel controls: `src/components/channel/voice-channel.tsx`.
  - Channel documents live under `voice_channels` (with per-channel subcollections for peers/ICE).

## Server-only patterns
- Files marked with `'use server'` are server actions/services (don’t import them into client components directly).
  - Server actions: `src/lib/actions.ts`.
  - Twitch bot: `src/services/twitch-bot.ts` (stores OAuth creds in `app_settings/twitch_bot_credentials`).
  - Audio bot / song queue: `src/lib/audio-bot-actions.ts` (queue in `music_queue`, playback state in `app_settings/audio_bot_state`).

## Secrets and configuration
- There are **two** configuration styles in use:
  - Google Secret Manager (preferred for OAuth + YouTube cookie): use `getLatestSecret()` from `src/lib/secrets.ts` (used by `src/app/api/auth/**` and `src/app/api/youtube/**`).
  - Plain env vars for some server routes (e.g. Discord bot routes): `src/app/api/discord/guild/route.ts` and `src/app/api/discord/member/route.ts`.
- App Hosting config is in `apphosting.yaml` and uses a Docker build (`Dockerfile`, Node 20).
- Firebase emulators: client initialization checks `NEXT_PUBLIC_USE_EMULATORS === 'true'` in `src/firebase/index.ts`.

## Local development (supported)
- This repo is designed to run locally/IDX via `npm run dev` (see `.idx/dev.nix`). It is **not** App Hosting only.
- For server routes that call Google Secret Manager (`getLatestSecret`), local dev requires Application Default Credentials (ADC).
  - Typical setup: install `gcloud`, run `gcloud auth application-default login`, and ensure `GCP_PROJECT` points at the correct project (defaults in `src/lib/secrets.ts`).
  - If ADC is missing, Secret Manager-backed routes will fail at runtime.

## Repo-specific gotchas
- Historically, `.gitignore` ignored `*.json`, which could hide files like `package.json` / `tsconfig.json`. This has been narrowed to only ignore common service account key patterns.
- `next.config.ts` currently ignores TypeScript and ESLint errors during builds; still keep types correct when modifying shared hooks/services.

## Additional must-not-break flows
- **Overlay**: `/overlay?channelId=...` reads Firestore `voice_channels/{channelId}` and is sensitive to `useMemoFirebase` + hook behavior.
- **Chat popout**: `/chat-popout` renders the mod chat panel in a popup layout.

## When editing/adding code
- Prefer reusing existing shadcn-style UI primitives in `src/components/ui/*` and `cn()` from `src/lib/utils.ts`.
- For Firestore queries/refs in React, always wrap in `useMemoFirebase(() => ..., [deps])` before passing into `useDoc`/`useCollection`.
- For server routes that need sensitive config, follow the Secret Manager pattern (`getLatestSecret`) unless the surrounding folder consistently uses `process.env.*`.
