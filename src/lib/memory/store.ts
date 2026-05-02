import { getSupabase } from '../supabase';
import { ensureUserProfile } from '../user/store';

export type MemoryCategory =
  | 'milestone'    // 里程碑（完成主线、streak 达成等）
  | 'confession'   // 用户在复盘里透露的情绪/价值观
  | 'habit'        // 行为规律
  | 'quote'        // 用户原话
  | 'emotion'      // 情绪事件
  | 'compressed';  // 压缩后的合并条目（由 compressor 生成）

export interface Memory {
  id: string;
  userId: string;
  category: MemoryCategory;
  content: string;
  importance: 1 | 2 | 3;
  isCompressed: boolean;
  sourceCount: number;
  triggeredBy: string | null;
  lastReferencedAt: string | null;
  createdAt: string;
}

export interface WriteMemoryInput {
  userId: string;
  category: MemoryCategory;
  content: string;             // ≤200 字
  importance?: 1 | 2 | 3;
  triggeredBy?: string;
}

/** 写入一条新记忆 */
export async function writeMemory(input: WriteMemoryInput): Promise<Memory> {
  if (input.content.length > 200) {
    throw new Error('[memory] content 超过 200 字上限');
  }
  await ensureUserProfile({ id: input.userId });
  const sb = getSupabase();
  const { data, error } = await sb
    .from('memories')
    .insert({
      user_id: input.userId,
      category: input.category,
      content: input.content,
      importance: input.importance ?? 2,
      triggered_by: input.triggeredBy ?? null,
      is_compressed: false,
      source_count: 1
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`[memory] 写入失败: ${error?.message}`);
  }

  return mapRow(data);
}

/**
 * 读取用户的活跃记忆。
 * 默认返回：完整保留段（最近 N 天）+ 已压缩条目。
 * 上层（chat service）会据此决定是否引用以及引用哪条。
 */
export async function getActiveMemories(
  userId: string,
  opts: { limit?: number } = {}
): Promise<Memory[]> {
  const sb = getSupabase();
  const limit = opts.limit ?? 20;

  const { data, error } = await sb
    .from('memories')
    .select('*')
    .eq('user_id', userId)
    .order('importance', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`[memory] 读取失败: ${error.message}`);
  return (data ?? []).map(mapRow);
}

/** 标记一条记忆"刚被引用"，用于频率控制 */
export async function markMemoryReferenced(memoryId: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from('memories')
    .update({ last_referenced_at: new Date().toISOString() })
    .eq('id', memoryId);
  if (error) throw new Error(`[memory] 标记引用失败: ${error.message}`);
}

/** 删除多条记忆（用于压缩后替换原始条目）*/
export async function deleteMemories(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const sb = getSupabase();
  const { error } = await sb.from('memories').delete().in('id', ids);
  if (error) throw new Error(`[memory] 批量删除失败: ${error.message}`);
}

/** 写入压缩条目（compressor 专用）*/
export async function writeCompressedMemory(input: {
  userId: string;
  content: string;
  importance: 1 | 2 | 3;
  sourceCount: number;
  spanFrom: string;
  spanTo: string;
}): Promise<Memory> {
  await ensureUserProfile({ id: input.userId });
  const sb = getSupabase();
  const { data, error } = await sb
    .from('memories')
    .insert({
      user_id: input.userId,
      category: 'compressed',
      content: input.content,
      importance: input.importance,
      is_compressed: true,
      source_count: input.sourceCount,
      triggered_by: `compress:${input.spanFrom}~${input.spanTo}`
    })
    .select()
    .single();
  if (error || !data) {
    throw new Error(`[memory] 压缩条目写入失败: ${error?.message}`);
  }
  return mapRow(data);
}

// ───────────────────────────────────────────────
// 辅助：DB row → Memory
// ───────────────────────────────────────────────
function mapRow(row: any): Memory {
  return {
    id: row.id,
    userId: row.user_id,
    category: row.category,
    content: row.content,
    importance: row.importance,
    isCompressed: row.is_compressed,
    sourceCount: row.source_count,
    triggeredBy: row.triggered_by,
    lastReferencedAt: row.last_referenced_at,
    createdAt: row.created_at
  };
}
