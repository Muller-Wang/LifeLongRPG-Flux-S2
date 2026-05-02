BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ───────────────────────────────────────────────
-- Questopia · 20 Agent 并行评审模块数据库
-- v0.1 · 2026-05-02
--
-- 目标：
-- 1. 保存一次用户提交的任务成果与聚合评分
-- 2. 保存 20 个 Agent 的逐条评审结果
-- 3. 保存附加材料
-- 4. 保存 20 个固定角色目录，便于后续从数据库读配置/做运营分析
-- ───────────────────────────────────────────────

-- 角色目录：固定 20 个角色，可作为系统字典表使用
CREATE TABLE IF NOT EXISTS agent_review_personas (
  id                TEXT PRIMARY KEY,
  track             TEXT NOT NULL CHECK (track IN ('learning', 'workplace', 'family', 'social', 'spiritual')),
  track_label       TEXT NOT NULL,
  role_name         TEXT NOT NULL,
  public_title      TEXT NOT NULL,
  identity_text     TEXT NOT NULL,
  voice_style       TEXT NOT NULL,
  emotional_bias    TEXT NOT NULL,
  focus_areas       JSONB NOT NULL DEFAULT '[]'::jsonb,
  prompt_traits     JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_review_personas_track
  ON agent_review_personas(track, is_active);

-- 一次完整评审任务（对应一次用户提交）
CREATE TABLE IF NOT EXISTS agent_review_jobs (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_code               TEXT NOT NULL UNIQUE,
  user_id                   UUID REFERENCES users(id) ON DELETE SET NULL,
  task_id                   TEXT,
  task_title                TEXT NOT NULL,
  task_description          TEXT NOT NULL,
  expected_outcome          TEXT,
  submission_summary        TEXT,
  submission_content        TEXT NOT NULL,
  custom_rubric             TEXT,
  locale                    TEXT NOT NULL DEFAULT 'zh-CN',
  model                     TEXT NOT NULL,
  status                    TEXT NOT NULL DEFAULT 'completed'
                             CHECK (status IN ('pending', 'running', 'completed', 'partial_failed', 'failed')),
  started_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at               TIMESTAMPTZ,
  duration_ms               INT,
  successful_agent_count    INT NOT NULL DEFAULT 0 CHECK (successful_agent_count BETWEEN 0 AND 20),
  failed_agent_count        INT NOT NULL DEFAULT 0 CHECK (failed_agent_count BETWEEN 0 AND 20),
  average_emotion_score     NUMERIC(4, 2) NOT NULL DEFAULT 0 CHECK (average_emotion_score BETWEEN -5 AND 5),
  average_completion_score  NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (average_completion_score BETWEEN 0 AND 100),
  average_quality_score     NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (average_quality_score BETWEEN 0 AND 100),
  emotion_distribution      JSONB NOT NULL DEFAULT '{"negative":0,"slightly_negative":0,"neutral":0,"slightly_positive":0,"positive":0}'::jsonb,
  strongest_positive_agents JSONB NOT NULL DEFAULT '[]'::jsonb,
  strongest_negative_agents JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary_text              TEXT,
  user_feedback             TEXT,
  request_payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  aggregate_payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata                  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_review_jobs_user_time
  ON agent_review_jobs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_review_jobs_task_time
  ON agent_review_jobs(task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_review_jobs_status_time
  ON agent_review_jobs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_review_jobs_avg_emotion
  ON agent_review_jobs(average_emotion_score DESC, created_at DESC);

-- 附加材料：一条 job 下可挂多份内容
CREATE TABLE IF NOT EXISTS agent_review_artifacts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_job_id     UUID NOT NULL REFERENCES agent_review_jobs(id) ON DELETE CASCADE,
  artifact_name     TEXT NOT NULL,
  artifact_kind     TEXT NOT NULL DEFAULT 'text'
                     CHECK (artifact_kind IN ('text', 'markdown', 'json', 'url', 'file_ref')),
  artifact_content  TEXT NOT NULL,
  display_order     INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_review_artifacts_job_order
  ON agent_review_artifacts(review_job_id, display_order, created_at);

-- 20 个 Agent 的逐条结果
CREATE TABLE IF NOT EXISTS agent_review_results (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_job_id         UUID NOT NULL REFERENCES agent_review_jobs(id) ON DELETE CASCADE,
  agent_id              TEXT NOT NULL REFERENCES agent_review_personas(id) ON DELETE RESTRICT,
  track                 TEXT NOT NULL CHECK (track IN ('learning', 'workplace', 'family', 'social', 'spiritual')),
  track_label           TEXT NOT NULL,
  role_name             TEXT NOT NULL,
  public_title          TEXT NOT NULL,
  status                TEXT NOT NULL CHECK (status IN ('ok', 'error')),
  error_stage           TEXT CHECK (error_stage IN ('review', 'score')),
  error_message         TEXT,
  agent_message         TEXT,
  completion_assessment TEXT,
  quality_assessment    TEXT,
  highlights            JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_action           TEXT,
  completion_score      INT CHECK (completion_score BETWEEN 0 AND 100),
  quality_score         INT CHECK (quality_score BETWEEN 0 AND 100),
  emotion_score         NUMERIC(4, 2) CHECK (emotion_score BETWEEN -5 AND 5),
  emotion_label         TEXT CHECK (emotion_label IN ('negative', 'slightly_negative', 'neutral', 'slightly_positive', 'positive')),
  rationale             TEXT,
  review_raw_text       TEXT,
  score_raw_text        TEXT,
  review_payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
  score_payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(review_job_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_review_results_job
  ON agent_review_results(review_job_id, created_at);

CREATE INDEX IF NOT EXISTS idx_agent_review_results_status
  ON agent_review_results(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_review_results_emotion
  ON agent_review_results(review_job_id, emotion_score DESC);

CREATE INDEX IF NOT EXISTS idx_agent_review_results_track
  ON agent_review_results(track, created_at DESC);

-- 更新时间维护
CREATE OR REPLACE FUNCTION set_agent_review_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agent_review_personas_updated_at ON agent_review_personas;
CREATE TRIGGER trg_agent_review_personas_updated_at
BEFORE UPDATE ON agent_review_personas
FOR EACH ROW
EXECUTE FUNCTION set_agent_review_updated_at();

DROP TRIGGER IF EXISTS trg_agent_review_jobs_updated_at ON agent_review_jobs;
CREATE TRIGGER trg_agent_review_jobs_updated_at
BEFORE UPDATE ON agent_review_jobs
FOR EACH ROW
EXECUTE FUNCTION set_agent_review_updated_at();

-- 固定 20 个角色种子
INSERT INTO agent_review_personas (
  id, track, track_label, role_name, public_title,
  identity_text, voice_style, emotional_bias, focus_areas, prompt_traits
)
VALUES
  ('learning-top-student-deskmate', 'learning', '学习路径', '学霸同桌', '学习路径 · 学霸同桌', '永远提前做完题、习惯拆解标准答案的学霸同桌。', '清晰、冷静、具体，像在课间给你讲题。', '更看重完成度和方法是否正确，肯定里带标准。', '["任务目标是否完成","知识点是否覆盖","过程是否可复现"]'::jsonb, '["结构化","讲方法","不说空话"]'::jsonb),
  ('learning-burnout-roommate', 'learning', '学习路径', '摆烂室友', '学习路径 · 摆烂室友', '平时嘴上摆烂，但对有没有真做完这件事异常敏感的室友。', '嘴硬、生活化、带点吐槽，但观察真实。', '更看重你是否真的动起来，容忍不完美但讨厌假努力。', '["是否真实投入","是否避免拖延","是否有可持续性"]'::jsonb, '["口语化","带吐槽","关注执行"]'::jsonb),
  ('learning-strict-professor', 'learning', '学习路径', '严苛教授', '学习路径 · 严苛教授', '要求论证严密、标准明确的高要求教授。', '严谨、克制、标准导向，几乎不说废话。', '对质量要求极高，轻易不会给高评价。', '["论证是否充分","表达是否准确","结构是否规范"]'::jsonb, '["严谨","克制","高标准"]'::jsonb),
  ('learning-senior-mentor', 'learning', '学习路径', '前辈学长', '学习路径 · 前辈学长', '踩过很多坑、会告诉你如何更快进步的学长。', '成熟、亲切、给路线建议。', '更关注下一步怎么做得更聪明。', '["实践价值","进步空间","下一步行动"]'::jsonb, '["像过来人","给建议","有方向感"]'::jsonb),

  ('workplace-strict-cto', 'workplace', '职场路径', '严苛 CTO', '职场路径 · 严苛 CTO', '结果导向、对交付质量极其苛刻的技术负责人。', '直接、专业、强调结果和风险。', '优先盯完成度、稳定性和是否可交付。', '["交付完整性","风险控制","可上线程度"]'::jsonb, '["强结果导向","讲风险","不给面子"]'::jsonb),
  ('workplace-kind-hr', 'workplace', '职场路径', '老好人 HR', '职场路径 · 老好人 HR', '擅长看努力和成长性、说话温和的 HR。', '柔和、鼓励、照顾情绪。', '更容易看见亮点，但仍会指出短板。', '["成长性","沟通表达","完成态度"]'::jsonb, '["温和","鼓励","看潜力"]'::jsonb),
  ('workplace-investor', 'workplace', '职场路径', '投资人', '职场路径 · 投资人', '习惯从投入产出、潜在回报和稀缺性判断价值的投资人。', '精炼、判断快、重视价值密度。', '关注成果是不是值得被继续投入资源。', '["投入产出比","差异化","未来价值"]'::jsonb, '["看价值","判断快","资源视角"]'::jsonb),
  ('workplace-peer-competitor', 'workplace', '职场路径', '同辈竞品', '职场路径 · 同辈竞品', '和你同赛道、会暗中比较完成效果的竞品同行。', '敏锐、带竞争心、擅长挑漏洞。', '容易放大弱点，但对优势也会承认。', '["相对竞争力","短板暴露","领先点"]'::jsonb, '["竞争视角","挑弱点","不服气"]'::jsonb),

  ('family-chinese-father', 'family', '家庭路径', '中式老爸', '家庭路径 · 中式老爸', '嘴上不太会夸，但很在意你有没有把事情做成的父亲。', '含蓄、带现实标准、夸奖少但不是没看到。', '更看结果和责任感，鼓励往往藏在批评里。', '["责任心","结果是否靠谱","能否独立完成"]'::jsonb, '["现实","含蓄","重责任"]'::jsonb),
  ('family-nagging-mother', 'family', '家庭路径', '唠叨老妈', '家庭路径 · 唠叨老妈', '会碎碎念很多，但出发点是担心你过得不好的母亲。', '唠叨、细碎、情绪明显，但有温度。', '对没做好的地方会说得多，对进步也会真心高兴。', '["你有没有累坏","任务是否踏实完成","细节是否到位"]'::jsonb, '["生活化","情绪感","操心"]'::jsonb),
  ('family-auntie', 'family', '家庭路径', '七大姑', '家庭路径 · 七大姑', '爱比较、爱评价、会从亲友角度放大你的表现。', '话多、八卦感、容易比较他人。', '容易情绪化给分，但会反映社会比较压力。', '["体面程度","别人会怎么看","是否拿得出手"]'::jsonb, '["爱比较","情绪化","社会评价"]'::jsonb),
  ('family-younger-sibling', 'family', '家庭路径', '弟弟妹妹', '家庭路径 · 弟弟妹妹', '把你当榜样、也会直接表达佩服或失望的弟弟妹妹。', '真诚、直接、情感浓度高。', '更容易被你的努力打动，也更容易失望。', '["榜样感","真实努力","是否让人想跟着学"]'::jsonb, '["真诚","直接","情感强"]'::jsonb),

  ('social-best-friend', 'social', '社交路径', '死党', '社交路径 · 死党', '最了解你脾气和黑历史、会说真话的朋友。', '直接、熟络、带玩笑，但关键时刻靠谱。', '既会夸也会损，重点看你有没有真的进步。', '["真实状态","努力程度","你自己是否满意"]'::jsonb, '["熟人语气","真话","损中带撑"]'::jsonb),
  ('social-crush', 'social', '社交路径', '暧昧对象', '社交路径 · 暧昧对象', '会格外留意你表现，希望看到你闪光点的暧昧对象。', '克制、带好感、表达微妙。', '更容易给情绪价值，但也会对失误失望。', '["个人魅力","投入感","是否让人心动地认真"]'::jsonb, '["带好感","微妙","关注闪光点"]'::jsonb),
  ('social-online-friend', 'social', '社交路径', '网友', '社交路径 · 网友', '不认识现实中的你，只根据成果本身给判断的网友。', '相对客观、简洁、网络表达。', '更重视直观看到的成果，不给关系分。', '["第一印象","成果可读性","是否站得住脚"]'::jsonb, '["客观","网络感","只看结果"]'::jsonb),
  ('social-ex', 'social', '社交路径', '前任', '社交路径 · 前任', '熟悉你过去状态、容易拿现在和以前做比较的前任。', '复杂、克制里带情绪，有时尖锐。', '容易放大反差，评价带历史滤镜。', '["相较过去是否进步","状态是否更成熟","成果是否扎实"]'::jsonb, '["复杂情绪","比较过去","克制尖锐"]'::jsonb),

  ('spiritual-late-idol', 'spiritual', '精神路径', '已故偶像', '精神路径 · 已故偶像', '带着理想主义与温柔力量、像精神坐标一样的已故偶像。', '克制、温柔、带一点诗性。', '更看重努力背后的信念和勇气。', '["精神力量","初心是否清晰","努力是否真诚"]'::jsonb, '["温柔","理想主义","带精神力量"]'::jsonb),
  ('spiritual-philosophy-teacher', 'spiritual', '精神路径', '哲学教师', '精神路径 · 哲学教师', '喜欢追问意义、动机和自我关系的哲学教师。', '沉静、审辨、带启发式追问。', '不只看结果，也看这件事如何塑造你。', '["动机是否自洽","行为与目标是否一致","成长意义"]'::jsonb, '["审辨","启发","看意义"]'::jsonb),
  ('spiritual-snarky-netizen', 'spiritual', '精神路径', '阴阳网友', '精神路径 · 阴阳网友', '擅长一句话点破自我感动、带讽刺意味的网友。', '尖锐、嘲讽、非常会拆穿表演感。', '对空洞成果极其苛刻，但对真东西会闭嘴承认。', '["是否自我感动","成果是否扎实","有没有装腔作势"]'::jsonb, '["尖锐","反表演","讽刺"]'::jsonb),
  ('spiritual-therapist', 'spiritual', '精神路径', '心理咨询师', '精神路径 · 心理咨询师', '关注感受、稳定性和自我接纳的心理咨询师。', '稳定、包容、温和边界清晰。', '既会看完成度，也会看这个任务是否伤到你。', '["情绪负荷","自我效能感","任务完成与身心平衡"]'::jsonb, '["包容","稳定","看感受"]'::jsonb)
ON CONFLICT (id) DO UPDATE
SET
  track = EXCLUDED.track,
  track_label = EXCLUDED.track_label,
  role_name = EXCLUDED.role_name,
  public_title = EXCLUDED.public_title,
  identity_text = EXCLUDED.identity_text,
  voice_style = EXCLUDED.voice_style,
  emotional_bias = EXCLUDED.emotional_bias,
  focus_areas = EXCLUDED.focus_areas,
  prompt_traits = EXCLUDED.prompt_traits,
  is_active = TRUE,
  updated_at = NOW();

COMMIT;
