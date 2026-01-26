
import { NextRequest, NextResponse } from 'next/server';
import { getLatestSecret } from '@/lib/secrets';

export async function GET(req: NextRequest) {
  try {
    console.log('Attempting to fetch secret: NEXT_PUBLIC_APP_URL');
    const appUrl = await getLatestSecret('NEXT_PUBLIC_APP_URL');
    console.log('Successfully fetched secret.');
    return NextResponse.json({
      message: 'Successfully fetched secret.',
      value: appUrl,
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
