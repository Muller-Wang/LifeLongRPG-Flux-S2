import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { computeStage } from '@/lib/affinity/stages';
import { ensureUserProfile, touchUser } from '@/lib/user/store';

/**
 * POST /api/admin/affinity
 *
 * 调试后台用：直接 set 好感度 score（绕过事件机制 + 防刷）。
 *
 * 入参：{ userId: string, score: number }
 * 出参：{ score: number, stage: 1 | 2 | 3 }
 *
 * ⚠️ Beta 阶段不做权限校验。生产环境必须加管理员鉴权。
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { userId, score } = body ?? {};
  if (typeof userId !== 'string' || !userId) {
    return NextResponse.json({ error: 'missing_userId' }, { status: 400 });
  }
  if (typeof score !== 'number' || Number.isNaN(score)) {
    return NextResponse.json({ error: 'missing_or_invalid_score' }, { status: 400 });
  }

  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  const stage = computeStage(safeScore);

  try {
    await ensureUserProfile({ id: userId });
    const sb = getSupabase();
    const now = new Date().toISOString();

    const { error } = await sb
      .from('affinity')
      .upsert(
        { user_id: userId, score: safeScore, stage, updated_at: now },
        { onConflict: 'user_id' }
      );
    if (error) {
      throw new Error(`affinity upsert 失败: ${error.message}`);
    }

    // 调试事件日志（best-effort，约束失败也不阻塞）
    try {
      await sb.from('affinity_events').insert({
        user_id: userId,
        event_type: 'admin_set',
        delta: 0,
        context: { adminScore: safeScore, stage }
      });
    } catch (logErr) {
      console.warn('[admin/affinity] 日志写入失败（已忽略）:', logErr);
    }

    await touchUser(userId);

    return NextResponse.json({ score: safeScore, stage });
  } catch (err: any) {
    console.error('[api/admin/affinity]', err);
    return NextResponse.json(
      { error: 'internal_error', detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
