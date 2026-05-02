import { NextRequest, NextResponse } from 'next/server';
import {
  ensureUserProfile,
  getUserProfile,
  getUserProfileByUsername
} from '@/lib/user/store';

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const {
    userId,
    displayName,
    username,
    heroId,
    currentGoal,
    points,
    streakCount,
    onboarded,
    metadata
  } = body ?? {};

  if (typeof userId !== 'string' || !userId) {
    return NextResponse.json({ error: 'missing_userId' }, { status: 400 });
  }

  try {
    const profile = await ensureUserProfile({
      id: userId,
      displayName: typeof displayName === 'string' ? displayName : undefined,
      username: typeof username === 'string' ? username : undefined,
      heroId: typeof heroId === 'string' ? (heroId as any) : undefined,
      currentGoal: typeof currentGoal === 'string' ? currentGoal : undefined,
      points: typeof points === 'number' ? points : undefined,
      streakCount: typeof streakCount === 'number' ? streakCount : undefined,
      onboarded: onboarded === true,
      metadata:
        metadata && typeof metadata === 'object' && !Array.isArray(metadata)
          ? metadata
          : undefined
    });
    return NextResponse.json(profile);
  } catch (err: any) {
    console.error('[api/profile/bootstrap]', err);
    return NextResponse.json(
      { error: 'internal_error', detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  const username = req.nextUrl.searchParams.get('username');

  if (!userId && !username) {
    return NextResponse.json({ error: 'missing_userId' }, { status: 400 });
  }

  try {
    const profile = userId
      ? await getUserProfile(userId)
      : await getUserProfileByUsername(username ?? '');

    if (!profile) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json(profile);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'internal_error', detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
