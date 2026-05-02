export type AgentTrack =
  | 'learning'
  | 'workplace'
  | 'family'
  | 'social'
  | 'spiritual';

export type AgentTrackLabel =
  | '学习路径'
  | '职场路径'
  | '家庭路径'
  | '社交路径'
  | '精神路径';

export interface AgentPersonaDefinition {
  id: string;
  track: AgentTrack;
  trackLabel: AgentTrackLabel;
  roleName: string;
  publicTitle: string;
  identity: string;
  voiceStyle: string;
  emotionalBias: string;
  focusAreas: string[];
  promptTraits: string[];
}

export interface TaskArtifactInput {
  name: string;
  kind?: 'text' | 'markdown' | 'json' | 'url' | 'file_ref';
  content: string;
}

export interface ParallelTaskSubmissionInput {
  taskId?: string;
  userId?: string;
  taskTitle: string;
  taskDescription: string;
  expectedOutcome?: string;
  submissionSummary?: string;
  submissionContent: string;
  artifacts?: TaskArtifactInput[];
  customRubric?: string;
  locale?: string;
}

export interface AgentReviewPayload {
  agentMessage: string;
  completionAssessment: string;
  qualityAssessment: string;
  highlights: string[];
  risks: string[];
  nextAction: string;
}

export interface EmotionScorePayload {
  completionScore: number;
  qualityScore: number;
  emotionScore: number;
  emotionLabel: 'negative' | 'slightly_negative' | 'neutral' | 'slightly_positive' | 'positive';
  rationale: string;
}

export interface AgentReviewSuccess {
  status: 'ok';
  agentId: string;
  track: AgentTrack;
  trackLabel: AgentTrackLabel;
  roleName: string;
  publicTitle: string;
  review: AgentReviewPayload;
  reviewRawText: string;
  score: EmotionScorePayload;
  scoreRawText: string;
}

export interface AgentReviewFailure {
  status: 'error';
  agentId: string;
  track: AgentTrack;
  trackLabel: AgentTrackLabel;
  roleName: string;
  publicTitle: string;
  errorStage: 'review' | 'score';
  error: string;
  reviewRawText?: string;
}

export type AgentReviewResult = AgentReviewSuccess | AgentReviewFailure;

export interface ParallelReviewAggregate {
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
}

export interface ParallelReviewReport {
  reviewId: string;
  model: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  task: ParallelTaskSubmissionInput;
  results: AgentReviewResult[];
  aggregate: ParallelReviewAggregate;
}

export interface ParallelReviewPersistenceAdapter {
  saveParallelReview(report: ParallelReviewReport): Promise<void>;
}

export interface ParallelReviewRunOptions {
  persistence?: ParallelReviewPersistenceAdapter;
  timeoutMs?: number;
  model?: string;
}

export interface AgentReviewApiRequest extends ParallelTaskSubmissionInput {
  timeoutMs?: number;
  model?: string;
}
