import { NextResponse } from 'next/server';
import { collectSocialArchive } from '@/lib/social-search';

export const runtime = 'nodejs';
export const maxDuration = 50;

export async function POST(request: Request) {
  try {
    const body = await request.json() as { eventTitle?: unknown };
    if (typeof body.eventTitle !== 'string' || body.eventTitle.trim().length < 3 || body.eventTitle.length > 300) {
      return NextResponse.json({ error: 'Enter an event title between 3 and 300 characters.' }, { status: 400 });
    }
    const result = await collectSocialArchive(body.eventTitle.trim());
    return NextResponse.json(result);
  } catch (error) {
    console.error('[DAYBACK social research]', error);
    // Social discovery is optional: report its failure without touching the main archive.
    return NextResponse.json({
      fragments: [],
      integrations: { serpApi: Boolean(process.env.SERPAPI_API_KEY), curator: false },
      warnings: [error instanceof Error ? error.message : 'Social research could not be completed.'],
    });
  }
}
