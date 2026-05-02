import { getSupabase } from '../supabase';
import { addUserPoints, ensureUserProfile } from '../user/store';

export interface QuestNodeInput {
  id: string;
  title: string;
  description?: string;
  templateKey?: string;
  parentId?: string;
  parentMainId?: string;
  acceptCriteria?: string;
  rarity?: 'SSR' | 'SR' | 'R' | 'N';
  difficulty?: 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';
  basePoints?: 5 | 8 | 12;
  done?: boolean;
}

export interface QuestTreeInput {
  userId: string;
  goal: string;
  heroId?: string | null;
  mainQuests: QuestNodeInput[];
  sideQuests: QuestNodeInput[];
  subTasks: QuestNodeInput[];
}

export interface QuestTreeRecord {
  id: string;
  userId: string;
  goal: string;
  heroId: string | null;
  mainQuests: QuestNodeInput[];
  sideQuests: QuestNodeInput[];
  subTasks: QuestNodeInput[];
  updatedAt: string;
}

export interface QuestSubmissionInput {
  userId: string;
  questId: string;
  completionText: string;
  reflectionText?: string;
  futureImpactText?: string;
  pointsAwarded: number;
  reviewStatus?: 'pending_ai' | 'accepted_manual' | 'accepted_ai' | 'rejected';
  aiVerdict?: 'pass' | 'good' | 'excellent' | 'rejected';
  triggeredEvent?: string;
  rawResult?: Record<string, unknown>;
}

export interface QuestSubmissionRecord {
  id: string;
  questId: string;
  userId: string;
  reviewStatus: string;
  aiVerdict: string | null;
  pointsAwarded: number;
  createdAt: string;
}

export async function saveQuestTree(input: QuestTreeInput): Promise<QuestTreeRecord> {
  if (!input.goal.trim()) {
    throw new Error('[quest] goal 不能为空');
  }

  await ensureUserProfile({
    id: input.userId,
    heroId: (input.heroId ?? undefined) as any,
    currentGoal: input.goal
  });

  const sb = getSupabase();
  const now = new Date().toISOString();
  const activeTree = await getActiveQuestTree(input.userId);

  let treeId = activeTree?.id;
  if (!treeId) {
    const { data, error } = await sb
      .from('quest_trees')
      .insert({
        user_id: input.userId,
        goal: input.goal,
        hero_id: input.heroId ?? null,
        is_active: true,
        snapshot: buildSnapshot(input),
        updated_at: now
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`[quest] 创建任务树失败: ${error?.message}`);
    }
    treeId = data.id;
  } else {
    const { error } = await sb
      .from('quest_trees')
      .update({
        goal: input.goal,
        hero_id: input.heroId ?? null,
        snapshot: buildSnapshot(input),
        updated_at: now
      })
      .eq('id', treeId);

    if (error) {
      throw new Error(`[quest] 更新任务树失败: ${error.message}`);
    }

    const { error: deleteError } = await sb
      .from('quests')
      .delete()
      .eq('tree_id', treeId);

    if (deleteError) {
      throw new Error(`[quest] 清理旧任务失败: ${deleteError.message}`);
    }
  }

  if (!treeId) {
    throw new Error('[quest] treeId 未生成');
  }

  const rows = [
    ...input.mainQuests.map((quest, index) =>
      toQuestRow(input.userId, treeId, quest, 'main', null, index)
    ),
    ...input.sideQuests.map((quest, index) =>
      toQuestRow(
        input.userId,
        treeId,
        quest,
        'side',
        quest.parentMainId ?? null,
        index
      )
    ),
    ...input.subTasks.map((quest, index) =>
      toQuestRow(input.userId, treeId, quest, 'daily', quest.parentId ?? null, index)
    )
  ];

  if (rows.length > 0) {
    const { error } = await sb.from('quests').insert(rows);
    if (error) {
      throw new Error(`[quest] 写入任务节点失败: ${error.message}`);
    }
  }

  return {
    id: treeId,
    userId: input.userId,
    goal: input.goal,
    heroId: input.heroId ?? null,
    mainQuests: input.mainQuests,
    sideQuests: input.sideQuests,
    subTasks: input.subTasks,
    updatedAt: now
  };
}

export async function getActiveQuestTree(userId: string): Promise<QuestTreeRecord | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('quest_trees')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`[quest] 读取任务树失败: ${error.message}`);
  }
  if (!data) return null;

  const snapshot = data.snapshot ?? {};
  return {
    id: data.id,
    userId: data.user_id,
    goal: data.goal,
    heroId: data.hero_id,
    mainQuests: Array.isArray(snapshot.mainQuests) ? snapshot.mainQuests : [],
    sideQuests: Array.isArray(snapshot.sideQuests) ? snapshot.sideQuests : [],
    subTasks: Array.isArray(snapshot.subTasks) ? snapshot.subTasks : [],
    updatedAt: data.updated_at
  };
}

export async function submitQuestSubmission(
  input: QuestSubmissionInput
): Promise<QuestSubmissionRecord> {
  await ensureUserProfile({ id: input.userId });

  const sb = getSupabase();
  const { data, error } = await sb
    .from('quest_submissions')
    .insert({
      user_id: input.userId,
      quest_id: input.questId,
      completion_text: input.completionText,
      reflection_text: input.reflectionText ?? null,
      future_impact_text: input.futureImpactText ?? null,
      review_status: input.reviewStatus ?? 'accepted_manual',
      ai_verdict: input.aiVerdict ?? null,
      points_awarded: input.pointsAwarded,
      triggered_event: input.triggeredEvent ?? null,
      raw_result: input.rawResult ?? {}
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`[quest] 提交记录写入失败: ${error?.message}`);
  }

  const { error: questUpdateError } = await sb
    .from('quests')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', input.questId);

  if (questUpdateError) {
    throw new Error(`[quest] 更新任务状态失败: ${questUpdateError.message}`);
  }

  if (input.pointsAwarded !== 0) {
    await addUserPoints(input.userId, input.pointsAwarded);
  }

  return {
    id: data.id,
    questId: data.quest_id,
    userId: data.user_id,
    reviewStatus: data.review_status,
    aiVerdict: data.ai_verdict,
    pointsAwarded: data.points_awarded,
    createdAt: data.created_at
  };
}

function buildSnapshot(input: QuestTreeInput) {
  return {
    goal: input.goal,
    heroId: input.heroId ?? null,
    mainQuests: input.mainQuests,
    sideQuests: input.sideQuests,
    subTasks: input.subTasks
  };
}

function toQuestRow(
  userId: string,
  treeId: string,
  quest: QuestNodeInput,
  kind: 'main' | 'side' | 'daily',
  parentId: string | null,
  sortOrder: number
) {
  return {
    id: quest.id,
    tree_id: treeId,
    user_id: userId,
    parent_id: parentId,
    quest_kind: kind,
    title: quest.title,
    description: quest.description ?? null,
    template_key: quest.templateKey ?? null,
    rarity: quest.rarity ?? null,
    difficulty: quest.difficulty ?? null,
    accept_criteria: quest.acceptCriteria ?? null,
    base_points: kind === 'daily' ? quest.basePoints ?? 8 : null,
    status: quest.done ? 'completed' : 'active',
    sort_order: sortOrder,
    completed_at: quest.done ? new Date().toISOString() : null,
    extra: {}
  };
}
