import type {
  AgentPersonaDefinition,
  AgentReviewPayload,
  EmotionScorePayload,
  ParallelTaskSubmissionInput
} from './types';

function formatArtifacts(input: ParallelTaskSubmissionInput): string {
  if (!input.artifacts?.length) return '无附加材料';
  return input.artifacts
    .map((artifact, index) => {
      const kind = artifact.kind ?? 'text';
      return [
        `材料 ${index + 1}`,
        `名称：${artifact.name}`,
        `类型：${kind}`,
        `内容：${artifact.content}`
      ].join('\n');
    })
    .join('\n\n');
}

export function buildAgentSystemPrompt(persona: AgentPersonaDefinition): string {
  return [
    '你是一个任务成果评审 Agent，必须始终维持指定角色的人设和语气。',
    `你的角色：${persona.publicTitle}`,
    `身份设定：${persona.identity}`,
    `说话风格：${persona.voiceStyle}`,
    `情绪偏向：${persona.emotionalBias}`,
    `重点关注：${persona.focusAreas.join('、')}`,
    `角色标签：${persona.promptTraits.join('、')}`,
    '你的职责：根据用户提交的任务成果，先给出符合角色的反馈。',
    '你必须严格基于任务目标、提交内容和附加材料判断，不要编造未给出的成果。',
    '你必须保留角色特色，但不能出现侮辱、攻击、违法或极端言论。',
    '输出必须是 JSON，不要附带 Markdown，不要加代码块。',
    '字段固定如下：',
    JSON.stringify(
      {
        agentMessage: '角色口吻下给用户的完整反馈，120到220字',
        completionAssessment: '一句话说明任务完成度',
        qualityAssessment: '一句话说明成果质量',
        highlights: ['最多3条亮点'],
        risks: ['最多3条风险或不足'],
        nextAction: '一个最优先的下一步建议'
      },
      null,
      2
    ),
    '要求：highlights 和 risks 至少各 1 条，最多 3 条；不要输出多余字段。'
  ].join('\n');
}

export function buildAgentUserPrompt(input: ParallelTaskSubmissionInput): string {
  return [
    '请评审以下任务成果。',
    '',
    `任务标题：${input.taskTitle}`,
    `任务描述：${input.taskDescription}`,
    `预期结果：${input.expectedOutcome ?? '未提供'}`,
    `用户摘要：${input.submissionSummary ?? '未提供'}`,
    `用户正文：${input.submissionContent}`,
    `补充标准：${input.customRubric ?? '未提供'}`,
    '',
    '附加材料：',
    formatArtifacts(input),
    '',
    '请输出严格 JSON。'
  ].join('\n');
}

export function buildScoringSystemPrompt(): string {
  return [
    '你是第二层评审评分器，不扮演角色，只做严格评分。',
    '你将看到任务信息、用户提交内容，以及某个角色 Agent 的反馈结果。',
    '你必须根据以下三项给分：',
    '1. completionScore：任务完成度，0 到 100。',
    '2. qualityScore：成果质量，0 到 100。',
    '3. emotionScore：该角色反馈给用户的情绪倾向，-5 到 +5。',
    '评分原则：',
    '- completionScore 看目标是否达成、关键步骤是否完成。',
    '- qualityScore 看质量、清晰度、可信度、严谨性。',
    '- emotionScore 只评价该角色反馈的情绪色彩，不评价用户情绪。',
    '- emotionScore 越负代表越苛刻、失望、打压；越正代表越支持、欣赏、鼓励。',
    '输出必须是 JSON，不要加 Markdown，不要多余解释。',
    '字段固定如下：',
    JSON.stringify(
      {
        completionScore: 78,
        qualityScore: 73,
        emotionScore: 1,
        emotionLabel: 'slightly_positive',
        rationale: '简要说明为什么这样打分，50到120字'
      },
      null,
      2
    ),
    'emotionLabel 只能是 negative、slightly_negative、neutral、slightly_positive、positive 之一。'
  ].join('\n');
}

export function buildScoringUserPrompt(
  input: ParallelTaskSubmissionInput,
  persona: AgentPersonaDefinition,
  review: AgentReviewPayload
): string {
  return [
    `任务标题：${input.taskTitle}`,
    `任务描述：${input.taskDescription}`,
    `预期结果：${input.expectedOutcome ?? '未提供'}`,
    `用户摘要：${input.submissionSummary ?? '未提供'}`,
    `用户正文：${input.submissionContent}`,
    `补充标准：${input.customRubric ?? '未提供'}`,
    '',
    `角色：${persona.publicTitle}`,
    '角色反馈 JSON：',
    JSON.stringify(review, null, 2),
    '',
    '请据此输出评分 JSON。'
  ].join('\n');
}

export function buildFallbackReview(): AgentReviewPayload {
  return {
    agentMessage: '当前角色评审生成失败，建议稍后重试。',
    completionAssessment: '暂未评分',
    qualityAssessment: '暂未评分',
    highlights: ['评审过程失败，未得到稳定结论'],
    risks: ['需要重新执行该角色评审'],
    nextAction: '请稍后重新提交该任务成果'
  };
}

export function buildFallbackScore(): EmotionScorePayload {
  return {
    completionScore: 0,
    qualityScore: 0,
    emotionScore: 0,
    emotionLabel: 'neutral',
    rationale: '评分过程失败，已回退为中性占位。'
  };
}
