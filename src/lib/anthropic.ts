/**
 * @deprecated 兼容层 · 仅为旧 import 保底
 * 实际请使用 src/lib/llm.ts 的 callLLM()
 *
 * 项目运行时不再支持 Anthropic。
 * 此文件只保留给尚未迁移的旧引用，背后仍然走 qwen / deepseek 抽象层。
 */

import { callLLM, type LLMCallOptions } from './llm';

export type ChatCallOptions = LLMCallOptions;

/** 旧 API · 等价于 callLLM */
export async function callClaude(opts: ChatCallOptions): Promise<string> {
  return callLLM(opts);
}
