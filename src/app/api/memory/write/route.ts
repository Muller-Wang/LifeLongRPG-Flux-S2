import { NextRequest, NextResponse } from 'next/server';
import {
  writeMemory,
  getActiveMemories,
  MemoryCategory
} from '@/lib/memory/store';
import {
  compressOldMemoriesIfNeeded,
  forceCompressOldMemories
} from '@/lib/memory/compressor';

const VALID_CATEGORIES: MemoryCategory[] = [
  'milestone',
  'confession',
  'habit',
  'quote',
  'emotion'
  // 不允许外部直接写 'compressed' 类别
];

/**
 * POST /api/memory/write
 *
 * 入参：
 *   { userId, category, content, importance?, triggeredBy? }
 *
 * 出参：
 *   写入后的 Memory 对象
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { userId, category, content, importance, triggeredBy } = body ?? {};

  if (typeof userId !== 'string' || typeof content !== 'string') {
    return NextResponse.json(
      { error: 'missing_userId_or_content' },
      { status: 400 }
    );
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: 'invalid_category', valid: VALID_CATEGORIES },
      { status: 400 }
    );
  }
  if (importance !== undefined && ![1, 2, 3].includes(importance)) {
    return NextResponse.json(
      { error: 'importance_must_be_1_2_3' },
      { status: 400 }
    );
  }
  if (content.length === 0 || content.length > 200) {
    return NextResponse.json(
      { error: 'content_length_1_to_200' },
      { status: 400 }
    );
  }

  try {
    const memory = await writeMemory({
      userId,
      category,
      content,
      importance: importance as 1 | 2 | 3 | undefined,
      triggeredBy: typeof triggeredBy === 'string' ? triggeredBy : undefined
    });

    // 写入后异步触发压缩（不阻塞响应）
    compressOldMemoriesIfNeeded(userId).catch(err => {
      console.warn('[memory/write] 压缩失败（已忽略）:', err);
    });

    return NextResponse.json(memory);
  } catch (err: any) {
    console.error('[api/memory/write]', err);
    return NextResponse.json(
      { error: 'internal_error', detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/memory/write?userId=xxx&limit=20
 * 查询当前活跃记忆（调试 + 演示用）
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 20);
  if (!userId) {
    return NextResponse.json({ error: 'missing_userId' }, { status: 400 });
  }
  try {
    const memories = await getActiveMemories(userId, { limit });
    return NextResponse.json({ count: memories.length, memories });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'internal_error', detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/memory/write?userId=xxx&force=true
 * 强制压缩 2 天前的记忆（手动触发）
 */
export async function DELETE(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  const force = req.nextUrl.searchParams.get('force') === 'true';
  if (!userId) {
    return NextResponse.json({ error: 'missing_userId' }, { status: 400 });
  }
  try {
    const result = force
      ? await forceCompressOldMemories(userId)
      : await compressOldMemoriesIfNeeded(userId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'internal_error', detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
