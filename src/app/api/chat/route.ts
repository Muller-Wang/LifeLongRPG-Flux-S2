import { NextRequest, NextResponse } from 'next/server';
import { runChat, runChatStream } from '@/lib/chat/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/chat
 *
 * 入参：
 *   { userId: string, message: string, scene?: string, model?: string, debug?: boolean, stream?: boolean }
 *
 * stream=false（默认）：返回 JSON
 *   { reply, stage, memoryUsed, emotion, debug? }
 *
 * stream=true：返回 application/x-ndjson 流，每行一个 JSON 事件
 *   {"type":"meta", stage, memoryUsed, debug?}
 *   {"type":"reasoning", delta}      ← 推理模型的思维链（前端可丢弃）
 *   {"type":"token", delta}          ← 最终回答增量
 *   {"type":"done", reply, emotion}
 *   {"type":"error", message}        ← 出错时
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { userId, message, scene, model, debug, stream } = body ?? {};
  if (typeof userId !== 'string' || typeof message !== 'string') {
    return NextResponse.json(
      { error: 'missing_userId_or_message' },
      { status: 400 }
    );
  }
  if (!message.trim()) {
    return NextResponse.json({ error: 'empty_message' }, { status: 400 });
  }

  const opts = {
    userId,
    message,
    scene: typeof scene === 'string' ? scene : undefined,
    model: typeof model === 'string' ? model : undefined,
    debug: debug === true
  };

  if (stream === true) {
    return streamResponse(opts);
  }

  try {
    const result = await runChat(opts);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[api/chat]', err);
    return NextResponse.json(
      { error: 'internal_error', detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

function streamResponse(opts: Parameters<typeof runChatStream>[0]): Response {
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const ev of runChatStream(opts)) {
          controller.enqueue(encoder.encode(JSON.stringify(ev) + '\n'));
        }
      } catch (err: any) {
        console.error('[api/chat stream]', err);
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: 'error',
              message: err?.message ?? String(err)
            }) + '\n'
          )
        );
      } finally {
        controller.close();
      }
    }
  });

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no'
    }
  });
}
