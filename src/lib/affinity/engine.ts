import { getSupabase } from '../supabase';
import {
  AFFINITY_DELTAS,
  DAILY_LIMITS,
  AffinityEventType,
  isValidEventType
} from './deltas';
import { computeStage, StageId } from './stages';
import { ensureUserProfile, touchUser } from '../user/store';

export interface AffinityState {
  userId: string;
  score: number;
  stage: StageId;
  updatedAt: string;
}

export interface AffinityChangeResult {
  applied: boolean;          // 是否真的写入（防刷可能拒绝）
  reason?: string;           // 未写入原因
  delta: number;
  oldScore: number;
  newScore: number;
  oldStage: StageId;
  newStage: StageId;
  stageChanged: boolean;
}

/** 读取用户当前好感度。不存在时初始化为阶段 1 / score=0。*/
export async function getAffinity(userId: string): Promise<AffinityState> {
  await ensureUserProfile({ id: userId });
  const sb = getSupabase();

  const { data, error } = await sb
    .from('affinity')
    .select('user_id, score, stage, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(`[affinity] 读取失败: ${error.message}`);

  if (data) {
    return {
      userId: data.user_id,
      score: data.score,
      stage: data.stage as StageId,
      updatedAt: data.updated_at
    };
  }

  // 初始化
  const { error: insertErr } = await sb
    .from('affinity')
    .insert({ user_id: userId, score: 0, stage: 1 });
  if (insertErr) throw new Error(`[affinity] 初始化失败: ${insertErr.message}`);

  return {
    userId,
    score: 0,
    stage: 1,
    updatedAt: new Date().toISOString()
  };
}

/**
 * 应用一次好感度事件。
 * 步骤：校验 → 防刷检查 → 计算新分 → 计算新阶段 → 写日志 → 更新状态。
 */
export async function applyAffinityEvent(
  userId: string,
  eventType: string,
  context?: Record<string, unknown>
): Promise<AffinityChangeResult> {
  if (!isValidEventType(eventType)) {
    throw new Error(`[affinity] 未知事件类型: ${eventType}`);
  }

  await ensureUserProfile({ id: userId });
  const sb = getSupabase();
  const current = await getAffinity(userId);
  const delta = AFFINITY_DELTAS[eventType];

  // 防刷：检查每日上限
  const dailyLimit = DAILY_LIMITS[eventType];
  if (dailyLimit !== undefined) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count, error: countErr } = await sb
      .from('affinity_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_type', eventType)
      .gte('created_at', today.toISOString());

    if (countErr) {
      throw new Error(`[affinity] 防刷查询失败: ${countErr.message}`);
    }

    if ((count ?? 0) >= dailyLimit) {
      return {
        applied: false,
        reason: `daily_limit_reached:${eventType}=${dailyLimit}`,
        delta: 0,
        oldScore: current.score,
        newScore: current.score,
        oldStage: current.stage,
        newStage: current.stage,
        stageChanged: false
      };
    }
  }

  // 特殊：absent_30d 强制清零
  let newScore: number;
  if (eventType === 'absent_30d') {
    newScore = 0;
  } else {
    newScore = Math.max(0, Math.min(100, current.score + delta));
  }
  const newStage = computeStage(newScore);

  // 写事件日志
  const { error: logErr } = await sb.from('affinity_events').insert({
    user_id: userId,
    event_type: eventType,
    delta,
    context: context ?? null
  });
  if (logErr) throw new Error(`[affinity] 事件日志写入失败: ${logErr.message}`);

  // 更新状态
  const { error: updateErr } = await sb
    .from('affinity')
    .update({
      score: newScore,
      stage: newStage,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  if (updateErr) throw new Error(`[affinity] 更新失败: ${updateErr.message}`);
  await touchUser(userId);

  return {
    applied: true,
    delta: newScore - current.score,
    oldScore: current.score,
    newScore,
    oldStage: current.stage,
    newStage,
    stageChanged: newStage !== current.stage
  };
}
