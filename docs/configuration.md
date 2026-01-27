# Configuration (Secret Manager + ADC)

This repo is designed to run with Google Secret Manager as the source of truth for sensitive configuration.

## Local dev (recommended)

1) Install and authenticate ADC:
- Install Google Cloud SDK (gcloud) and run: `gcloud auth application-default login`
  - If you can't install gcloud, you can use a service account JSON by setting `GOOGLE_APPLICATION_CREDENTIALS`.

2) Point at the correct project:
- Set `GCP_PROJECT` to the GCP project that contains your secrets.

3) Enable Secret Manager usage in dev:
- Set `USE_SECRET_MANAGER=true`

4) Run:
- `npm run dev`

## Production (Firebase App Hosting)

- App Hosting injects Secret Manager values into runtime environment variables via [apphosting.yaml](../apphosting.yaml).
- Ensure your App Hosting runtime service account can access the referenced secrets.
- Update your Discord/Twitch OAuth redirect URLs to match your deployed `NEXT_PUBLIC_APP_URL`.

## Secrets to create in Google Secret Manager

These secret IDs are referenced directly by server routes/services:

### Discord OAuth
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`

### Twitch OAuth
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`

### Discord bot (server-to-Discord API)
- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`

### Discord interactions verification
- `DISCORD_PUBLIC_KEY`

### YouTube
- `YOUTUBE_COOKIE`

## Optional environment variables

These are helpful but not strictly required in many flows:

- `NEXT_PUBLIC_APP_URL` (e.g. `http://localhost:3000`)
  - Used to construct OAuth redirect URLs; if not set, routes use the request origin.

- `NEXT_PUBLIC_USE_EMULATORS` (`true`/`false`)
  - Turns on Firebase emulator wiring in the client.

## Notes

- If ADC isn’t configured, Secret Manager calls will fail.
- In dev, secret loading prefers Secret Manager only when `USE_SECRET_MANAGER=true` (or `GOOGLE_APPLICATION_CREDENTIALS` is set).
