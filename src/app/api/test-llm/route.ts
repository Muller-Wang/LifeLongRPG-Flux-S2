/**
 * /api/test-llm
 *
 * 最小化 LLM 健康检查端点。
 * 不读 Supabase、不查记忆、不计算好感度——直接调 callLLM。
 *
 * 用法：
 *   GET  /api/test-llm                 → 显示当前 provider 和 model
 *   POST /api/test-llm                 → { message: "...", system?: "..." }
 *
 * 本端点仅用于开发/排错。生产应通过 /api/chat。
 */

import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm';

export async function GET() {
  const provider = (process.env.LLM_PROVIDER ?? 'qwen').toLowerCase();
  const model =
    provider === 'deepseek'
      ? process.env.DEEPSEEK_MODEL ?? 'deepseek-chat'
      : process.env.QWEN_MODEL ?? 'qwen-plus';
  const baseURL =
    provider === 'qwen'
      ? process.env.QWEN_BASE_URL ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      : process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1';

  return NextResponse.json({
    status: 'ready',
    provider,
    model,
    baseURL,
    usage: 'POST { "message": "你好", "system"?: "..." }'
  });
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { message, system } = body ?? {};
  if (typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'missing_message' }, { status: 400 });
  }

  const provider = (process.env.LLM_PROVIDER ?? 'qwen').toLowerCase();

  try {
    const reply = await callLLM({
      system: system || '你是一个简洁的助手，用一两句话回答。不要展开。',
      userMessage: message,
      maxTokens: 200
    });
    return NextResponse.json({ provider, reply, ok: true });
  } catch (err: any) {
    console.error('[test-llm]', err);
    return NextResponse.json(
      {
        ok: false,
        provider,
        error: err?.message ?? String(err),
        hint:
          provider === 'qwen'
            ? '常见问题：模型名错误（试 qwen-plus / qwen-max）、API key 过期、网络不通阿里云域名'
            : '常见问题：模型名错误（试 deepseek-chat / deepseek-reasoner）、API key 错误、网络不通 DeepSeek 域名'
      },
      { status: 500 }
    );
  }
}
