/**
 * LLM 客户端 · 多提供商抽象层
 *
 * 当前支持：
 * - qwen      → 通义千问（Aliyun Dashscope OpenAI 兼容接口）
 * - deepseek  → DeepSeek（OpenAI 兼容接口）
 *
 * 通过环境变量 LLM_PROVIDER 切换（默认 qwen）。
 * 上层代码只调用统一的 callLLM()，
 * 无需关心底层是哪家。
 */

import OpenAI from 'openai';

type Provider = 'qwen' | 'deepseek';

function getProvider(): Provider {
  const v = (process.env.LLM_PROVIDER ?? 'qwen').toLowerCase();
  if (v !== 'qwen' && v !== 'deepseek') {
    throw new Error(`[llm] 未知 LLM_PROVIDER: ${v}`);
  }
  return v;
}

// ───────────────────────────────────────────────
// Qwen 客户端（OpenAI 兼容）
// ───────────────────────────────────────────────
let _qwen: OpenAI | null = null;
function getQwen(): OpenAI {
  if (_qwen) return _qwen;
  const apiKey = process.env.QWEN_API_KEY;
  const baseURL =
    process.env.QWEN_BASE_URL ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  if (!apiKey) throw new Error('[llm] 缺少环境变量 QWEN_API_KEY');
  _qwen = new OpenAI({ apiKey, baseURL });
  return _qwen;
}

// ───────────────────────────────────────────────
// DeepSeek 客户端（OpenAI 兼容）
// ───────────────────────────────────────────────
let _deepseek: OpenAI | null = null;
function getDeepSeek(): OpenAI {
  if (_deepseek) return _deepseek;
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseURL = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1';
  if (!apiKey) throw new Error('[llm] 缺少环境变量 DEEPSEEK_API_KEY');
  _deepseek = new OpenAI({ apiKey, baseURL });
  return _deepseek;
}

// ───────────────────────────────────────────────
// 统一接口
// ───────────────────────────────────────────────

export interface LLMCallOptions {
  /** 模型 ID。不传则按 provider 读环境变量默认 */
  model?: string;
  /** 系统提示词 */
  system: string;
  /** 用户消息 */
  userMessage: string;
  /** 输出最大 token，默认 300 */
  maxTokens?: number;
  /** 温度，默认 0.8 */
  temperature?: number;
}

/**
 * 单次 LLM 调用，返回纯文本输出。
 * 自动按 LLM_PROVIDER 路由到 qwen 或 deepseek。
 */
export async function callLLM(opts: LLMCallOptions): Promise<string> {
  const provider = getProvider();
  const maxTokens = opts.maxTokens ?? Number(process.env.LLM_MAX_TOKENS ?? 300);
  const temperature = opts.temperature ?? Number(process.env.LLM_TEMPERATURE ?? 0.8);

  if (provider === 'qwen') {
    return callOpenAICompatible(getQwen(), 'qwen', {
      ...opts,
      maxTokens,
      temperature,
      model: opts.model || process.env.QWEN_MODEL || 'qwen-plus'
    });
  }
  return callOpenAICompatible(getDeepSeek(), 'deepseek', {
    ...opts,
    maxTokens,
    temperature,
    model: opts.model || process.env.DEEPSEEK_MODEL || 'deepseek-chat'
  });
}

// ───────────────────────────────────────────────
// 流式接口
// ───────────────────────────────────────────────

export type LLMStreamEvent =
  | { type: 'reasoning'; delta: string } // 推理模型的思维链 delta（可丢弃）
  | { type: 'token'; delta: string };    // 最终回答的 delta

/**
 * 流式 LLM 调用。按 LLM_PROVIDER 路由。
 */
export async function* callLLMStream(
  opts: LLMCallOptions
): AsyncGenerator<LLMStreamEvent, void, void> {
  const provider = getProvider();
  const maxTokens = opts.maxTokens ?? Number(process.env.LLM_MAX_TOKENS ?? 300);
  const temperature = opts.temperature ?? Number(process.env.LLM_TEMPERATURE ?? 0.8);

  if (provider === 'qwen') {
    yield* callOpenAICompatibleStream(getQwen(), 'qwen', {
      ...opts,
      maxTokens,
      temperature,
      model: opts.model || process.env.QWEN_MODEL || 'qwen-plus'
    });
    return;
  }

  yield* callOpenAICompatibleStream(getDeepSeek(), 'deepseek', {
    ...opts,
    maxTokens,
    temperature,
    model: opts.model || process.env.DEEPSEEK_MODEL || 'deepseek-chat'
  });
}

