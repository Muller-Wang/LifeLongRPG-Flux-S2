import { NextRequest, NextResponse } from 'next/server';
import { submitQuestSubmission } from '@/lib/quest/store';

const VALID_REVIEW_STATUS = new Set([
  'pending_ai',
  'accepted_manual',
  'accepted_ai',
  'rejected'
] as const);

const VALID_AI_VERDICTS = new Set([
  'pass',
  'good',
  'excellent',
  'rejected'
] as const);

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const {
    userId,
    questId,
    completionText,
    reflectionText,
    futureImpactText,
    pointsAwarded,
    reviewStatus,
    aiVerdict,
    triggeredEvent,
    rawResult
  } = body ?? {};

  if (
    typeof userId !== 'string' ||
    typeof questId !== 'string' ||
    typeof completionText !== 'string'
  ) {
    return NextResponse.json(
      { error: 'missing_userId_or_questId_or_completionText' },
      { status: 400 }
    );
  }

  if (typeof pointsAwarded !== 'number' || pointsAwarded < 0) {
    return NextResponse.json(
      { error: 'pointsAwarded_must_be_non_negative_number' },
      { status: 400 }
    );
  }

  try {
    const result = await submitQuestSubmission({
      userId,
      questId,
      completionText,
      reflectionText: typeof reflectionText === 'string' ? reflectionText : undefined,
      futureImpactText:
        typeof futureImpactText === 'string' ? futureImpactText : undefined,
      pointsAwarded,
      reviewStatus:
        typeof reviewStatus === 'string' && VALID_REVIEW_STATUS.has(reviewStatus as any)
          ? (reviewStatus as 'pending_ai' | 'accepted_manual' | 'accepted_ai' | 'rejected')
          : undefined,
      aiVerdict:
        typeof aiVerdict === 'string' && VALID_AI_VERDICTS.has(aiVerdict as any)
          ? (aiVerdict as 'pass' | 'good' | 'excellent' | 'rejected')
          : undefined,
      triggeredEvent: typeof triggeredEvent === 'string' ? triggeredEvent : undefined,
      rawResult:
        rawResult && typeof rawResult === 'object' && !Array.isArray(rawResult)
          ? rawResult
          : undefined
    });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[api/quests/submit]', err);
    return NextResponse.json(
      { error: 'internal_error', detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
