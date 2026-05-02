-- ───────────────────────────────────────────────
-- LifeLongRPG · 全量产品数据库结构
-- v0.3 · 2026-05-02
-- 基于 PLAN.md / PRD.md 的完整实体补齐：
-- 用户档案 / 任务树 / 提交记录 / 模板矩阵 / 表情映射 / 对话日志 / NPC 角色池
-- ───────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ───────────────────────────────────────────────
-- 用户扩展：补齐前端注册、选职业、引导完成后的持久化字段
-- ───────────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS hero_id TEXT,
  ADD COLUMN IF NOT EXISTS current_goal TEXT,
  ADD COLUMN IF NOT EXISTS points INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique
  ON users(username)
  WHERE username IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_hero_id
  ON users(hero_id);

-- ───────────────────────────────────────────────
-- 任务树：一份当前激活树 + 扁平化任务明细
-- ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quest_trees (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal          TEXT NOT NULL,
  hero_id       TEXT,
  tree_version  INT NOT NULL DEFAULT 1,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  snapshot      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quest_trees_user_active
  ON quest_trees(user_id)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_quest_trees_user_time
  ON quest_trees(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS quests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id          UUID NOT NULL REFERENCES quest_trees(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id        UUID REFERENCES quests(id) ON DELETE CASCADE,
  quest_kind       TEXT NOT NULL CHECK (quest_kind IN ('main', 'side', 'daily')),
  title            TEXT NOT NULL,
  description      TEXT,
  template_key     TEXT,
  rarity           TEXT CHECK (rarity IN ('SSR', 'SR', 'R', 'N')),
  difficulty       TEXT CHECK (difficulty IN ('SSS', 'SS', 'S', 'A', 'B', 'C', 'D')),
  accept_criteria  TEXT,
  base_points      INT CHECK (base_points IN (5, 8, 12)),
  status           TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'completed', 'archived', 'failed')),
  sort_order       INT NOT NULL DEFAULT 0,
  due_at           TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  extra            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quests_tree_sort
  ON quests(tree_id, quest_kind, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_quests_user_status
  ON quests(user_id, status, quest_kind);

CREATE INDEX IF NOT EXISTS idx_quests_parent
  ON quests(parent_id);

-- ───────────────────────────────────────────────
-- 任务提交：承接“完成描述 + 复盘反思 + 长期影响”与未来 AI 审核
-- ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quest_submissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_id          UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  completion_text   TEXT NOT NULL,
  reflection_text   TEXT,
  future_impact_text TEXT,
  review_status     TEXT NOT NULL DEFAULT 'accepted_manual'
                     CHECK (review_status IN ('pending_ai', 'accepted_manual', 'accepted_ai', 'rejected')),
  ai_verdict        TEXT CHECK (ai_verdict IN ('pass', 'good', 'excellent', 'rejected')),
  ai_reason         TEXT,
  ai_confidence     NUMERIC(4, 3),
  points_awarded    INT NOT NULL DEFAULT 0,
  quality_multiplier NUMERIC(4, 2),
  is_hollow         BOOLEAN NOT NULL DEFAULT FALSE,
  triggered_event   TEXT,
  raw_result        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quest_submissions_quest_time
  ON quest_submissions(quest_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quest_submissions_user_time
  ON quest_submissions(user_id, created_at DESC);

-- ───────────────────────────────────────────────
-- 全局互动资源：模板、表情、NPC 角色池
-- ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dialogue_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene           TEXT NOT NULL,
  stage           INT NOT NULL CHECK (stage BETWEEN 1 AND 3),
  title           TEXT,
  template_text   TEXT NOT NULL,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(scene, stage)
);

CREATE INDEX IF NOT EXISTS idx_dialogue_templates_scene_stage
  ON dialogue_templates(scene, stage)
  WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS expression_mappings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene           TEXT NOT NULL,
  stage           INT NOT NULL CHECK (stage BETWEEN 1 AND 3),
  expression_key  TEXT NOT NULL,
  priority        INT NOT NULL DEFAULT 0,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(scene, stage, expression_key)
);

CREATE INDEX IF NOT EXISTS idx_expression_mappings_scene_stage
  ON expression_mappings(scene, stage, priority DESC)
  WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS npc_roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code       TEXT NOT NULL UNIQUE,
  lane            TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  stance          TEXT,
  style_prompt    TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS submission_npc_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   UUID NOT NULL REFERENCES quest_submissions(id) ON DELETE CASCADE,
  npc_role_id     UUID NOT NULL REFERENCES npc_roles(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  sentiment       INT NOT NULL DEFAULT 0 CHECK (sentiment BETWEEN -2 AND 2),
  display_order   INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submission_npc_comments_submission
  ON submission_npc_comments(submission_id, display_order, created_at);

-- ───────────────────────────────────────────────
-- 对话痕迹：说过的话与完整往返日志
-- ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS utterances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scene           TEXT NOT NULL DEFAULT 'free_chat',
  stage           INT NOT NULL CHECK (stage BETWEEN 1 AND 3),
  content         TEXT NOT NULL,
  content_hash    TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_utterances_user_time
  ON utterances(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_utterances_user_hash
  ON utterances(user_id, content_hash);

CREATE TABLE IF NOT EXISTS dialogue_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scene           TEXT NOT NULL DEFAULT 'free_chat',
  stage           INT NOT NULL CHECK (stage BETWEEN 1 AND 3),
  user_message    TEXT NOT NULL,
  assistant_reply TEXT NOT NULL,
  memory_used_id  UUID REFERENCES memories(id) ON DELETE SET NULL,
  template_id     UUID REFERENCES dialogue_templates(id) ON DELETE SET NULL,
  debug_payload   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dialogue_logs_user_time
  ON dialogue_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dialogue_logs_scene_stage
  ON dialogue_logs(scene, stage, created_at DESC);

-- ───────────────────────────────────────────────
-- 初始化全局模板矩阵（5 场景 × 3 阶段）
-- ───────────────────────────────────────────────

INSERT INTO dialogue_templates (scene, stage, title, template_text, notes)
VALUES
  ('free_chat', 1, '自由聊天 · 阶段 1', '保持克制、短句、观察式回应。默认不引用记忆，不主动拉近关系。', '通用聊天默认模板'),
  ('free_chat', 2, '自由聊天 · 阶段 2', '在推进话题的同时，可以轻微追问一个细节。若系统提供记忆，可自然带过但不要刻意。', '通用聊天默认模板'),
  ('free_chat', 3, '自由聊天 · 阶段 3', '可以更自然地接住用户状态，在不破人设前提下表现明显偏向与持续关注。', '通用聊天默认模板'),
  ('task_complete', 1, '任务完成 · 阶段 1', '确认结果即可，不夸张夸奖；重点提醒保持稳定。', '完成任务反馈'),
  ('task_complete', 2, '任务完成 · 阶段 2', '指出这次完成比过去更稳，允许给出一句具体观察。', '完成任务反馈'),
  ('task_complete', 3, '任务完成 · 阶段 3', '表达更明显的认可与在意，但仍然克制，不写成情话。', '完成任务反馈'),
  ('task_fail', 1, '任务失败 · 阶段 1', '不安慰，直接指出中断事实，并给出下一步最小动作。', '失败反馈'),
  ('task_fail', 2, '任务失败 · 阶段 2', '承认用户状态波动，但重点仍是帮他重新起步。', '失败反馈'),
  ('task_fail', 3, '任务失败 · 阶段 3', '允许出现克制的担心感，再把话题拉回恢复节奏。', '失败反馈'),
  ('absent_return', 1, '回归 · 阶段 1', '确认用户回来了，不追问情绪，不做亲密表达。', '缺席后回归'),
  ('absent_return', 2, '回归 · 阶段 2', '可以点出用户消失了一阵，但只追问一个轻量原因。', '缺席后回归'),
  ('absent_return', 3, '回归 · 阶段 3', '允许一句更明显的“你回来了”式反馈，再接住当前状态。', '缺席后回归'),
  ('reflection', 1, '复盘 · 阶段 1', '只抓事实与漏洞，避免情绪性安慰。', '复盘场景'),
  ('reflection', 2, '复盘 · 阶段 2', '指出复盘里的观察价值，并追一个更具体的行动问题。', '复盘场景'),
  ('reflection', 3, '复盘 · 阶段 3', '在认可洞察的基础上，自然承接更长期的影响。', '复盘场景')
ON CONFLICT (scene, stage) DO UPDATE
SET
  title = EXCLUDED.title,
  template_text = EXCLUDED.template_text,
  notes = EXCLUDED.notes,
  updated_at = NOW();

INSERT INTO expression_mappings (scene, stage, expression_key, priority, notes)
VALUES
  ('free_chat', 1, 'default', 10, '默认克制'),
  ('free_chat', 2, 'interested', 10, '开始在意'),
  ('free_chat', 3, 'warm', 10, '明显偏向'),
  ('task_complete', 1, 'default', 10, '完成但克制'),
  ('task_complete', 2, 'interested', 10, '完成后的留意'),
  ('task_complete', 3, 'warm', 10, '完成后的偏心'),
  ('task_fail', 1, 'default', 10, '指出失败'),
  ('task_fail', 2, 'concern', 10, '克制担心'),
  ('task_fail', 3, 'sad', 10, '失落但不失控'),
  ('absent_return', 1, 'default', 10, '普通回归'),
  ('absent_return', 2, 'interested', 10, '开始在意'),
  ('absent_return', 3, 'warm', 10, '明显欢迎'),
  ('reflection', 1, 'default', 10, '事实复盘'),
  ('reflection', 2, 'interested', 10, '有思考'),
  ('reflection', 3, 'warm', 10, '更深层承接')
ON CONFLICT (scene, stage, expression_key) DO NOTHING;

INSERT INTO npc_roles (role_code, lane, display_name, stance, style_prompt)
VALUES
  ('study_top_student', '学习路', '学霸同桌', '结果导向', '说话冷静、直接，重视方法与效率。'),
  ('study_slacker_roommate', '学习路', '摆烂室友', '玩笑吐槽', '语气松弛、带一点摆烂幽默，但会被真正努力打动。'),
  ('study_strict_professor', '学习路', '严苛教授', '高标准', '用严谨、挑剔、专业的视角评价。'),
  ('study_senior', '学习路', '前辈学长', '经验建议', '像过来人，给短促但有效的经验判断。'),
  ('work_strict_cto', '职场路', '严苛 CTO', '执行导向', '只看结果、节奏和可复制性。'),
  ('work_kind_hr', '职场路', '老好人 HR', '关系感知', '看重状态、稳定性和可持续投入。'),
  ('work_investor', '职场路', '投资人', '机会判断', '关注势能、稀缺性和长期回报。'),
  ('work_rival_peer', '职场路', '同辈竞品', '竞争比较', '会拿你和别人比较，语气带刺。'),
  ('family_father', '家庭路', '中式老爸', '务实要求', '惜字如金，重视长期吃苦与兑现。'),
  ('family_mother', '家庭路', '唠叨老妈', '关心叙事', '嘴上念叨，核心是担心与希望。'),
  ('family_aunt', '家庭路', '七大姑', '世俗评价', '带点社会目光和面子逻辑。'),
  ('family_sibling', '家庭路', '弟弟妹妹', '亲近观察', '从日常相处看你的变化。'),
  ('social_best_friend', '社交路', '死党', '直球支持', '熟悉你，能直接点破你的借口。'),
  ('social_crush', '社交路', '暧昧对象', '微妙关注', '会从细节里感知你的认真与懈怠。'),
  ('social_online_friend', '社交路', '网友', '抽离观察', '互联网口吻，犀利但不一定恶意。'),
  ('social_ex', '社交路', '前任', '复杂情绪', '带着旧印象评价你是否真的变了。'),
  ('mind_idol', '精神路', '已故偶像', '精神投射', '像遗留给你的准则，庄重而克制。'),
  ('mind_teacher', '精神路', '哲学教师', '意义追问', '擅长追问动机、价值与自洽。'),
  ('mind_troll', '精神路', '阴阳网友', '反讽刺激', '尖刻、讽刺，但偶尔会说中事实。'),
  ('mind_counselor', '精神路', '心理咨询师', '情绪承接', '温和、边界清楚，关注长期模式。')
ON CONFLICT (role_code) DO NOTHING;
