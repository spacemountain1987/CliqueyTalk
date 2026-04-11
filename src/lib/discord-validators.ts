/**
 * Shared validation helpers for Discord API routes.
 *
 * Discord "snowflake" IDs are numeric strings between 17 and 20 digits.
 * These helpers keep validation consistent across all API routes.
 */

const SNOWFLAKE_RE = /^\d{17,20}$/;

/** Returns `true` when `value` looks like a valid Discord snowflake ID. */
export function isValidSnowflake(value: string): boolean {
  return SNOWFLAKE_RE.test(value);
}

/**
 * Validates that a secret fetched at runtime is a usable, non-empty string.
 * `getLatestSecretCached` may return an empty string during the Next.js build
 * phase; this guard catches that case at request time.
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

const DISCORD_WEBHOOK_URL_RE =
  /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/.+$/;

/** Returns `true` when `url` points to a Discord webhook endpoint. */
export function isValidDiscordWebhookUrl(url: string): boolean {
  return DISCORD_WEBHOOK_URL_RE.test(url);
}
