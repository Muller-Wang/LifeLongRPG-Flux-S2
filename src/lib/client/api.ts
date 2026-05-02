/**
 * 前端 → 后端三模块 API 封装
 * 所有失败都返回兜底数据，不阻塞 UI
 */

export interface ChatResponse {
  reply: string;
  stage: { id: 1 | 2 | 3; name: string; score: number };
  memoryUsed: { id: string; content: string } | null;
  emotion: string | null;
}

export async function chat(
  userId: string,
  message: string,
  scene?: string
): Promise<ChatResponse> {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, message, scene })
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[api.chat] 兜底返回:', err);
    return {
      reply: '……',
      stage: { id: 1, name: '保持距离', score: 0 },
      memoryUsed: null,
      emotion: null
    };
  }
}

// ───────────────────────────────────────────────
// 流式：每个 token 即时回调，最后返回完整结果
// ───────────────────────────────────────────────

export interface ChatStreamCallbacks {
  /** 收到元信息（在第一个 token 之前调用一次）*/
  onMeta?: (meta: { stage: ChatResponse['stage']; memoryUsed: ChatResponse['memoryUsed'] }) => void;
  /** 每收到一个 content 增量调用 */
  onToken?: (delta: string) => void;
  /** 推理模型的思维链增量（默认忽略，可选用作"思考中"提示）*/
  onReasoning?: (delta: string) => void;
  /** 流式结束时调用（携带最终 emotion）*/
  onDone?: (result: { reply: string; emotion: string | null }) => void;
}

export async function chatStream(
  userId: string,
  message: string,
  sceneOrCb?: string | ChatStreamCallbacks,
  maybeCb?: ChatStreamCallbacks,
  signal?: AbortSignal
): Promise<ChatResponse> {
  const scene = typeof sceneOrCb === 'string' ? sceneOrCb : undefined;
  const cb =
    typeof sceneOrCb === 'object' && sceneOrCb !== null ? sceneOrCb : maybeCb ?? {};

  let stage: ChatResponse['stage'] = { id: 1, name: '保持距离', score: 0 };
  let memoryUsed: ChatResponse['memoryUsed'] = null;
  let emotion: string | null = null;
  let reply = '';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, message, scene, stream: true }),
      signal
    });
    if (!res.ok || !res.body) throw new Error(`status ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      // 按 \n 切分 NDJSON
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;

        let ev: any;
        try {
          ev = JSON.parse(line);
        } catch {
          continue;
        }

        if (ev.type === 'meta') {
          if (ev.stage) stage = ev.stage;
          memoryUsed = ev.memoryUsed ?? null;
          cb.onMeta?.({ stage, memoryUsed });
        } else if (ev.type === 'token') {
          if (typeof ev.delta === 'string') {
            reply += ev.delta;
            cb.onToken?.(ev.delta);
          }
        } else if (ev.type === 'reasoning') {
          if (typeof ev.delta === 'string') cb.onReasoning?.(ev.delta);
        } else if (ev.type === 'done') {
          if (typeof ev.reply === 'string' && ev.reply) reply = ev.reply;
          if (typeof ev.emotion === 'string' || ev.emotion === null) emotion = ev.emotion;
          cb.onDone?.({ reply: reply.trim(), emotion });
        } else if (ev.type === 'error') {
          throw new Error(ev.message ?? 'stream_error');
        }
      }
    }

    return { reply: reply.trim() || '……', stage, memoryUsed, emotion };
  } catch (err) {
    console.warn('[api.chatStream] 兜底返回:', err);
    return {
      reply: reply.trim() || '……',
      stage,
      memoryUsed,
      emotion
    };
  }
}

export interface AffinityState {
  userId: string;
  score: number;
  stage: 1 | 2 | 3;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  publicUid: number | null;
  displayName: string | null;
  username: string | null;
  heroId: string | null;
  currentGoal: string | null;
  points: number;
  streakCount: number;
  lastActiveAt: string;
  onboardedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export async function getAffinityState(userId: string): Promise<AffinityState> {
  try {
    const res = await fetch(`/api/affinity/event?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[api.getAffinityState] 兜底:', err);
    return { userId, score: 0, stage: 1, updatedAt: new Date().toISOString() };
  }
}

