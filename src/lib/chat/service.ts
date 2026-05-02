/**
 * 对话主流程（模块 1）
 *
 * 标准调用顺序：
 *   读好感度 → 选阶段 prompt → 触发记忆压缩（按需）→ 读活跃记忆
 *   → 选最相关记忆（程序决策，非 LLM）→ 拼装 prompt → 调 LLM → 返回
 *
 * LLM 只在最后一步出现，且输入空间被收紧到极小。
 *
 * 留白部分：
 *   - 场景路由（task_complete / absent_return / ...）当前只做 free_chat 通用入口
 *   - 表情切换映射尚未对接
 *   - 后处理（禁用词正则、句末助词）尚未对接
 */

import { getAffinity } from '../affinity/engine';
import { getStage, StageId } from '../affinity/stages';
import { getActiveMemories, markMemoryReferenced, Memory } from '../memory/store';
import { compressOldMemoriesIfNeeded } from '../memory/compressor';
import { callLLM, callLLMStream } from '../llm';
import { parseEmotion } from '../emotion-map';
import {
  getDialogueTemplate,
  logDialogueTurn,
  logUtterance
} from '../dialogue/store';
import { touchUser } from '../user/store';

// ───────────────────────────────────────────────
// 公共接口
// ───────────────────────────────────────────────

export interface ChatInput {
  userId: string;
  message: string;
  scene?: string;
  /** 模型 override，不传则用环境变量 */
  model?: string;
  /** 调试模式：返回中间状态 */
  debug?: boolean;
}

export interface ChatResult {
  reply: string;
  stage: { id: StageId; name: string; score: number };
  memoryUsed: { id: string; content: string } | null;
  emotion: string | null;
  debug?: {
    systemPrompt: string;
    userPrompt: string;
    activeMemoryCount: number;
  };
}

// ───────────────────────────────────────────────
// 主流程
// ───────────────────────────────────────────────

export async function runChat(input: ChatInput): Promise<ChatResult> {
  const prep = await prepareChat(input);

  // 调 LLM
  const rawReply = await callLLM({
    model: input.model,
    system: prep.stage.systemPrompt,
    userMessage: prep.userPrompt,
    maxTokens: prep.maxTokens
  });

  // 解析情绪标签
  const { cleanText, emotion } = parseEmotion(rawReply);

  finalizeMemoryRef(prep.memoryRef);
  await persistDialogue({
    userId: input.userId,
    scene: prep.scene,
    stageId: prep.stage.id,
    userMessage: input.message,
    assistantReply: cleanText,
    memoryRef: prep.memoryRef,
    templateId: prep.template?.id ?? null,
    debug: input.debug
      ? {
          templateTitle: prep.template?.title ?? null,
          memoryCount: prep.memoryCount
        }
      : undefined
  });

  return {
    reply: cleanText,
    stage: { id: prep.stage.id, name: prep.stage.name, score: prep.affinityScore },
    memoryUsed: prep.memoryRef
      ? { id: prep.memoryRef.id, content: prep.memoryRef.content }
      : null,
    emotion,
    debug: input.debug
      ? {
          systemPrompt: prep.stage.systemPrompt,
          userPrompt: prep.userPrompt,
          activeMemoryCount: prep.memoryCount
        }
      : undefined
  };
}

// ───────────────────────────────────────────────
// 流式版本：先 yield 元信息，再逐 token 推送，最后 yield done
// ───────────────────────────────────────────────

export type ChatStreamEvent =
  | {
      type: 'meta';
      stage: { id: StageId; name: string; score: number };
      memoryUsed: { id: string; content: string } | null;
      debug?: ChatResult['debug'];
    }
  | { type: 'reasoning'; delta: string }
  | { type: 'token'; delta: string }
  | { type: 'done'; reply: string; emotion: string | null }
  | { type: 'error'; message: string };

