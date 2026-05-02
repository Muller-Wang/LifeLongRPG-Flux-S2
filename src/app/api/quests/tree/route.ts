import { NextRequest, NextResponse } from 'next/server';
import { getActiveQuestTree, saveQuestTree } from '@/lib/quest/store';

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { userId, goal, heroId, mainQuests, sideQuests, subTasks } = body ?? {};
  if (typeof userId !== 'string' || typeof goal !== 'string') {
    return NextResponse.json(
      { error: 'missing_userId_or_goal' },
      { status: 400 }
    );
  }

  if (!Array.isArray(mainQuests) || !Array.isArray(sideQuests) || !Array.isArray(subTasks)) {
    return NextResponse.json(
      { error: 'mainQuests_sideQuests_subTasks_must_be_arrays' },
      { status: 400 }
    );
  }

  try {
    const result = await saveQuestTree({
      userId,
      goal,
      heroId: typeof heroId === 'string' ? heroId : null,
      mainQuests,
      sideQuests,
      subTasks
    });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[api/quests/tree]', err);
    return NextResponse.json(
      { error: 'internal_error', detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'missing_userId' }, { status: 400 });
  }

  try {
    const tree = await getActiveQuestTree(userId);
    return NextResponse.json(tree ?? { tree: null });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'internal_error', detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
