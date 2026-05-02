/**
 * 记忆压缩器
 *
 * 策略：
 * 1. 完整保留 N 天（默认 2）内的所有记忆
 * 2. N 天前的记忆 → 按 (category, 周期段) 分组
 * 3. 同组多条 → 调 LLM 合并为一句压缩描述
 * 4. 写入 compressed 条目，删除原始条目
 *
 * 调用时机：
 * - chat service 每次读记忆前按需触发（懒压缩）
 * - 也可由 cron 定期跑全量压缩
 */

import { getSupabase } from '../supabase';
import { callLLM } from '../llm';
import {
  Memory,
  MemoryCategory,
  writeCompressedMemory,
  deleteMemories
} from './store';

const RECENT_DAYS = Number(process.env.MEMORY_RECENT_DAYS ?? 2);
const MIN_BATCH = Number(process.env.MEMORY_COMPRESS_BATCH ?? 10);

interface CompressGroup {
  category: MemoryCategory;
  spanFrom: string;
  spanTo: string;
  memories: Memory[];
}

/**
 * 对某用户执行一次"按需压缩"。
 * 找出超过 RECENT_DAYS 的未压缩原始记忆，按类别分组，
 * 每组若达到 MIN_BATCH 数量则压缩。
 *
 * 返回压缩了多少条原始 → 多少条结果。
 */
export async function compressOldMemoriesIfNeeded(
  userId: string
): Promise<{ compressed: number; groups: number }> {
  const sb = getSupabase();
  const cutoff = new Date(Date.now() - RECENT_DAYS * 24 * 3600 * 1000);

  const { data, error } = await sb
    .from('memories')
    .select('*')
    .eq('user_id', userId)
    .eq('is_compressed', false)
    .lt('created_at', cutoff.toISOString())
    .order('created_at', { ascending: true });

  if (error) throw new Error(`[compressor] 查询失败: ${error.message}`);

  const candidates: Memory[] = (data ?? []).map(mapRow);
  if (candidates.length === 0) return { compressed: 0, groups: 0 };

  // 按 category 分组（每个类别独立压缩，保留语义结构）
  const groups = groupByCategory(candidates);

  let totalCompressed = 0;
  let groupsProcessed = 0;

  for (const group of groups) {
    if (group.memories.length < MIN_BATCH) continue;
    await compressOneGroup(userId, group);
    totalCompressed += group.memories.length;
    groupsProcessed += 1;
  }

  // 写压缩日志
  if (groupsProcessed > 0) {
    await sb.from('memory_compress_log').insert({
      user_id: userId,
      compressed_count: totalCompressed,
      result_id: null
    });
  }

  return { compressed: totalCompressed, groups: groupsProcessed };
}

/** 强制压缩（忽略 MIN_BATCH 阈值），用于 demo 准备或用户主动触发 */
export async function forceCompressOldMemories(
  userId: string
): Promise<{ compressed: number; groups: number }> {
  const sb = getSupabase();
  const cutoff = new Date(Date.now() - RECENT_DAYS * 24 * 3600 * 1000);

  const { data, error } = await sb
    .from('memories')
    .select('*')
    .eq('user_id', userId)
    .eq('is_compressed', false)
    .lt('created_at', cutoff.toISOString())
    .order('created_at', { ascending: true });

  if (error) throw new Error(`[compressor] 查询失败: ${error.message}`);
  const candidates: Memory[] = (data ?? []).map(mapRow);
  if (candidates.length === 0) return { compressed: 0, groups: 0 };

  const groups = groupByCategory(candidates);
  let totalCompressed = 0;

  for (const group of groups) {
    if (group.memories.length < 2) continue;  // 单条无压缩必要
    await compressOneGroup(userId, group);
    totalCompressed += group.memories.length;
  }

  return { compressed: totalCompressed, groups: groups.length };
}

// ───────────────────────────────────────────────
// 内部：分组与压缩
// ───────────────────────────────────────────────

function groupByCategory(memories: Memory[]): CompressGroup[] {
  const map = new Map<MemoryCategory, Memory[]>();
  for (const m of memories) {
    const arr = map.get(m.category) ?? [];
    arr.push(m);
    map.set(m.category, arr);
  }

  const groups: CompressGroup[] = [];
  for (const [category, list] of map) {
    if (list.length === 0) continue;
    const spanFrom = list[0].createdAt.slice(0, 10);
    const spanTo = list[list.length - 1].createdAt.slice(0, 10);
    groups.push({ category, spanFrom, spanTo, memories: list });
  }
  return groups;
}

async function compressOneGroup(
  userId: string,
  group: CompressGroup
): Promise<void> {
  const summary = await summarizeWithLLM(group);
  const importance = pickImportance(group);

  const newRow = await writeCompressedMemory({
    userId,
    content: summary,
    importance,
    sourceCount: group.memories.length,
    spanFrom: group.spanFrom,
    spanTo: group.spanTo
  });

  await deleteMemories(group.memories.map(m => m.id));

  // 删除后再写日志（避免压缩日志的 result_id 指向已被删的 ID）
  // 上面的 writeCompressedMemory 已经写了一条新 memory（compressed），
  // newRow.id 就是要保留的那条
  void newRow;
}

const COMPRESS_SYSTEM_PROMPT = `你是一个记忆压缩器。
任务：把用户的多条同类记忆合并成 1 句话（≤80 字），保留时间跨度和最关键的事实。

规则：
- 不要写"以下是合并"之类的元说明
- 用第三人称客观陈述
- 时间用具体日期范围（如"4月20-25日"）
- 不夸张、不脑补
- 直接输出合并后的那一句话，不要前缀，不要引号`;

async function summarizeWithLLM(group: CompressGroup): Promise<string> {
  const userMessage = `类别：${group.category}
时间跨度：${group.spanFrom} ~ ${group.spanTo}
共 ${group.memories.length} 条原始记忆：

${group.memories.map((m, i) => `${i + 1}. [${m.createdAt.slice(0, 10)}] ${m.content}`).join('\n')}

请用 1 句话（≤80 字）合并以上记忆，保留时间跨度。`;

  try {
    const summary = await callLLM({
      system: COMPRESS_SYSTEM_PROMPT,
      userMessage,
      maxTokens: 200,
      temperature: 0.3
    });
    return summary.length > 200 ? summary.slice(0, 200) : summary;
  } catch (err) {
    // LLM 失败兜底：用首条 + 计数拼一句客观摘要
    const first = group.memories[0]?.content ?? '';
    return `${group.spanFrom} 至 ${group.spanTo}：${group.memories.length} 条 ${group.category} 记录，开头如"${first.slice(0, 30)}"`;
  }
}

function pickImportance(group: CompressGroup): 1 | 2 | 3 {
  // 取组内最高 importance（不会丢失关键事件的份量）
  const max = Math.max(...group.memories.map(m => m.importance));
  return Math.min(3, Math.max(1, max)) as 1 | 2 | 3;
}

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
