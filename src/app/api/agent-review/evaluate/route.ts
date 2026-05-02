import { NextRequest, NextResponse } from 'next/server';
import { getParallelAgentCatalog, runParallelAgentReview } from '@/lib/agent-review/service';
import type { AgentReviewApiRequest, ParallelTaskSubmissionInput } from '@/lib/agent-review/types';

export const runtime = 'nodejs';

function validateRequest(body: AgentReviewApiRequest): string | null {
  if (!body || typeof body !== 'object') {
    return 'invalid_body';
  }

  if (typeof body.taskTitle !== 'string' || !body.taskTitle.trim()) {
    return 'missing_task_title';
  }

  if (typeof body.taskDescription !== 'string' || !body.taskDescription.trim()) {
    return 'missing_task_description';
  }

  if (typeof body.submissionContent !== 'string' || !body.submissionContent.trim()) {
    return 'missing_submission_content';
  }

  if (body.artifacts && !Array.isArray(body.artifacts)) {
    return 'invalid_artifacts';
  }

  return null;
}

function sanitizeInput(body: AgentReviewApiRequest): ParallelTaskSubmissionInput {
  return {
    taskId: body.taskId?.trim() || undefined,
    userId: body.userId?.trim() || undefined,
    taskTitle: body.taskTitle.trim(),
    taskDescription: body.taskDescription.trim(),
    expectedOutcome: body.expectedOutcome?.trim() || undefined,
    submissionSummary: body.submissionSummary?.trim() || undefined,
    submissionContent: body.submissionContent.trim(),
    customRubric: body.customRubric?.trim() || undefined,
    locale: body.locale?.trim() || 'zh-CN',
    artifacts: Array.isArray(body.artifacts)
      ? body.artifacts
          .filter((item) => item && typeof item.name === 'string' && typeof item.content === 'string')
          .map((item) => ({
            name: item.name.trim(),
            kind: item.kind,
            content: item.content.trim()
          }))
      : []
  };
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: '/api/agent-review/evaluate',
    method: 'POST',
    description: '20 个并行 Agent 评审用户任务成果，再做第二层情绪/完成度/质量评分。',
    model: process.env.AGENT_REVIEW_MODEL || process.env.QWEN_MODEL || process.env.DEEPSEEK_MODEL || 'qwen-plus',
    agentCount: getParallelAgentCatalog().length,
    agents: getParallelAgentCatalog(),
    requestExample: {
      taskTitle: '完成数据库设计文档',
      taskDescription: '补齐表结构、迁移策略和风险说明',
      expectedOutcome: '给出可执行 SQL 与设计文档',
      submissionSummary: '已完成文档和 SQL 初稿',
      submissionContent: '这里填用户上传的任务成果正文',
      artifacts: [
        { name: 'design.md', kind: 'markdown', content: '# 设计文档内容' },
        { name: 'migration.sql', kind: 'text', content: 'create table ...' }
      ]
    }
  });
}

export async function POST(req: NextRequest) {
  let body: AgentReviewApiRequest;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const validationError = validateRequest(body);
  if (validationError) {
    return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
  }

  try {
    const input = sanitizeInput(body);
    const report = await runParallelAgentReview(input, {
      timeoutMs: body.timeoutMs,
      model: body.model
    });

    return NextResponse.json({ ok: true, report });
  } catch (error: any) {
    console.error('[agent-review/evaluate]', error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? String(error)
      },
      { status: 500 }
    );
  }
}
