
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

    // During local/dev, we default to env vars to avoid requiring ADC.
    // If you *do* want Secret Manager locally, set USE_SECRET_MANAGER=true (and configure ADC).
    const allowSecretManagerInDev =
        process.env.USE_SECRET_MANAGER === 'true' ||
        Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);

    // Local/dev convenience: allow using env vars instead of Secret Manager.
    // In production we still prefer Secret Manager for sensitive configuration.
    if (!isProduction && envValue) {
        return envValue;
    }

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