export async function triggerAffinityEvent(
  userId: string,
  eventType: string,
  context?: Record<string, unknown>
): Promise<{ delta: number; newScore: number; stageChanged: boolean } | null> {
  try {
    const res = await fetch('/api/affinity/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, eventType, context })
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[api.triggerAffinityEvent] 失败:', err);
    return null;
  }
}

export async function writeMemory(input: {
  userId: string;
  category: 'milestone' | 'confession' | 'habit' | 'quote' | 'emotion';
  content: string;
  importance?: 1 | 2 | 3;
  triggeredBy?: string;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/memory/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    return res.ok;
  } catch (err) {
    console.warn('[api.writeMemory] 失败:', err);
    return false;
  }
}

export async function bootstrapProfile(input: {
  userId: string;
  displayName?: string;
  username?: string;
  heroId?: string;
  currentGoal?: string;
  points?: number;
  streakCount?: number;
  onboarded?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<UserProfile | null> {
  try {
    const res = await fetch('/api/profile/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[api.bootstrapProfile] 失败:', err);
    return null;
  }
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(`/api/profile/bootstrap?userId=${encodeURIComponent(userId)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`status ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[api.getProfile] 失败:', err);
    return null;
  }
}

export async function getProfileByUsername(username: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(
      `/api/profile/bootstrap?username=${encodeURIComponent(username.trim().toLowerCase())}`
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`status ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[api.getProfileByUsername] 失败:', err);
    return null;
  }
}

export async function registerWithUsername(input: {
  displayName: string;
  username: string;
  password: string;
}): Promise<{ userId: string; authEmail: string; profile: UserProfile } | null> {
  try {
    const res = await fetch('/api/auth/register-username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? `status ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.warn('[api.registerWithUsername] 失败:', err);
    return null;
  }
}

export async function updateProfile(input: {
  userId: string;
  displayName?: string;
  username?: string;
  heroId?: string;
  currentGoal?: string;
  points?: number;
  streakCount?: number;
  onboarded?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<UserProfile | null> {
  return bootstrapProfile(input);
}

export async function saveQuestTree(input: {
  userId: string;
  goal: string;
  heroId?: string | null;
  mainQuests: Array<Record<string, unknown>>;
  sideQuests: Array<Record<string, unknown>>;
  subTasks: Array<Record<string, unknown>>;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/quests/tree', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    return res.ok;
  } catch (err) {
    console.warn('[api.saveQuestTree] 失败:', err);
    return false;
  }
}

export async function adminSetAffinity(
  userId: string,
  score: number
): Promise<{ score: number; stage: 1 | 2 | 3 } | null> {
  try {
    const res = await fetch('/api/admin/affinity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, score })
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[api.adminSetAffinity] 失败:', err);
    return null;
  }
}

export async function submitQuestRecord(input: {
  userId: string;
  questId: string;
  completionText: string;
  reflectionText?: string;
  futureImpactText?: string;
  pointsAwarded: number;
  reviewStatus?: string;
  aiVerdict?: string;
  triggeredEvent?: string;
  rawResult?: Record<string, unknown>;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/quests/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    return res.ok;
  } catch (err) {
    console.warn('[api.submitQuestRecord] 失败:', err);
    return false;
  }
}

// ───────────────────────────────────────────────
// 20 Agent 并行评审
// ───────────────────────────────────────────────

export interface AgentReviewRequest {
  taskTitle: string;
  taskDescription: string;
  expectedOutcome?: string;
  submissionSummary?: string;
  submissionContent: string;
}

export interface AgentReviewReportFrontend {
  ok: boolean;
  report?: {
    reviewId: string;
    durationMs: number;
    aggregate: {
      successfulAgentCount: number;
      failedAgentCount: number;
      averageEmotionScore: number;
      averageCompletionScore: number;
      averageQualityScore: number;
      emotionDistribution: {
        negative: number;
        slightly_negative: number;
        neutral: number;
        slightly_positive: number;
        positive: number;
      };
      strongestPositiveAgents: string[];
      strongestNegativeAgents: string[];
      summary: string;
      userFeedback: string;
    };
    results: Array<{
      status: 'ok' | 'error';
      agentId: string;
      trackLabel: string;
      roleName: string;
      publicTitle: string;
      review?: {
        agentMessage: string;
        completionAssessment: string;
        qualityAssessment: string;
        highlights: string[];
        risks: string[];
        nextAction: string;
      };
      score?: {
        completionScore: number;
        qualityScore: number;
        emotionScore: number;
        emotionLabel: string;
        rationale: string;
      };
      error?: string;
    }>;
  };
  error?: string;
}

export async function evaluateTask(
  input: AgentReviewRequest
): Promise<AgentReviewReportFrontend> {
  try {
    const res = await fetch('/api/agent-review/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? '评审请求失败' };
    }
    return { ok: true, report: data.report };
  } catch (err) {
    console.warn('[api.evaluateTask] 失败:', err);
    return { ok: false, error: err instanceof Error ? err.message : '网络错误' };
  }
}
