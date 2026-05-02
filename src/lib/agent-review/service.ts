import { callLLMJson } from '@/lib/llm';
import { AGENT_PERSONAS, AGENT_PERSONA_MAP } from './personas';
import {
  buildAgentSystemPrompt,
  buildAgentUserPrompt,
  buildFallbackReview,
  buildFallbackScore,
  buildScoringSystemPrompt,
  buildScoringUserPrompt
} from './prompts';
import type {
  AgentReviewFailure,
  AgentReviewPayload,
  AgentReviewResult,
  AgentReviewSuccess,
  EmotionScorePayload,
  ParallelReviewAggregate,
  ParallelReviewReport,
  ParallelReviewRunOptions,
  ParallelTaskSubmissionInput
} from './types';

interface FirstLayerSuccess {
  status: 'ok';
  agentId: string;
  review: AgentReviewPayload;
  rawText: string;
}

type FirstLayerResult = FirstLayerSuccess | AgentReviewFailure;

function createReviewId(): string {
  return `agent_review_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getAgentReviewModel(explicitModel?: string): string {
  return (
    explicitModel ||
    process.env.AGENT_REVIEW_MODEL ||
    process.env.QWEN_MODEL ||
    process.env.DEEPSEEK_MODEL ||
    'qwen-plus'
  );
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampFloat(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function normalizeReviewPayload(payload: AgentReviewPayload): AgentReviewPayload {
  const safeHighlights = Array.isArray(payload.highlights)
    ? payload.highlights.filter(Boolean).slice(0, 3)
    : [];
  const safeRisks = Array.isArray(payload.risks)
    ? payload.risks.filter(Boolean).slice(0, 3)
    : [];

  return {
    agentMessage: String(payload.agentMessage ?? '').trim() || buildFallbackReview().agentMessage,
    completionAssessment:
      String(payload.completionAssessment ?? '').trim() || buildFallbackReview().completionAssessment,
    qualityAssessment:
      String(payload.qualityAssessment ?? '').trim() || buildFallbackReview().qualityAssessment,
    highlights: safeHighlights.length ? safeHighlights : buildFallbackReview().highlights,
    risks: safeRisks.length ? safeRisks : buildFallbackReview().risks,
    nextAction: String(payload.nextAction ?? '').trim() || buildFallbackReview().nextAction
  };
}

function normalizeScorePayload(payload: EmotionScorePayload): EmotionScorePayload {
  const label = payload.emotionLabel;
  const normalizedLabel = (
    label === 'negative' ||
    label === 'slightly_negative' ||
    label === 'neutral' ||
    label === 'slightly_positive' ||
    label === 'positive'
  )
    ? label
    : 'neutral';

  return {
    completionScore: clampInt(Number(payload.completionScore), 0, 100),
    qualityScore: clampInt(Number(payload.qualityScore), 0, 100),
    emotionScore: clampFloat(Number(payload.emotionScore), -5, 5),
    emotionLabel: normalizedLabel,
    rationale: String(payload.rationale ?? '').trim() || buildFallbackScore().rationale
  };
}

async function runSingleAgentReview(
  input: ParallelTaskSubmissionInput,
  agentId: string,
  model: string,
  timeoutMs?: number
): Promise<{ review: AgentReviewPayload; rawText: string }> {
  const persona = AGENT_PERSONA_MAP.get(agentId);
  if (!persona) {
    throw new Error(`未知 Agent: ${agentId}`);
  }

  const { rawText, parsed } = await callLLMJson<AgentReviewPayload>({
    model,
    timeoutMs,
    maxTokens: 900,
    temperature: 0.85,
    system: buildAgentSystemPrompt(persona),
    userMessage: buildAgentUserPrompt(input)
  });

  return {
    review: normalizeReviewPayload(parsed),
    rawText
  };
}

async function scoreSingleAgentReview(
  input: ParallelTaskSubmissionInput,
  agentId: string,
  review: AgentReviewPayload,
  model: string,
  timeoutMs?: number
): Promise<{ score: EmotionScorePayload; rawText: string }> {
  const persona = AGENT_PERSONA_MAP.get(agentId);
  if (!persona) {
    throw new Error(`未知 Agent: ${agentId}`);
  }

  const { rawText, parsed } = await callLLMJson<EmotionScorePayload>({
    model,
    timeoutMs,
    maxTokens: 450,
    temperature: 0.2,
    system: buildScoringSystemPrompt(),
    userMessage: buildScoringUserPrompt(input, persona, review)
  });

  return {
    score: normalizeScorePayload(parsed),
    rawText
  };
}

function buildFailure(agentId: string, errorStage: 'review' | 'score', error: unknown, reviewRawText?: string): AgentReviewFailure {
  const persona = AGENT_PERSONA_MAP.get(agentId);
  if (!persona) {
    throw new Error(`未知 Agent: ${agentId}`);
  }

  return {
    status: 'error',
    agentId: persona.id,
    track: persona.track,
    trackLabel: persona.trackLabel,
    roleName: persona.roleName,
    publicTitle: persona.publicTitle,
    errorStage,
    error: error instanceof Error ? error.message : String(error),
    reviewRawText
  };
}

function average(values: number[]): number {
  if (!values.length) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(2));
}

function buildAggregate(results: AgentReviewResult[]): ParallelReviewAggregate {
  const successful = results.filter((item): item is AgentReviewSuccess => item.status === 'ok');
  const emotionScores = successful.map((item) => item.score.emotionScore);
  const completionScores = successful.map((item) => item.score.completionScore);
  const qualityScores = successful.map((item) => item.score.qualityScore);

  const strongestPositiveAgents = [...successful]
    .sort((a, b) => b.score.emotionScore - a.score.emotionScore)
    .slice(0, 3)
    .map((item) => item.roleName);

  const strongestNegativeAgents = [...successful]
    .sort((a, b) => a.score.emotionScore - b.score.emotionScore)
    .slice(0, 3)
    .map((item) => item.roleName);

  const emotionDistribution = {
    negative: successful.filter((item) => item.score.emotionLabel === 'negative').length,
    slightly_negative: successful.filter((item) => item.score.emotionLabel === 'slightly_negative').length,
    neutral: successful.filter((item) => item.score.emotionLabel === 'neutral').length,
    slightly_positive: successful.filter((item) => item.score.emotionLabel === 'slightly_positive').length,
    positive: successful.filter((item) => item.score.emotionLabel === 'positive').length
  };

  const avgEmotion = average(emotionScores);
  const avgCompletion = average(completionScores);
  const avgQuality = average(qualityScores);

  const summary = [
    `共完成 ${successful.length} 个 Agent 的有效评审，失败 ${results.length - successful.length} 个。`,
    `平均完成度 ${avgCompletion} / 100，平均质量 ${avgQuality} / 100，平均情绪分 ${avgEmotion} / 5。`,
    strongestPositiveAgents.length
      ? `最积极的角色：${strongestPositiveAgents.join('、')}。`
      : '暂无积极角色结论。',
    strongestNegativeAgents.length
      ? `最严厉的角色：${strongestNegativeAgents.join('、')}。`
      : '暂无严厉角色结论。'
  ].join('');

  const feedbackTone =
    avgEmotion >= 2
      ? '整体反馈明显偏正向，说明多数角色认可这次提交。'
      : avgEmotion >= 0.5
        ? '整体反馈略偏正向，说明提交基本站得住。'
        : avgEmotion > -0.5
          ? '整体反馈接近中性，说明提交有完成，但亮点和说服力还不够稳。'
          : avgEmotion > -2
            ? '整体反馈略偏负向，说明完成度或质量存在较明显短板。'
            : '整体反馈明显偏负向，建议先补关键缺口再提交。';

  const completionTone =
    avgCompletion >= 80
      ? '从完成度看，主任务基本完成。'
      : avgCompletion >= 60
        ? '从完成度看，主任务完成过半，但仍有缺口。'
        : '从完成度看，主任务尚未达到可稳定交付。';

  const qualityTone =
    avgQuality >= 80
      ? '从质量看，成果较成熟。'
      : avgQuality >= 60
        ? '从质量看，已有基础，但还需要打磨。'
        : '从质量看，目前更像草稿或半成品。';

  return {
    successfulAgentCount: successful.length,
    failedAgentCount: results.length - successful.length,
    averageEmotionScore: avgEmotion,
    averageCompletionScore: avgCompletion,
    averageQualityScore: avgQuality,
    emotionDistribution,
    strongestPositiveAgents,
    strongestNegativeAgents,
    summary,
    userFeedback: `${feedbackTone}${completionTone}${qualityTone}`
  };
}

export async function runParallelAgentReview(
  input: ParallelTaskSubmissionInput,
  options: ParallelReviewRunOptions = {}
): Promise<ParallelReviewReport> {
  const startedAt = new Date();
  const reviewId = createReviewId();
  const model = getAgentReviewModel(options.model);

  const firstLayer = await Promise.all(
    AGENT_PERSONAS.map(async (persona): Promise<FirstLayerResult> => {
      try {
        const { review, rawText } = await runSingleAgentReview(
          input,
          persona.id,
          model,
          options.timeoutMs
        );
        return {
          status: 'ok',
          agentId: persona.id,
          review,
          rawText
        };
      } catch (error) {
        return buildFailure(persona.id, 'review', error);
      }
    })
  );

  const secondLayer = await Promise.all(
    firstLayer.map(async (item): Promise<AgentReviewResult> => {
      if (item.status === 'error') {
        return item;
      }

      const persona = AGENT_PERSONA_MAP.get(item.agentId);
      if (!persona) {
        return buildFailure(item.agentId, 'review', '未知 Agent');
      }

      try {
        const { score, rawText } = await scoreSingleAgentReview(
          input,
          item.agentId,
          item.review,
          model,
          options.timeoutMs
        );

        return {
          status: 'ok',
          agentId: persona.id,
          track: persona.track,
          trackLabel: persona.trackLabel,
          roleName: persona.roleName,
          publicTitle: persona.publicTitle,
          review: item.review,
          reviewRawText: item.rawText,
          score,
          scoreRawText: rawText
        };
      } catch (error) {
        return buildFailure(item.agentId, 'score', error, item.rawText);
      }
    })
  );

  const finishedAt = new Date();
  const report: ParallelReviewReport = {
    reviewId,
    model,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    task: input,
    results: secondLayer,
    aggregate: buildAggregate(secondLayer)
  };

  if (options.persistence) {
    await options.persistence.saveParallelReview(report);
  }

  return report;
}

export function getParallelAgentCatalog() {
  return AGENT_PERSONAS.map((persona) => ({
    id: persona.id,
    track: persona.track,
    trackLabel: persona.trackLabel,
    roleName: persona.roleName,
    publicTitle: persona.publicTitle,
    identity: persona.identity,
    voiceStyle: persona.voiceStyle,
    emotionalBias: persona.emotionalBias,
    focusAreas: persona.focusAreas
  }));
}