export async function* runChatStream(
  input: ChatInput
): AsyncGenerator<ChatStreamEvent, void, void> {
  let prep: Awaited<ReturnType<typeof prepareChat>>;
  try {
    prep = await prepareChat(input);
  } catch (err: any) {
    yield { type: 'error', message: err?.message ?? String(err) };
    return;
  }

  yield {
    type: 'meta',
    stage: { id: prep.stage.id, name: prep.stage.name, score: prep.affinityScore },
    memoryUsed: prep.memoryRef
      ? { id: prep.memoryRef.id, content: prep.memoryRef.content }
      : null,
    debug: input.debug
      ? {
          systemPrompt: prep.stage.systemPrompt,
          userPrompt: prep.userPrompt,
          activeMemoryCount: prep.memoryCount
        }
      : undefined
  };

  let reply = '';
  try {
    const stream = callLLMStream({
      model: input.model,
      system: prep.stage.systemPrompt,
      userMessage: prep.userPrompt,
      maxTokens: prep.maxTokens
    });
    for await (const ev of stream) {
      if (ev.type === 'token') {
        reply += ev.delta;
        yield { type: 'token', delta: ev.delta };
      } else if (ev.type === 'reasoning') {
        yield { type: 'reasoning', delta: ev.delta };
      }
    }
  } catch (err: any) {
    yield { type: 'error', message: err?.message ?? String(err) };
    return;
  }

  const { cleanText, emotion } = parseEmotion(reply.trim());

  finalizeMemoryRef(prep.memoryRef);
  await persistDialogue({
    userId: input.userId,
    scene: prep.scene,
    stageId: prep.stage.id,
    userMessage: input.message,
    assistantReply: cleanText,
    memoryRef: prep.memoryRef,
    templateId: prep.template?.id ?? null,
    debug: input.debug
      ? {
          templateTitle: prep.template?.title ?? null,
          memoryCount: prep.memoryCount
        }
      : undefined
  });
  yield { type: 'done', reply: cleanText, emotion };
}

// ───────────────────────────────────────────────
// 共享前置流程
// ───────────────────────────────────────────────

async function prepareChat(input: ChatInput) {
  const scene = input.scene ?? 'free_chat';

  // 后台维护任务不阻塞首 token。
  compressOldMemoriesIfNeeded(input.userId).catch(err => {
    console.warn('[chat] 记忆压缩失败（已忽略）:', err);
  });

  const affinityPromise = getAffinity(input.userId).catch(err => {
    console.warn('[chat] 好感度读取失败，回退到默认状态（阶段 1 / score 0）:', err);
    return {
      userId: input.userId,
      score: 0,
      stage: 1 as StageId,
      updatedAt: new Date().toISOString()
    };
  });

  const memoriesPromise = getActiveMemories(input.userId, { limit: 10 }).catch(err => {
    console.warn('[chat] 记忆读取失败，使用空数组:', err);
    return [] as Awaited<ReturnType<typeof getActiveMemories>>;
  });

  // 1. 读好感度（与记忆读取并行）
  const affinity = await affinityPromise;
  const stage = getStage(affinity.stage);

  const templatePromise = getDialogueTemplate(scene, stage.id).catch(err => {
    console.warn('[chat] 模板读取失败，忽略模板层:', err);
    return null;
  });

  // 2. 模板与记忆并行收敛
  const [template, memories] = await Promise.all([templatePromise, memoriesPromise]);

  // 4. 决策记忆引用
  const memoryRef = decideMemoryReference({
    stageId: stage.id,
    userInput: input.message,
    memories
  });

  // 5. 拼装 user prompt
  const userPrompt = buildUserPrompt({
    userInput: input.message,
    memoryRef,
    activeMemories: memories,
    scene,
    templateText: template?.templateText ?? null
  });

  const maxTokens = stage.id === 1 ? 100 : stage.id === 2 ? 150 : 200;

  return {
    stage,
    scene,
    template,
    affinityScore: affinity.score,
    memoryRef,
    memoryCount: memories.length,
    userPrompt,
    maxTokens
  };
}

function finalizeMemoryRef(memoryRef: Memory | null) {
  if (!memoryRef) return;
  markMemoryReferenced(memoryRef.id).catch(err => {
    console.warn('[chat] 标记记忆引用失败（已忽略）:', err);
  });
}

// ───────────────────────────────────────────────
// 决策：是否引用记忆 + 引用哪一条
//   - 阶段 1：从不引用
//   - 阶段 2：克制引用（关键词命中 OR importance=3 才引）
//   - 阶段 3：积极引用（即使无关键词命中，也按 importance 选最高）
// ───────────────────────────────────────────────

const MEMORY_COOLDOWN_HOURS = 24;
const KEYWORD_OVERLAP_THRESHOLD = 1;  // 至少 1 个关键词命中

