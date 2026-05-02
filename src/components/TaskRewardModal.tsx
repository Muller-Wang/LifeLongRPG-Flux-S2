'use client';

import { useState } from 'react';
import { X, Sparkles, Coins, Loader2, Users, TrendingUp, Heart, CheckCircle2, MessageCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { getUserId, addPoints, getQuests, setQuests } from '@/lib/client/storage';
import { triggerAffinityEvent, writeMemory, evaluateTask, type AgentReviewReportFrontend } from '@/lib/client/api';

interface Props {
  open: boolean;
  subTaskId: string | null;
  subTaskTitle: string;
  onClose: () => void;
  /** 完成成功后让父级刷新（任务列表 + 资料栏）*/
  onCompleted?: () => void;
}

type Phase = 'form' | 'success' | 'reviewing' | 'result';

const REWARD_BASE = 8;
const REWARD_REFLECTION = 4;
const REWARD_FUTURE = 4;

export function TaskRewardModal({
  open,
  subTaskId,
  subTaskTitle,
  onClose,
  onCompleted
}: Props) {
  const [completion, setCompletion] = useState('');
  const [insight, setInsight] = useState('');
  const [future, setFuture] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [report, setReport] = useState<AgentReviewReportFrontend['report'] | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  if (!open) return null;

  const projectedPoints =
    REWARD_BASE +
    (insight.trim() ? REWARD_REFLECTION : 0) +
    (future.trim() ? REWARD_FUTURE : 0);

  function resetAndClose() {
    setCompletion('');
    setInsight('');
    setFuture('');
    setSubmitting(false);
    setPhase('form');
    setReport(null);
    setReviewError(null);
    onClose();
  }

  async function submit() {
    if (!subTaskId) return;
    if (!completion.trim()) return;
    setSubmitting(true);

    const uid = getUserId();
    if (uid) {
      await writeMemory({
        userId: uid,
        category: 'milestone',
        content: completion.slice(0, 200),
        importance: 2,
        triggeredBy: `subtask:${subTaskId}`
      });

      if (insight.trim()) {
        await writeMemory({
          userId: uid,
          category: 'confession',
          content: insight.slice(0, 200),
          importance: 2,
          triggeredBy: `subtask_insight:${subTaskId}`
        });
      }
      if (future.trim()) {
        await writeMemory({
          userId: uid,
          category: 'confession',
          content: future.slice(0, 200),
          importance: 3,
          triggeredBy: `subtask_future:${subTaskId}`
        });
      }

      await triggerAffinityEvent(uid, 'side_done_on_time', { subTaskId });
      if (insight.trim() && insight.trim().length >= 100) {
        await triggerAffinityEvent(uid, 'deep_reflection', { subTaskId });
      }
    }

    if (uid) {
      const quests = getQuests(uid);
      const next = {
        ...quests,
        subTasks: quests.subTasks.map(s =>
          s.id === subTaskId ? { ...s, done: true } : s
        )
      };
      setQuests(next, uid);
      addPoints(uid, projectedPoints);
    }

    setSubmitting(false);
    onCompleted?.();
    setPhase('success');
  }

  async function runAgentReview() {
    setReviewError(null);
    setPhase('reviewing');

    const content = [
      completion.trim(),
      insight.trim() ? `【收获与感悟】\n${insight.trim()}` : '',
      future.trim() ? `【对未来的影响】\n${future.trim()}` : ''
    ].filter(Boolean).join('\n\n');

    const result = await evaluateTask({
      taskTitle: subTaskTitle || '完成任务',
      taskDescription: '用户提交的任务完成报告',
      submissionSummary: completion.slice(0, 120),
      submissionContent: content
    });

    if (result.ok && result.report) {
      setReport(result.report);
      const bonus = calculateReviewBonus(result.report.aggregate);
      if (bonus > 0) {
        const uid = getUserId();
        if (uid) addPoints(uid, bonus);
      }
      setPhase('result');
    } else {
      setReviewError(result.error ?? '评审失败，请稍后重试');
      setPhase('success');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-bg/85 backdrop-blur-sm" onClick={phase !== 'reviewing' ? resetAndClose : undefined} />

      <div className="relative w-full max-w-2xl bg-bg-card border border-line cut-both animate-slide-up max-h-[90vh] flex flex-col">
        {/* 标题 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-accent-gold/15 border border-accent-gold/40 cut-tl">
              <Sparkles size={14} className="text-accent-gold" />
            </div>
            <div>
              <div className="font-display tracking-widest text-[10px] text-text-dim">
                {phase === 'result' ? 'AGENT REVIEW · 评审报告' : phase === 'reviewing' ? 'REVIEWING · 评审中' : 'TASK REWARD · 任务奖励'}
              </div>
              <div className="text-sm text-text mt-0.5">{subTaskTitle || '完成任务'}</div>
            </div>
          </div>
          {phase !== 'reviewing' && (
            <button
              onClick={resetAndClose}
              className="p-1.5 text-text-dim hover:text-accent-flame transition"
              aria-label="关闭"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto">
          {phase === 'form' && (
            <div className="px-6 py-5 space-y-5">
              <Tier level={1} label="任务完成情况" sub="必填 · 你做了什么 · 完成的过程与内容" base={REWARD_BASE} required>
                <textarea
                  value={completion}
                  onChange={e => setCompletion(e.target.value)}
                  placeholder="例：今天刷完线代第三章，做了 30 道题，错 5 道集中在向量空间……"
                  rows={3}
                  className="w-full bg-bg-deep border border-line text-sm text-text px-3 py-2 cut-tl outline-none focus:border-accent-gold transition resize-none"
                />
              </Tier>

              <Tier level={2} label="收获与感悟" sub="选填 · 这件事对此刻的你意味着什么" base={REWARD_REFLECTION} optional>
                <textarea
                  value={insight}
                  onChange={e => setInsight(e.target.value)}
                  placeholder="例：发现自己对极限那部分还不熟，明天专攻这块……"
                  rows={2}
                  className="w-full bg-bg-deep border border-line text-sm text-text px-3 py-2 cut-tl outline-none focus:border-accent-cyan transition resize-none"
                />
              </Tier>

              <Tier level={3} label="对未来的影响" sub="选填 · 它在更长的时间尺度里会改变什么" base={REWARD_FUTURE} optional>
                <textarea
                  value={future}
                  onChange={e => setFuture(e.target.value)}
                  placeholder="例：如果这一章过了，第四章就不必再回头补……"
                  rows={2}
                  className="w-full bg-bg-deep border border-line text-sm text-text px-3 py-2 cut-tl outline-none focus:border-accent-violet transition resize-none"
                />
              </Tier>
            </div>
          )}

          {phase === 'success' && (
            <div className="px-6 py-10 text-center space-y-6">
              <div className="w-16 h-16 mx-auto flex items-center justify-center bg-accent-gold/10 border border-accent-gold">
                <CheckCircle2 size={28} className="text-accent-gold" />
              </div>
              <div>
                <div className="text-lg text-text font-display tracking-wide">任务已完成</div>
                <div className="text-sm text-text-dim mt-1">
                  获得 <span className="text-accent-gold font-bold">+{projectedPoints}</span> PT
                </div>
              </div>
              {reviewError && (
                <div className="px-4 py-2 bg-accent-flame/10 border border-accent-flame/30 text-accent-flame text-xs">
                  {reviewError}
                </div>
              )}
              <div className="space-y-3 max-w-sm mx-auto">
                <button
                  onClick={runAgentReview}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-bg-deep border border-accent-gold text-accent-gold hover:bg-accent-gold/10 transition text-sm cut-tl"
                >
                  <Users size={14} />
                  获取 20 人 AI 评审
                </button>
                <button
                  onClick={resetAndClose}
                  className="w-full px-4 py-2.5 border border-line text-text-dim hover:text-text hover:border-accent-flame/40 text-sm transition cut-tl"
                >
                  关闭
                </button>
              </div>
            </div>
          )}

          {phase === 'reviewing' && (
            <div className="px-6 py-16 text-center space-y-5">
              <div className="relative w-14 h-14 mx-auto">
                <Loader2 size={40} className="text-accent-flame animate-spin absolute inset-0" />
              </div>
              <div>
                <div className="text-base text-text">20 个 Agent 正在并行评审……</div>
                <div className="text-xs text-text-dim mt-2 font-mono">
                  学习路径 × 4 · 职场路径 × 4 · 家庭路径 × 4 · 社交路径 × 4 · 精神路径 × 4
                </div>
              </div>
              <div className="flex justify-center gap-1.5">
                {Array.from({ length: 20 }).map((_, i) => (
                  <span
                    key={i}
                    className="w-1.5 h-4 bg-accent-flame animate-pulse"
                    style={{ animationDelay: `${i * 0.08}s` }}
                  />
                ))}
              </div>
              <div className="text-[10px] text-text-mute font-mono">预计 15-30 秒</div>
            </div>
          )}

          {phase === 'result' && report && (
            <AgentReviewResultView report={report} onClose={resetAndClose} basePoints={projectedPoints} />
          )}
        </div>

        {/* 底部 */}
        {phase === 'form' && (
          <div className="px-6 py-4 border-t border-line flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 font-mono text-xs text-text-dim">
              <Coins size={14} className="text-accent-gold" />
              <span>预估奖励</span>
              <span className="text-accent-gold text-base">+{projectedPoints}</span>
              <span>PT</span>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="md" onClick={resetAndClose}>取消</Button>
              <Button
                variant="primary"
                size="md"
                onClick={submit}
                disabled={!completion.trim() || submitting}
              >
                {submitting ? '提交中…' : '领取奖励'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 评审结果展示 ─────────────────────────────
interface ReviewAggregate {
  averageCompletionScore: number;
  averageQualityScore: number;
}

function calculateReviewBonus(agg: ReviewAggregate): number {
  let bonus = 0;
  if (agg.averageCompletionScore >= 80) bonus += 5;
  else if (agg.averageCompletionScore >= 60) bonus += 3;
  else if (agg.averageCompletionScore >= 40) bonus += 1;
  if (agg.averageQualityScore >= 80) bonus += 3;
  else if (agg.averageQualityScore >= 60) bonus += 2;
  else if (agg.averageQualityScore >= 40) bonus += 1;
  return bonus;
}

function AgentReviewResultView({
  report,
  onClose,
  basePoints
}: {
  report: NonNullable<AgentReviewReportFrontend['report']>;
  onClose: () => void;
  basePoints: number;
}) {
  const agg = report.aggregate;
  const successfulResults = report.results.filter(r => r.status === 'ok');
  const topResults = successfulResults
    .sort((a, b) => (b.score?.emotionScore ?? 0) - (a.score?.emotionScore ?? 0))
    .slice(0, 5);

  const emotionColor = (label: string) => {
    switch (label) {
      case 'positive': return 'text-accent-gold';
      case 'slightly_positive': return 'text-accent-cyan';
      case 'neutral': return 'text-text-dim';
      case 'slightly_negative': return 'text-text-mute';
      case 'negative': return 'text-accent-flame';
      default: return 'text-text-dim';
    }
  };

  return (
    <div className="px-6 py-5 space-y-5">
      {/* 聚合分数卡 */}
      <div className="grid grid-cols-3 gap-3">
        <ScoreCard
          icon={<CheckCircle2 size={12} />}
          label="完成度"
          value={agg.averageCompletionScore}
          color="gold"
        />
        <ScoreCard
          icon={<TrendingUp size={12} />}
          label="质量"
          value={agg.averageQualityScore}
          color="cyan"
        />
        <ScoreCard
          icon={<Heart size={12} />}
          label="情绪"
          value={agg.averageEmotionScore}
          max={5}
          color="flame"
        />
      </div>

      {/* 情绪分布 */}
      <div className="border border-line bg-bg-deep/50 px-4 py-3">
        <div className="font-mono text-[10px] tracking-widest text-text-dim mb-2">EMOTION DISTRIBUTION · 情绪分布</div>
        <div className="flex items-center gap-1 h-4">
          {agg.emotionDistribution.positive > 0 && (
            <div className="h-full bg-accent-gold" style={{ width: `${(agg.emotionDistribution.positive / 20) * 100}%` }} />
          )}
          {agg.emotionDistribution.slightly_positive > 0 && (
            <div className="h-full bg-accent-cyan" style={{ width: `${(agg.emotionDistribution.slightly_positive / 20) * 100}%` }} />
          )}
          {agg.emotionDistribution.neutral > 0 && (
            <div className="h-full bg-text-dim/40" style={{ width: `${(agg.emotionDistribution.neutral / 20) * 100}%` }} />
          )}
          {agg.emotionDistribution.slightly_negative > 0 && (
            <div className="h-full bg-text-mute" style={{ width: `${(agg.emotionDistribution.slightly_negative / 20) * 100}%` }} />
          )}
          {agg.emotionDistribution.negative > 0 && (
            <div className="h-full bg-accent-flame" style={{ width: `${(agg.emotionDistribution.negative / 20) * 100}%` }} />
          )}
        </div>
        <div className="flex flex-wrap gap-3 mt-2 text-[10px] font-mono">
          <span className="text-accent-gold">积极 {agg.emotionDistribution.positive}</span>
          <span className="text-accent-cyan">略正 {agg.emotionDistribution.slightly_positive}</span>
          <span className="text-text-dim">中性 {agg.emotionDistribution.neutral}</span>
          <span className="text-text-mute">略负 {agg.emotionDistribution.slightly_negative}</span>
          <span className="text-accent-flame">消极 {agg.emotionDistribution.negative}</span>
        </div>
      </div>

      {/* AI 总结反馈 */}
      <div className="border border-line bg-bg-deep/50 px-4 py-3">
        <div className="font-mono text-[10px] tracking-widest text-text-dim mb-2">SUMMARY · 综合评语</div>
        <p className="text-sm text-text leading-relaxed">{agg.userFeedback}</p>
      </div>

      {/* 精选角色评论 */}
      <div className="space-y-3">
        <div className="font-mono text-[10px] tracking-widest text-text-dim flex items-center gap-2">
          <MessageCircle size={10} />
          SELECTED REVIEWS · 精选评论（{successfulResults.length}/20）
        </div>
        {topResults.map((result, i) => (
          <div key={result.agentId} className="border border-line bg-bg-deep/50 px-4 py-3 animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-accent-cyan">{result.trackLabel}</span>
                <span className="text-xs text-text font-bold">{result.roleName}</span>
              </div>
              {result.score && (
                <span className={`font-mono text-[10px] ${emotionColor(result.score.emotionLabel)}`}>
                  {result.score.emotionLabel}
                </span>
              )}
            </div>
            {result.review && (
              <p className="text-sm text-text leading-relaxed mb-2">
                {result.review.agentMessage}
              </p>
            )}
            {result.score && (
              <div className="flex gap-3 text-[10px] font-mono text-text-mute">
                <span>完成 {result.score.completionScore}</span>
                <span>质量 {result.score.qualityScore}</span>
                <span>情绪 {result.score.emotionScore}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bonus 奖励 */}
      {(() => {
        const bonus = calculateReviewBonus(report.aggregate);
        if (bonus <= 0) return null;
        return (
          <div className="border border-accent-gold bg-accent-gold/10 px-4 py-3 flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <Coins size={14} className="text-accent-gold" />
              <span className="text-sm text-accent-gold font-bold">AI 评审额外奖励</span>
            </div>
            <span className="font-mono text-base text-accent-gold font-bold">+{bonus} PT</span>
          </div>
        );
      })()}

      {/* 总分 */}
      <div className="flex items-center justify-between border border-line bg-bg-deep/50 px-4 py-2.5">
        <span className="text-xs text-text-dim">本次任务总收益</span>
        <span className="font-mono text-base text-accent-gold font-bold">
          {basePoints + calculateReviewBonus(report.aggregate)} PT
        </span>
      </div>

      {/* 关闭按钮 */}
      <div className="pt-2">
        <Button variant="primary" size="md" className="w-full" onClick={onClose}>
          完成
        </Button>
      </div>
    </div>
  );
}

function ScoreCard({
  icon,
  label,
  value,
  max = 100,
  color
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  max?: number;
  color: 'gold' | 'cyan' | 'flame';
}) {
  const colorClass = {
    gold: 'border-accent-gold/30 text-accent-gold',
    cyan: 'border-accent-cyan/30 text-accent-cyan',
    flame: 'border-accent-flame/30 text-accent-flame'
  }[color];

  const barColor = {
    gold: 'bg-accent-gold',
    cyan: 'bg-accent-cyan',
    flame: 'bg-accent-flame'
  }[color];

  const pct = Math.max(2, Math.min(100, (value / max) * 100));

  return (
    <div className={`border ${colorClass} bg-bg-deep/50 px-3 py-2.5`}>
      <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-text-dim mb-1.5">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-xl font-bold leading-tight">{value}</div>
      <div className="relative h-1 bg-bg-deep border border-line/40 mt-2 overflow-hidden">
        <div className={`absolute inset-y-0 left-0 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── 子组件：分级容器 ─────────────────────────
function Tier({
  level,
  label,
  sub,
  base,
  required,
  optional,
  children
}: {
  level: 1 | 2 | 3;
  label: string;
  sub: string;
  base: number;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  const accent =
    level === 1 ? 'text-accent-gold' : level === 2 ? 'text-accent-cyan' : 'text-accent-violet';
  const dotBg =
    level === 1 ? 'bg-accent-gold' : level === 2 ? 'bg-accent-cyan' : 'bg-accent-violet';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${dotBg}`} />
          <span className={`font-mono text-[10px] tracking-widest ${accent}`}>
            TIER {level}
          </span>
          <span className="text-sm text-text">{label}</span>
          {required && (
            <span className="font-mono text-[9px] text-accent-flame border border-accent-flame/40 px-1 py-0.5">
              必填
            </span>
          )}
          {optional && (
            <span className="font-mono text-[9px] text-text-mute border border-line px-1 py-0.5">
              选填
            </span>
          )}
        </div>
        <span className="font-mono text-[10px] text-text-dim">+{base} PT</span>
      </div>
      <div className="text-[11px] text-text-mute mb-2">{sub}</div>
      {children}
    </div>
  );
}
