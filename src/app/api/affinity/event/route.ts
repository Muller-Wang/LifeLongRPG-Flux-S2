import { NextRequest, NextResponse } from 'next/server';
import { applyAffinityEvent, getAffinity } from '@/lib/affinity/engine';

/**
 * POST /api/affinity/event
 *
 * 入参：
 *   { userId: string, eventType: string, context?: object }
 *
 * 出参：
 *   { applied, delta, oldScore, newScore, oldStage, newStage, stageChanged, reason? }
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { userId, eventType, context } = body ?? {};
  if (typeof userId !== 'string' || typeof eventType !== 'string') {
    return NextResponse.json(
      { error: 'missing_userId_or_eventType' },
      { status: 400 }
    );
  }

  try {
    const result = await applyAffinityEvent(userId, eventType, context);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[api/affinity/event]', err);
    return NextResponse.json(
      { error: 'internal_error', detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/affinity/event?userId=xxx
 * 用于查询当前好感度状态（调试 + 演示用）
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'missing_userId' }, { status: 400 });
  }
  try {
    const state = await getAffinity(userId);
    return NextResponse.json(state);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'internal_error', detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