function decideMemoryReference(opts: {
  stageId: StageId;
  userInput: string;
  memories: Memory[];
}): Memory | null {
  if (opts.stageId === 1) return null;
  if (opts.memories.length === 0) return null;

  // 排除冷却期内已引用过的
  const now = Date.now();
  const eligible = opts.memories.filter(m => {
    if (!m.lastReferencedAt) return true;
    const diffHours =
      (now - new Date(m.lastReferencedAt).getTime()) / (1000 * 3600);
    return diffHours >= MEMORY_COOLDOWN_HOURS;
  });
  if (eligible.length === 0) return null;

  // 评分：importance × 10 + keyword_overlap × 5
  const inputTokens = tokenize(opts.userInput);
  const scored = eligible.map(m => {
    const overlap = countKeywordOverlap(tokenize(m.content), inputTokens);
    return { memory: m, score: m.importance * 10 + overlap * 5, overlap };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  // 阶段 2：必须有关键词命中或最高 importance
  if (opts.stageId === 2) {
    if (best.overlap >= KEYWORD_OVERLAP_THRESHOLD) return best.memory;
    if (best.memory.importance === 3) return best.memory;
    return null;
  }

  // 阶段 3：直接选分数最高的
  return best.memory;
}

// ───────────────────────────────────────────────
// User prompt 拼装
// ───────────────────────────────────────────────

function buildUserPrompt(opts: {
  userInput: string;
  memoryRef: Memory | null;
  activeMemories: Memory[];
  scene: string;
  templateText: string | null;
}): string {
  const parts: string[] = [];

  parts.push(`【当前场景】\n${opts.scene}`);

  if (opts.templateText) {
    parts.push(`【本场景行为模板】\n${opts.templateText}`);
  }

  if (opts.memoryRef) {
    parts.push(
      `【你记得这件事】（在合适时自然提起，不要刻意列举，不要使用引号原样照搬）：\n${opts.memoryRef.content}`
    );
  } else if (opts.activeMemories.length > 0) {
    // 不引用，但仍提供背景知识，让绯夏的语感"有锚"
    const bg = opts.activeMemories
      .slice(0, 3)
      .map(m => `- [${m.category}] ${m.content}`)
      .join('\n');
    parts.push(`【你对这个用户的背景印象】（不主动提起，仅作为语气参考）：\n${bg}`);
  }

  parts.push(`【用户这次说】\n${opts.userInput}`);
  parts.push('请按当前阶段的行为约束，输出 1-3 句绯夏的话。');

  return parts.join('\n\n');
}

async function persistDialogue(input: {
  userId: string;
  scene: string;
  stageId: StageId;
  userMessage: string;
  assistantReply: string;
  memoryRef: Memory | null;
  templateId: string | null;
  debug?: Record<string, unknown>;
}) {
  try {
    await Promise.all([
      logUtterance({
        userId: input.userId,
        scene: input.scene,
        stage: input.stageId,
        content: input.assistantReply
      }),
      logDialogueTurn({
        userId: input.userId,
        scene: input.scene,
        stage: input.stageId,
        userMessage: input.userMessage,
        assistantReply: input.assistantReply,
        memoryUsedId: input.memoryRef?.id ?? null,
        templateId: input.templateId,
        debugPayload: input.debug
      }),
      touchUser(input.userId)
    ]);
  } catch (err) {
    console.warn('[chat] 对话持久化失败（已忽略）:', err);
  }
}

// ───────────────────────────────────────────────
// 简易分词（中文按字 + 英文按 token）
// 后续可换成更好的分词器
// ───────────────────────────────────────────────

function tokenize(text: string): string[] {
  const cleaned = text.replace(/[，。！？、：；""''（）《》\s]+/g, ' ').trim();
  if (!cleaned) return [];

  const tokens: string[] = [];
  let buf = '';
  for (const ch of cleaned) {
    if (/[一-龥]/.test(ch)) {
      if (buf) { tokens.push(buf.toLowerCase()); buf = ''; }
      tokens.push(ch);
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      buf += ch;
    } else if (ch === ' ') {
      if (buf) { tokens.push(buf.toLowerCase()); buf = ''; }
    }
  }
  if (buf) tokens.push(buf.toLowerCase());
  return tokens;
}

function countKeywordOverlap(a: string[], b: string[]): number {
  const setB = new Set(b);
  let overlap = 0;
  for (const t of a) {
    if (t.length >= 2 && setB.has(t)) overlap += 1;  // 忽略单字噪音
  }
  return overlap;
}