// ───────────────────────────────────────────────
// OpenAI 兼容提供商（Qwen / DeepSeek）
// ───────────────────────────────────────────────
async function callOpenAICompatible(
  client: OpenAI,
  provider: Provider,
  opts: Required<Pick<LLMCallOptions, 'maxTokens' | 'temperature' | 'model'>> & LLMCallOptions
): Promise<string> {
  const response = await client.chat.completions.create({
    model: opts.model,
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user',   content: opts.userMessage }
    ]
  });

  const text = response.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error(`[llm/${provider}] 空响应或格式异常`);
  }
  return text.trim();
}

// ───────────────────────────────────────────────
// OpenAI 兼容流式（Qwen / DeepSeek）
// reasoning_content 是兼容字段，支持的模型会先推 reasoning，再推 content。
// ───────────────────────────────────────────────
async function* callOpenAICompatibleStream(
  client: OpenAI,
  provider: Provider,
  opts: Required<Pick<LLMCallOptions, 'maxTokens' | 'temperature' | 'model'>> & LLMCallOptions
): AsyncGenerator<LLMStreamEvent, void, void> {
  const stream = await client.chat.completions.create({
    model: opts.model,
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
    stream: true,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user',   content: opts.userMessage }
    ]
  });

  let sawAnyContent = false;
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta as
      | { content?: string | null; reasoning_content?: string | null }
      | undefined;
    if (!delta) continue;

    const reasoning = delta.reasoning_content;
    if (typeof reasoning === 'string' && reasoning.length > 0) {
      yield { type: 'reasoning', delta: reasoning };
    }

    const content = delta.content;
    if (typeof content === 'string' && content.length > 0) {
      sawAnyContent = true;
      yield { type: 'token', delta: content };
    }
  }

  if (!sawAnyContent) {
    throw new Error(`[llm/${provider}] 流式响应未产出任何 content`);
  }
}

// ───────────────────────────────────────────────
// JSON 结构化输出支持
// ───────────────────────────────────────────────

/**
 * 从 LLM 返回的原始文本中提取第一个完整的 JSON 对象。
 * 支持 Markdown 代码块包裹和不包裹两种情况。
 */
export function parseJsonFromModel<T>(raw: string): T {
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fencedMatch?.[1]?.trim() || raw.trim();

  const firstBrace = source.indexOf('{');
  if (firstBrace === -1) {
    throw new Error('[llm] 模型响应中未找到 JSON 对象起始符');
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = firstBrace; i < source.length; i += 1) {
    const char = source[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;

    if (depth === 0) {
      return JSON.parse(source.slice(firstBrace, i + 1)) as T;
    }
  }

  throw new Error('[llm] 模型响应中的 JSON 对象不完整');
}

export interface LLMJsonCallOptions extends LLMCallOptions {
  /** 可选的超时毫秒数（默认 45000） */
  timeoutMs?: number;
}

/**
 * 调用 LLM 并解析 JSON 输出。
 * 在 system prompt 中自动追加 "输出必须是 JSON" 的约束。
 */
export async function callLLMJson<T>(opts: LLMJsonCallOptions): Promise<{ rawText: string; parsed: T }> {
  const systemWithJsonConstraint = opts.system + '\n\n你必须严格输出 JSON，不要附带 Markdown 代码块，不要加多余解释。';
  const timeoutMs = opts.timeoutMs ?? 45000;

  const callPromise = callLLM({
    ...opts,
    system: systemWithJsonConstraint
  });

  const text = await withTimeout(callPromise, timeoutMs, `LLM JSON 调用 ${opts.model ?? 'default'}`);
  if (!text.trim()) {
    throw new Error('[llm] JSON 调用返回空文本');
  }

  return {
    rawText: text,
    parsed: parseJsonFromModel<T>(text)
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  return new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`[llm] ${label} 超时：${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        if (timer) clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        if (timer) clearTimeout(timer);
        reject(error);
      });
  });
}
