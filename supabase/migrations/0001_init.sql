-- ───────────────────────────────────────────────
-- LifeLongRPG Backend · 初始数据库结构
-- v3.2 · 2026-05-01
-- 仅包含三个核心模块：用户、好感度、记忆
-- 其他表（dialogue_templates / expression_mapping / utterances）留待后续 migration
-- ───────────────────────────────────────────────

-- 用户表（最小占位，后续扩展 hero/wallet/quests 等）
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ───────────────────────────────────────────────
-- 模块 2：好感度系统
-- ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS affinity (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  score       INT NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  stage       INT NOT NULL DEFAULT 1 CHECK (stage BETWEEN 1 AND 3),
  -- stage: 1=毫无兴趣 (0-29) / 2=愿意了解 (30-69) / 3=热情 (70-100)
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS affinity_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  delta       INT NOT NULL,
  context     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affinity_events_user_time
  ON affinity_events(user_id, created_at DESC);

-- 用 created_at 范围查询即可命中该索引，避免 timestamptz::date 的非 IMMUTABLE 问题
CREATE INDEX IF NOT EXISTS idx_affinity_events_user_type_time
  ON affinity_events(user_id, event_type, created_at DESC);

-- ───────────────────────────────────────────────
-- 模块 3：记忆数据库
-- ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS memories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category      TEXT NOT NULL CHECK (category IN
                  ('milestone','confession','habit','quote','emotion','compressed')),
  content       TEXT NOT NULL CHECK (LENGTH(content) <= 200),
  importance    INT NOT NULL DEFAULT 2 CHECK (importance IN (1,2,3)),
  is_compressed BOOLEAN NOT NULL DEFAULT FALSE,
  source_count  INT NOT NULL DEFAULT 1,           -- 压缩条目代表的原始记忆数
  triggered_by  TEXT,                              -- 来源事件 ID（taskId / sessionId）
  last_referenced_at TIMESTAMPTZ,                  -- 最近一次被绯夏引用的时间
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memories_user_time
  ON memories(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memories_user_importance
  ON memories(user_id, importance DESC, created_at DESC);

-- 记忆压缩追踪：用于按需触发压缩，避免重复压缩同一批
CREATE TABLE IF NOT EXISTS memory_compress_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  compressed_count INT NOT NULL,
  result_id   UUID REFERENCES memories(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ───────────────────────────────────────────────
-- 留白：以下表后续 migration 添加
-- · dialogue_templates  (场景 × 阶段 模板矩阵)
-- · expression_mapping  (表情切换映射)
-- · utterances          (绯夏说过的话历史，去重用)
-- · quests              (任务树)
-- · submissions         (描述+复盘提交)
-- · npc_comments        (NPC 评论)
-- ───────────────────────────────────────────────
