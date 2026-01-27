
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const projectId = process.env.GCP_PROJECT || 'studio-2042788331-2555f';
let secretManagerClient: SecretManagerServiceClient | null = null;

function getSecretManagerClient(): SecretManagerServiceClient {
    if (!secretManagerClient) {
        secretManagerClient = new SecretManagerServiceClient();
    }
    return secretManagerClient;
}

/**
 * Fetches the latest enabled version of a secret from Google Secret Manager.
 * @param secretId The ID of the secret to fetch.
 * @returns The secret payload as a string.
 * @throws An error if the secret cannot be accessed or is empty.
 */
export async function getLatestSecret(secretId: string): Promise<string> {
    const isProduction = process.env.NODE_ENV === 'production';
    const envValue = process.env[secretId];

    const forceSecretManager = process.env.USE_SECRET_MANAGER === 'true';

    // During `next build`, routes may be evaluated for static analysis/export.
    // In production we expect secrets to be injected at runtime by the platform
    // (e.g. Firebase App Hosting via apphosting.yaml). Avoid hard failing or
    // trying Secret Manager during the build phase.
    const isNextBuildPhase =
        process.env.NEXT_PHASE === 'phase-production-build' ||
        process.env.NEXT_PHASE === 'phase-export';
    if (isNextBuildPhase && !envValue) {
        console.warn(
            `Secret '${secretId}' is not available during build; ` +
            `it must be provided at runtime (e.g. via App Hosting env injection).`
        );
        return '';
    }

    // If the secret is already injected into the environment (e.g. App Hosting), prefer it.
    // This avoids unnecessary Secret Manager calls and keeps the app running even if
    // Secret Manager APIs are temporarily unavailable.
    if (envValue && !forceSecretManager) {
        return envValue;
    }

    // During local/dev, allow Secret Manager only if explicitly enabled or credentials are present.
    const allowSecretManagerInDev =
        forceSecretManager ||
        Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);

    if (!isProduction && !allowSecretManagerInDev) {
        throw new Error(
            `Missing required config '${secretId}'. ` +
            `Set process.env.${secretId} for local dev, or set USE_SECRET_MANAGER=true and configure ADC.`
        );
    }

    try {
        const [version] = await getSecretManagerClient().accessSecretVersion({
            name: `projects/${projectId}/secrets/${secretId}/versions/latest`,
        });

        const payload = version.payload?.data?.toString();
        if (!payload) {
            throw new Error(`Secret payload for '${secretId}' is empty.`);
        }
        return payload;
    } catch (error: any) {
        // If Secret Manager isn't available (common in local dev without ADC), fall back to env vars.
        if (!isProduction && envValue) {
            console.warn(
                `Secret Manager unavailable for '${secretId}'. Falling back to process.env.${secretId}.`
            );
            return envValue;
        }

        if (error.code === 5) { // NOT_FOUND error
            console.error(`Secret ${secretId} not found in project '${projectId}'.`);
            throw new Error(`The secret '${secretId}' was not found. Please ensure it has been created in Secret Manager.`);
        }
        console.error(`Failed to access secret version for '${secretId}':`, error);
        throw new Error(
            `Could not retrieve secret '${secretId}' from Secret Manager. ` +
            `For local dev you can set process.env.${secretId} as a fallback.`
        );
    }
}

type CachedSecret = { value: string; expiresAt: number };
const secretCache = new Map<string, CachedSecret>();

/**
 * Cached wrapper around getLatestSecret to avoid repeated Secret Manager calls.
 * Cache is process-local (per server instance).
 */
export async function getLatestSecretCached(secretId: string, ttlMs = 5 * 60 * 1000): Promise<string> {
    const now = Date.now();
    const cached = secretCache.get(secretId);
    if (cached && cached.expiresAt > now) return cached.value;

    const value = await getLatestSecret(secretId);
    secretCache.set(secretId, { value, expiresAt: now + ttlMs });
    return value;
}
