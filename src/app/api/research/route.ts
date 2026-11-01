import { NextResponse } from 'next/server';
import { mastra } from '@/mastra';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json() as { event?: unknown };
    if (typeof body.event !== 'string' || body.event.trim().length < 3 || body.event.length > 300) {
      return NextResponse.json({ error: 'Enter an event between 3 and 300 characters.' }, { status: 400 });
    }

    const workflow = mastra.getWorkflow('daybackResearchWorkflow');
    const run = await workflow.createRun();
    const result = await run.start({ inputData: { eventInput: body.event.trim() } });

    if (result.status !== 'success') {
      return NextResponse.json({ error: 'The research workflow did not complete.', details: result }, { status: 502 });
    }

    return NextResponse.json(result.result);
  } catch (error) {
    console.error('[DAYBACK research]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unexpected research error.' }, { status: 500 });
  }
}
