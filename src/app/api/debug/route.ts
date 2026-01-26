
import { NextRequest, NextResponse } from 'next/server';
import { getLatestSecret } from '@/lib/secrets';

export async function GET(req: NextRequest) {
  try {
    // This route is for testing secret manager access.
    // We'll test fetching the Discord Client ID, which is a real secret.
    console.log('Attempting to fetch secret: DISCORD_CLIENT_ID');
    const secretValue = await getLatestSecret('DISCORD_CLIENT_ID');
    console.log('Successfully fetched secret.');
    
    // We don't want to expose the actual secret value, just confirm it was fetched.
    const isSecretPresent = !!secretValue;

    return NextResponse.json({
      message: 'Successfully attempted to fetch secret.',
      secretName: 'DISCORD_CLIENT_ID',
      isSecretPresent: isSecretPresent,
    });
  } catch (error: any) {
    console.error('Failed to fetch secret in debug route:', error);
    // Return the full error details for debugging
    return NextResponse.json({
        message: 'Failed to fetch secret in debug route.',
        error_message: error.message,
        error_stack: error.stack,
        error_details: JSON.stringify(error),
    }, { status: 500 });
  }
}
