
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const projectId = process.env.GCP_PROJECT || 'studio-2042788331-2555f';
const secretManagerClient = new SecretManagerServiceClient();

/**
 * Fetches the latest enabled version of a secret from Google Secret Manager.
 * @param secretId The ID of the secret to fetch.
 * @returns The secret payload as a string.
 * @throws An error if the secret cannot be accessed or is empty.
 */
export async function getLatestSecret(secretId: string): Promise<string> {
    try {
        const [version] = await secretManagerClient.accessSecretVersion({
            name: `projects/${projectId}/secrets/${secretId}/versions/latest`,
        });

        const payload = version.payload?.data?.toString();
        if (!payload) {
            throw new Error(`Secret payload for '${secretId}' is empty.`);
        }
        return payload;
    } catch (error: any) {
        if (error.code === 5) { // NOT_FOUND error
            console.error(`Secret ${secretId} not found in project '${projectId}'.`);
            throw new Error(`The secret '${secretId}' was not found. Please ensure it has been created in Secret Manager.`);
        }
        console.error(`Failed to access secret version for '${secretId}':`, error);
        throw new Error(`Could not retrieve secret '${secretId}' from Secret Manager.`);
    }
}
