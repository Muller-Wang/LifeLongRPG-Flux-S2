/**
 * 好感度事件 → 分值映射
 * 核心维度：用户是否「按时」完成主线/支线任务（不是完成多少，是是否按时）
 */

export type AffinityEventType =
  // 增分 · 按时性优先
  | 'daily_done_on_time'   // 按时完成每日行动
  | 'side_done_on_time'    // 按时完成支线（周级）
  | 'side_done_early'      // 提前完成支线
  | 'main_done_on_time'    // 按时完成主线（月级）
  | 'main_done_early'      // 提前完成主线
  | 'deep_reflection'      // ≥100 字 + 有反思的复盘
  | 'streak_7'             // 连续 7 天达成
  | 'streak_14'            // 连续 14 天
  | 'streak_30'            // 连续 30 天
  // 减分 · 拖延即扣分
  | 'side_overdue'         // 支线超期
  | 'main_overdue'         // 主线超期
  | 'daily_miss_3d'        // 每日行动连续 3 天未完成
  | 'absent_7d'            // 消失 7 天
  | 'absent_30d';          // 消失 30 天，强制清零

export const AFFINITY_DELTAS: Record<AffinityEventType, number> = {
  daily_done_on_time:  +2,
  side_done_on_time:   +8,
  side_done_early:    +12,
  main_done_on_time:  +20,
  main_done_early:    +30,
  deep_reflection:     +2,
  streak_7:            +5,
  streak_14:          +10,
  streak_30:          +15,
  side_overdue:        -3,
  main_overdue:       -10,
  daily_miss_3d:       -3,
  absent_7d:           -5,
  absent_30d:        -100  // 强制清零（触发"被遗忘"事件）
};

/**
 * 防刷：每日上限。每个用户每天某事件最多触发 N 次。
 * 不在表里的事件无每日上限。
 */
export const DAILY_LIMITS: Partial<Record<AffinityEventType, number>> = {
  daily_done_on_time: 2  // 每天最多 +2 上限封顶（避免水任务刷分）
};

export function isValidEventType(t: string): t is AffinityEventType {
  return t in AFFINITY_DELTAS;
}
