# 命途 / LifeLongRPG · 2天3人 黑客松开发计划

> 文档版本：v3 · 2026-05-01
> 项目代号：命途（中文主名）/ LifeLongRPG（英文副名）
>
> **v3 关键变更**：互动从「提示词驱动」改为「程序驱动 + LLM 配音」。
> 提示词不再承担互动决策——场景识别、记忆引用、表情切换、好感度行为
> 全部移到后端确定性程序里。LLM 只负责生成 1-3 句符合模板约束的话。

---

## 0. 真实判断（动手前必读）

**这不是产品上线，是 demo 冲刺。** 

v3 的互动决策引擎是工程量最大的新增项（+19 人时）。原 75h → **94h**。
3 人 2 天 = 60-72h，**这套工程量不是 2 天能做完的**。必须二选一：

### 方案 A · 守 2 天工期，砍 demo 范围（推荐）
- 模板矩阵：5 场景 × 3 阶段 = 15 个模板（v3.2 阶段命名：毫无兴趣/愿意了解/热情）
- 后处理：只做长度 + 禁用词正则（不做相似度）
- 表情：3 套立绘（不是 15 张）
- 记忆引用：只在 1 个场景启用（`absent_return` 久未回归）
- 自由对话场景：砍掉，只做事件触发场景
- 砍后约 78 人时，每人加班 6h 可达标

### 方案 B · 改 3 天工期，做完整版
- 完整 50 模板矩阵 + 完整后处理 + 5 套表情 + 全场景记忆引用
- 约 94 人时，每天 10-11 小时正常节奏

**默认推荐方案 A**，下文按方案 A 排期。

---

## 1. 功能定档

| 档位 | 含义 | 工程量 |
|------|------|-------|
| **A · 真功能** | 跑通真实数据流，AI 真调用 | 大 |
| **B · 静态占位** | 静态图 + 假数据展示页 | 小 |
| **C · UI 壳子** | 完整页面 UI + mock 数据 | 中 |
| **D · 愿景章节** | 只在 PPT 里出现 | 极小 |

### A · 真功能（demo 必演）
1. 选择英雄页（3 张职业立绘 + 史诗陈述）
2. 绯夏对话主页（立绘 + 状态栏 + 自然语言对话）
3. AI 任务树拆解
4. **描述 + 复盘双文本提交 + AI 文本判定**（5/8/12 三档点数）
5. NPC 评论区（20 池抽 3）
6. **云端记忆系统**（写入 + 读取 + 引用决策）
7. **好感度系统**（3 阶段 · 毫无兴趣/愿意了解/热情 · 按时性核心算法）
8. **互动决策引擎**（场景路由 + 模板矩阵 + 后处理）

### B · 静态占位
9. 商店页（12 件商品）
10. 看板娘换装页（3 套）

### C · UI 壳子
11. 社区 / 好友 / 排行榜页

### D · 愿景章节
12. 3D 桌宠 / 100 NPC 全量 / 防作弊深度 / 双货币 / 多平台

---

## 2. 数据模型（含互动引擎所有表）

```
User
 ├─ Hero（职业）
 ├─ Affinity（好感度记录）
 ├─ Memory[]（记忆条目）
 ├─ Utterance[]（绯夏说过的话历史）
 ├─ AffinityEvent[]（好感度事件日志）
 ├─ DialogueLog[]（对话日志，用于调试）
 └─ Quest（任务树 jsonb）

DialogueTemplate（场景 × 阶段 模板表，全局共享）
ExpressionMapping（表情映射表，全局共享）
NPCRole（20 角色池）
```

---

## 3. 技术栈

| 层 | 选型 |
|----|------|
| 框架 | Next.js 14 App Router + TS |
| UI | Tailwind + shadcn/ui |
| UI 加速 | v0.dev（社区/好友/排行榜壳子）|
| DB | Supabase Postgres + Storage |
| AI | Claude Sonnet 4.6（纯文本，无 Vision）|
| 任务树图 | React Flow |
| 立绘 | Midjourney v7 niji 6 |
| 占位图 | GPT Image 2 |
| 部署 | Vercel |

---

## 4. 三人分工

| 角色 | 职责 |
|------|------|
| **A · 产品&设计** | 立绘（3 套表情）、占位图（~50张）、文案、PPT、**模板矩阵的文案（15 条）** |
| **B · 前端&全栈** | 脚手架、UI、表情切换、状态栏、Supabase 接入、部署 |
| **C · AI&后端** | **互动决策引擎**（场景路由 + 模板选择 + 记忆决策 + 好感度引擎 + 后处理）+ 5 核心 Agent + 20 NPC |

---

## 5. Hour-by-Hour（48h · 方案 A）

### Day 1（0–24h）

| 时段 | A | B | C |
|------|---|---|---|
| 09:00–10:00 | Kickoff | Kickoff | Kickoff |
| 10:00–12:00 | 绯夏立绘 prompt × 3 表情 + Midjourney | 脚手架 + 全部 DB schema（含 templates/expressions/utterances/affinity_events）+ 路由 | 互动引擎骨架：场景路由器 + 状态读取器 |
| 12:00–13:00 | 午饭 |
| 13:00–15:00 | 占位图：商店 12 + 换装 3 + PPT 配图 | Supabase Storage + 选英雄页 UI + 看板娘对话页骨架 | 好感度引擎（事件 → delta → 写库 → 计算 tier） |
| 15:00–17:00 | 占位图：社区帖子 + 排行榜头像 | React Flow 任务树 + 状态栏（好感度槽 + streak）+ 立绘表情切换组件 | 记忆引擎（写入触发 + 读取 + 引用决策器） |
| 17:00–19:00 | **15 条模板文案**：5 场景 × 3 阶段（毫无兴趣/愿意了解/热情）· 场景：onboarding / task_complete / task_fail / absent_return / reflection | 描述+复盘双输入提交表单 + 数据流 | 任务拆解 Agent + 文本判定 Agent |
| 19:00–20:00 | 晚饭 |
| 20:00–22:00 | PPT 配图 + 文案收尾 | 各场景 endpoint UI 联调 | 模板渲染器 + 后处理（长度 + 禁用词正则）+ 20 NPC prompt |
| 22:00–23:00 | **D1 联调验收**：选英雄→对话→输目标→任务树→好感度变化 |
| 23:00–次日 09:00 | 睡觉 |

### Day 2（24–48h）

| 时段 | A | B | C |
|------|---|---|---|
| 09:00–10:00 | PPT 大纲 | bug 修复 | bug 修复 |
| 10:00–12:00 | PPT 5 页文案 + 配图收尾 | 商店页 + 换装页（吃 A 的图） | 复盘 Agent + 文本判定调优 |
| 12:00–13:00 | 午饭 |
| 13:00–15:00 | Demo 脚本（含好感度对比彩蛋） | v0.dev 生成 社区/好友/排行榜 壳子 | NPC 评论 Agent 联调 + 模板填充全部 15 条到 DB |
| 15:00–17:00 | PPT 排版 | mock 数据 + 好感度彩蛋账号（score=0 vs 60）数据准备 | 整体联调 + 5 组兜底预跑 |
| 17:00–18:00 | Demo 演练 1 | Vercel 部署 | 联调收尾 |
| 18:00–19:00 | 晚饭 |
| 19:00–21:00 | Demo 演练 2 + 录屏 | UI 抛光 + 移动端适配 | bug 修复 |
| 21:00–22:00 | **最终验收（§14）+ 录屏备份** |

---

## 6. 多 Agent 架构（5 核心 + 20 NPC）

| Agent | 职责 | 关键 |
|-------|------|------|
| 1 任务拆解 | 用户目标 → JSON 任务树 | strict JSON 输出 |
| 2 绯夏对话 | 模板渲染 + 用户输入 → 1-3 句 | **由互动引擎调度，见 §18-22** |
| 3 任务验证 | 描述+复盘+验收标准 → verdict + points + reason | 纯文本 · 含空洞度检测 |
| 4 复盘评分 | 复盘文字 → 短/中/长期价值评分 | |
| 5 NPC 评论 | 复盘 + 3 NPC → 3 条评论 | 并发调用 |

---

## 7. 看板娘视觉

**风格**：绝区零 + 明日方舟 + 终末地（严禁赛博朋克 2077）

**立绘**（A 角色 D1 出图）：
- **方案 A 范围**：3 套表情（默认 / 在意 / 失落）
- 全部用同 seed + 同 style raw 锁定一致性

**配色**：底 `#0A0E1A` / 强调红 `#E63946` / 冷青 `#3DDCEB` / 金 `#FFD60A`

**Midjourney 参数**：`--niji 6 --style raw --s 350 --ar 9:16`

---

## 8. 选择英雄

3 个职业（大学生 / 博士生 / 社畜），文案见 PRD 备份，史诗风格，魔兽+IMSB 调性。

---

## 9. JSON Schema

```typescript
// 任务树
type Rarity = "SSR" | "SR" | "R" | "N";
type Difficulty = "SSS" | "SS" | "S" | "A" | "B" | "C" | "D";
interface QuestTree { goal: string; mainQuests: MainQuest[]; }
interface MainQuest { id; title; rarity; difficulty; acceptCriteria; sideQuests }
interface SideQuest { id; title; rarity; difficulty; acceptCriteria; dailyActions }
interface DailyAction { id; title; basePoints: 5|8|12; acceptCriteria }

// 记忆
interface Memory {
  id; userId;
  category: "milestone"|"confession"|"habit"|"quote"|"emotion";
  content: string;        // ≤80字
  importance: 1|2|3;
  triggeredBy: string;
  createdAt: Date;
}

// 好感度
interface Affinity { userId; score: 0..100; tier: 1|2|3; lastUpdatedAt }  // v3.2 三阶段
interface AffinityEvent { id; userId; eventType; delta; context: jsonb; createdAt }
```

---

## 10. PPT 5 页

1. 痛点：人生没有进度条
2. 解法：命途 · 把人生变成游戏
3. 核心体验（含好感度对比截图）
4. 架构图（含互动决策引擎）
5. Vision Backlog

---

## 11. 风险与兜底

| 风险 | 兜底 |
|------|------|
| 模板矩阵 15 条文案 A 角色来不及 | 退化到 5 场景 × 1 阶段（仅阶段 2 愿意了解）= 5 模板，其余阶段共用 |
| 后处理重试链路过长 | 失败 2 次后用兜底固定句库 |
| 好感度引擎 bug | demo 前预设 score=0 和 score=60 两个固定账号 |
| 文本判定空洞描述蒙混 | 提示词强制空洞度检测，关键词缺失自动降档 |
| Midjourney 风格不统一 | 同 seed 锁定 |
| Demo API 超时 | 录屏备份 |
| 团队进度落后 | D1 23点对齐，落后则砍：复盘 Agent → 表情切换 → 排行榜页 |

---

## 12. NPC 20 角色清单

学习路（4）：学霸同桌 / 摆烂室友 / 严苛教授 / 前辈学长
职场路（4）：严苛 CTO / 老好人 HR / 投资人 / 同辈竞品
家庭路（4）：中式老爸 / 唠叨老妈 / 七大姑 / 弟弟妹妹
社交路（4）：死党 / 暧昧对象 / 网友 / 前任
精神路（4）：已故偶像 / 哲学教师 / 阴阳网友 / 心理咨询师

---

## 13. 占位资源

| 分类 | 数量 | 工具 |
|------|------|------|
| 绯夏立绘 | 3 表情 | Midjourney |
| 职业立绘 | 3 张 | Midjourney |
| 商店物品 | 12 张 | GPT Image 2 |
| 换装 | 3 套 | GPT Image 2 |
| 社区帖子 | 6 张 | GPT Image 2 |
| 排行榜头像 | 20 张 | GPT Image 2 |
| PPT 配图 | 6 张 | GPT Image 2 |

---

## 14. 验收清单（D2 21:00 卡点）

**A 真功能**：
- [ ] 选英雄页可选 3 职业
- [ ] 初见绯夏（阶段 1 · 毫无兴趣 状态正确）
- [ ] 输入目标 30 秒出任务树
- [ ] 任务树 React Flow 渲染
- [ ] 描述+复盘提交 + AI 文本判定 + 点数
- [ ] NPC 评论区 3 条
- [ ] **互动引擎**：5 个场景 endpoint 各能跑通
- [ ] **好感度系统**：按时完成支线 score+8，跨阈值（30 / 70）切换阶段
- [ ] **记忆系统**：absent_return 场景能引用前几天的记忆条目
- [ ] **彩蛋演示**：score=0 vs score=60 切换，绯夏说话明显不同

**B/C**：
- [ ] 商店 12 件 / 换装 3 套 / 社区/好友/排行榜壳子可滑

**通用**：
- [ ] Vercel 部署 / PPT 5 页 / 录屏备份 / 视觉风格统一

---

## 15. Kickoff 待拍板

1. **方案 A（2 天 + 加班）vs 方案 B（3 天）**？默认 A
2. **登录砍不砍**？默认砍，localStorage 伪登录
3. **好感度彩蛋对比展示哪两阶段**？默认阶段 1（毫无兴趣 · score=0）vs 阶段 3（热情 · score=80）—— 反差最大

---

## 16. 视觉风格指南

主底 `#0A0E1A` / 强调红 `#E63946` / 冷青 `#3DDCEB` / 金 `#FFD60A`
思源黑体（中）/ Space Grotesk（英）/ JetBrains Mono（数字）
直角斜切 + 1px 渐变描边 + 4px 圆角
严禁混入：赛博朋克 2077 / 原神 / 蔚蓝档案

---

## 17. PRD 修订记录（v3）

| 项 | 原 PRD | v3 |
|----|-------|-----|
| 看板娘 | 红/白 | 仅绯夏 |
| 互动逻辑 | 自由对话 | **场景路由 + 模板矩阵 + 程序决策** |
| 好感度 | 设计中 | **3 阶段 + 按时性核心算法 + 阶段化提示词加载**（v3.2）|
| 记忆 | 无 | **云端记忆 + 引用决策器** |
| 视觉风格 | 赛博朋克 | 绝区零/明日方舟 |
| 任务验证 | 拍照 + Vision 判定 | **描述 + 复盘双文本 + AI 文本判定**（v3.1）|

---

# 🔧 互动决策引擎设计（核心新增）

---

## 18. 互动决策引擎 · 总体架构

### 18.1 核心理念

**LLM 是配音演员，不是导演。**

互动的所有决策——什么场景、说什么话、引用哪条记忆、用哪个表情——
**全部由后端确定性程序完成**。LLM 只在最后一步输出符合极小约束的 1-3 句话。

### 18.2 调用流程（单次互动 = 单次 endpoint 调用）

```
┌──────────────────────────────────────────────────────────┐
│  1. 前端事件触发 → 调用对应 scene endpoint                  │
│     例：用户提交描述+复盘后调 POST /api/feixia/task_complete │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│  2. 状态读取                                                │
│     - load Affinity (score, tier)                          │
│     - load recent Utterances (近10条，去重用)               │
│     - load Memories (Top 10 by importance)                 │
│     - load user state (streak, last_contact, mood)         │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│  3. 模板选择                                                │
│     SELECT * FROM dialogue_templates                        │
│     WHERE scene_id = ? AND tier = ? AND enabled = true     │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│  4. 记忆引用决策（只在白名单场景）                            │
│     - 检查场景白名单                                         │
│     - 检查频率冷却                                           │
│     - 关键词匹配 + importance 加权选 1 条                    │
│     - 决定是否注入 <memory_ref>                            │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│  5. 表情决策                                                │
│     SELECT expression_id FROM expression_mapping           │
│     WHERE scene_id = ? AND tier = ? AND emotion = ?        │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│  6. Prompt 拼接 + LLM 调用                                  │
│     system: 不变骨架（feixia-character.md §四）              │
│     user:   模板 + 用户消息 + 状态 + 记忆引用 + 近期发言     │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│  7. 后处理校验                                              │
│     - 长度（≤30字 / 模板特例）                               │
│     - 禁用词正则                                             │
│     - 句末助词正则                                           │
│     - 与近期 utterance 相似度（方案 A 跳过）                 │
│     - 失败 → 重试 max 2 次 → 兜底固定句                     │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│  8. 持久化                                                  │
│     - INSERT into utterances（用于下次去重）                 │
│     - INSERT into affinity_events（如果有事件）              │
│     - 可能 INSERT into memories（如果场景产生记忆）           │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│  9. 响应                                                    │
│     return { text, expression_id, affinity_change }        │
└──────────────────────────────────────────────────────────┘
```

### 18.3 关键设计原则

1. **场景识别 = endpoint 路由**，不是 LLM 推断
2. **模板 = (scene × tier) 二维矩阵**，存数据库可热更新
3. **记忆引用 = 程序决策**，LLM 不自己判断要不要提
4. **表情 = 状态映射查表**，不是 LLM 输出
5. **后处理是硬关卡**，LLM 失控由程序兜底
6. **每个 endpoint 是无状态函数**，幂等可重试

---

## 19. 数据库 Schema 详细定义

```sql
-- 好感度核心表
CREATE TABLE affinity (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  score INT NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  tier INT NOT NULL DEFAULT 1 CHECK (tier BETWEEN 1 AND 3),  -- v3.2 三阶段（毫无兴趣/愿意了解/热情），数据库字段名仍为 tier 以兼容代码
  last_decay_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 好感度事件日志
CREATE TABLE affinity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL,
  delta INT NOT NULL,
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_affinity_events_user ON affinity_events(user_id, created_at DESC);

-- 记忆条目
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  category TEXT NOT NULL CHECK (category IN
    ('milestone','confession','habit','quote','emotion')),
  content TEXT NOT NULL CHECK (LENGTH(content) <= 80),
  importance INT NOT NULL CHECK (importance IN (1,2,3)),
  triggered_by TEXT,
  last_referenced_at TIMESTAMPTZ,  -- 用于频率控制
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_memories_user_importance ON memories(user_id, importance DESC);

-- 绯夏说过的话历史（去重用）
CREATE TABLE utterances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  scene_id TEXT NOT NULL,
  tier INT NOT NULL,
  text TEXT NOT NULL,
  expression_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_utterances_user_recent ON utterances(user_id, created_at DESC);

-- 对话模板矩阵（核心！）
CREATE TABLE dialogue_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id TEXT NOT NULL,
  tier INT NOT NULL,
  variant_index INT DEFAULT 0,        -- 同 scene+tier 可有多变体
  prompt_template TEXT NOT NULL,      -- 给 LLM 的指令
  examples TEXT[],                    -- few-shot
  fallback_text TEXT NOT NULL,        -- LLM 失败时的兜底固定句
  max_chars INT DEFAULT 30,
  enabled BOOLEAN DEFAULT TRUE,
  UNIQUE(scene_id, tier, variant_index)
);

-- 表情映射
CREATE TABLE expression_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id TEXT NOT NULL,
  tier INT NOT NULL,
  emotion_label TEXT,
  expression_image_id TEXT NOT NULL,
  UNIQUE(scene_id, tier, emotion_label)
);

-- 对话日志（调试用）
CREATE TABLE dialogue_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  scene_id TEXT,
  tier INT,
  user_input TEXT,
  selected_memory_id UUID,
  rendered_prompt TEXT,
  llm_raw_output TEXT,
  final_output TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 20. 程序模块详细设计

### 20.1 场景路由器（Server Actions）

每个场景一个 endpoint：

```typescript
// /src/app/api/feixia/[scene]/route.ts

export async function POST(req, { params }) {
  const { scene } = params;
  const { userId, userInput, context } = await req.json();
  
  return await runFeixiaInteraction({
    sceneId: scene,
    userId,
    userInput,
    context
  });
}
```

支持的场景（方案 A 范围）：
- `onboarding` - 首次见面
- `task_complete` - 任务完成（参数 verdict: pass|good|excellent）
- `task_fail` - 任务失败
- `absent_return` - 久未归来
- `reflection` - 复盘后回应

### 20.2 互动主流程

```typescript
async function runFeixiaInteraction(input: InteractionInput) {
  // 1. 状态读取（并行）
  const [affinity, recentUtterances, memories, userState] = await Promise.all([
    getAffinity(input.userId),
    getRecentUtterances(input.userId, 10),
    getMemories(input.userId, 10),
    getUserState(input.userId)
  ]);

  // 2. 模板选择
  const template = await selectTemplate(input.sceneId, affinity.tier);
  if (!template) throw new Error('No template found');

  // 3. 记忆引用决策
  const memoryRef = await decideMemoryReference({
    userId: input.userId,
    sceneId: input.sceneId,
    userInput: input.userInput,
    memories
  });

  // 4. 表情决策
  const emotion = inferEmotion(input.sceneId, input.context, userState);
  const expressionId = await selectExpression(
    input.sceneId, affinity.tier, emotion
  );

  // 5. Prompt 拼接 + LLM 调用（带重试）
  const text = await callLLMWithRetry({
    template,
    userInput: input.userInput,
    memoryRef,
    recentUtterances,
    state: { ...affinity, ...userState }
  });

  // 6. 应用好感度变化（如果场景对应事件）
  const affinityDelta = await applyAffinityForScene(
    input.sceneId, input.userId, input.context
  );

  // 7. 持久化
  await Promise.all([
    saveUtterance(input.userId, input.sceneId, affinity.tier, text, expressionId),
    memoryRef && updateMemoryReferenceTime(memoryRef.id),
    logDialogue({ ...input, text, template, memoryRef })
  ]);

  return {
    text,
    expression_id: expressionId,
    affinity_change: affinityDelta,
    new_tier: affinity.tier
  };
}
```

### 20.3 好感度引擎

```typescript
// /src/lib/affinity/engine.ts

// v3.2 · 核心维度：用户是否按时完成主线/支线任务
const AFFINITY_DELTAS: Record<string, number> = {
  // 增分 · 按时性优先
  daily_done_on_time:    +2,    // 按时完成每日行动
  side_done_on_time:     +8,    // 按时完成支线（周级）
  side_done_early:       +12,   // 提前完成支线
  main_done_on_time:     +20,   // 按时完成主线（月级）
  main_done_early:       +30,   // 提前完成主线
  deep_reflection:       +2,    // ≥100 字 + 有反思
  streak_7:              +5,
  streak_14:             +10,
  streak_30:             +15,
  // 减分 · 拖延即扣分
  side_overdue:          -3,
  main_overdue:          -10,
  daily_miss_3d:         -3,    // 每日行动连续 3 天未完成
  absent_7d:             -5,
  absent_30d:            -100,  // 强制清零，触发"被遗忘"事件
};

// v3.2 三阶段（命名强行为状态导向）
const STAGES = [
  { id: 1, name: '毫无兴趣', min: 0,  max: 29 },
  { id: 2, name: '愿意了解', min: 30, max: 69 },
  { id: 3, name: '热情',     min: 70, max: 100 },
];

const DAILY_LIMITS: Record<string, number> = {
  daily_done_on_time: 2,  // 防刷：每天最多 +2 上限封顶（一次满）
};

export async function applyAffinityEvent(
  userId: string,
  eventType: string,
  context?: object
): Promise<{ oldTier: number, newTier: number, delta: number }> {
  const delta = AFFINITY_DELTAS[eventType];
  if (delta === undefined) return { oldTier: 0, newTier: 0, delta: 0 };

  // 防刷
  if (DAILY_LIMITS[eventType]) {
    const todayCount = await countTodayEvents(userId, eventType);
    if (todayCount >= DAILY_LIMITS[eventType]) {
      return { oldTier: 0, newTier: 0, delta: 0 };
    }
  }

  const current = await getAffinity(userId);
  const newScore = clamp(current.score + delta, 0, 100);
  const newTier = computeTier(newScore);

  await Promise.all([
    insertAffinityEvent(userId, eventType, delta, context),
    updateAffinity(userId, newScore, newTier)
  ]);

  return { oldTier: current.tier, newTier, delta };
}

function computeTier(score: number): number {
  return STAGES.find(s => score >= s.min && score <= s.max)?.id ?? 1;
}
```

### 20.4 记忆引用决策器

```typescript
// /src/lib/feixia/memory-decision.ts

const SCENES_ALLOWING_MEMORY = [
  'absent_return',
  'reflection',
  'goal_setting',
  'free_chat',
];

const REFERENCE_COOLDOWN_HOURS = 24;  // 同一记忆 24h 不重复引用
const MIN_KEYWORD_OVERLAP_SCORE = 5;  // 关键词匹配阈值

export async function decideMemoryReference({
  userId, sceneId, userInput, memories
}: DecisionInput): Promise<Memory | null> {
  // 白名单检查
  if (!SCENES_ALLOWING_MEMORY.includes(sceneId)) return null;

  // 候选过滤：跳过 24h 内引用过的
  const cooldownThreshold = new Date(Date.now() - REFERENCE_COOLDOWN_HOURS*3600*1000);
  const candidates = memories.filter(m =>
    !m.last_referenced_at || m.last_referenced_at < cooldownThreshold
  );

  if (candidates.length === 0) return null;

  // 评分：importance × 10 + keywordOverlap × 5
  const scored = candidates.map(m => ({
    memory: m,
    score: m.importance * 10 + keywordOverlap(m.content, userInput) * 5
  }));

  // 久未归来场景特殊：直接选 importance 最高的，不需要关键词匹配
  if (sceneId === 'absent_return') {
    return scored.sort((a, b) => b.score - a.score)[0]?.memory ?? null;
  }

  const best = scored.sort((a, b) => b.score - a.score)[0];
  if (!best || best.score < MIN_KEYWORD_OVERLAP_SCORE) return null;

  return best.memory;
}

function keywordOverlap(memoryContent: string, userInput: string): number {
  // 简化实现：分词后求交集 / 用户输入分词数
  const memTokens = tokenize(memoryContent);
  const inputTokens = tokenize(userInput);
  const overlap = memTokens.filter(t => inputTokens.includes(t)).length;
  return overlap;
}
```

### 20.5 模板渲染 + LLM 调用

```typescript
// /src/lib/feixia/render.ts

export async function callLLMWithRetry(params: RenderInput): Promise<string> {
  const MAX_RETRIES = 2;

  for (let i = 0; i <= MAX_RETRIES; i++) {
    const prompt = buildPrompt(params);
    const raw = await callClaude(prompt);
    const validated = postProcess(raw, params.template);
    if (validated.ok) return validated.text;
  }

  // 兜底：返回模板的 fallback_text
  return params.template.fallback_text;
}

function buildPrompt(params: RenderInput): { system: string, user: string } {
  const system = FEIXIA_BASE_SYSTEM_PROMPT;  // 来自 feixia-character.md §四

  const user = `
${params.template.prompt_template}

${params.memoryRef ? `
【你记得这件事】（在合适时自然提起，不要刻意列举）：
${params.memoryRef.content}
` : ''}

【用户当前状态】
- 好感度阶段：${STAGES.find(s => s.id === params.state.tier)?.name}
- streak：${params.state.streak} 天
- 距上次互动：${params.state.last_contact_hours} 小时

【你最近说过的话】（禁止重复开头和句式）：
${params.recentUtterances.map(u => `- ${u.text}`).join('\n')}

【用户这次说】
${params.userInput || '(无文字输入)'}

请按上述 prompt_template 的要求输出。
`.trim();

  return { system, user };
}
```

### 20.6 后处理

```typescript
// /src/lib/feixia/postprocess.ts

const BANNED_WORDS = [
  '呵呵','嘻嘻','哈哈','太棒了','你真厉害','你好棒','加油哦','加油呀',
  '为您','请问','您好','作为AI','作为人工智能','我是一个AI'
];

const BANNED_TAIL_REGEX = /[呢哦嘛呀啦][。！？]?$/;

const FORBIDDEN_AI_REGEX = /作为(AI|人工智能|助手|系统)|我是(AI|一个AI|你的AI)/;

export function postProcess(
  raw: string,
  template: DialogueTemplate
): { ok: boolean, text: string, reason?: string } {
  const text = raw.trim();

  // 长度检查
  if (text.length > template.max_chars) {
    return { ok: false, text, reason: 'too_long' };
  }

  // 禁用词
  for (const word of BANNED_WORDS) {
    if (text.includes(word)) {
      return { ok: false, text, reason: `banned_word: ${word}` };
    }
  }

  // 句末助词
  if (BANNED_TAIL_REGEX.test(text)) {
    return { ok: false, text, reason: 'banned_tail' };
  }

  // AI 自指
  if (FORBIDDEN_AI_REGEX.test(text)) {
    return { ok: false, text, reason: 'ai_self_ref' };
  }

  // 问号数量限制（一次回复最多 1 个）
  const questionCount = (text.match(/[？?]/g) || []).length;
  if (questionCount > 1) {
    return { ok: false, text, reason: 'too_many_questions' };
  }

  return { ok: true, text };
}
```

---

## 21. 模板矩阵示例（方案 A 范围 · 15 条）

数据库 dialogue_templates 表初始数据。每条都极度收紧 LLM 输出空间：

### 模板 #1：onboarding · 阶段 1（毫无兴趣）
```yaml
scene_id: onboarding
tier: 1
prompt_template: |
  这是用户第一次见到你。你处于阶段 1「毫无兴趣」——他只是又一个用户。
  你要：
  - 不自我介绍
  - 不问"你好"
  - 用一句话把"开始"的主动权交给他
  - 极简、克制，几乎无情绪
  - ≤ 10 字
  - 例：「……说吧。」「想干什么。」「嗯。」

  用户的输入是：{userInput}
  你的回复（直接输出一句话）：

examples:
  - "……说吧。"
  - "想干什么。"
  - "嗯。"

fallback_text: "……说吧。"
max_chars: 12
```

### 模板 #2：task_complete · verdict=excellent · 阶段 2（愿意了解）
```yaml
scene_id: task_complete_excellent
tier: 2
prompt_template: |
  用户按时完成任务，AI 判定为"优秀"。你处于阶段 2「愿意了解」。
  他还在，也许值得你看一看。
  你要：
  - 不直接夸奖（禁止"太棒""厉害""棒"）
  - 用一句观察性陈述表达"我看到了"
  - 句首可带停顿「……」
  - ≤ 12 字
  - 例：「……今天认真了。」「比上次稳。」

  用户的复盘是：{userInput}
  你的回复：

examples:
  - "……今天认真了。"
  - "比上次稳。"
  - "做到了。"

fallback_text: "……今天认真了。"
max_chars: 15
```

### 模板 #3：absent_return · 阶段 3（热情）
```yaml
scene_id: absent_return
tier: 3
prompt_template: |
  用户消失了一段时间又回来了（{absent_hours} 小时未互动）。
  你处于阶段 3「热情」——他是你在意的人。但你不会表现雀跃，
  你会"提起"——这是你能给的最重的话。

  你要：
  - 句子陈述，句号结尾
  - 必须自然引用【你记得的事】，把它和"他回来了"连起来
  - ≤ 25 字
  - 例：「你回来了。」「上次你说想考研。那件事呢。」

  你记得的事：{memoryRef}
  用户的输入是：{userInput}
  你的回复：

examples:
  - "你回来了。"
  - "上次你说想考研。那件事呢。"
  - "我以为你不来了。"

fallback_text: "你回来了。"
max_chars: 30
```

> 完整 15 条模板（5 场景 × 3 阶段）由 A 角色 D1 17:00-19:00 撰写后入库。
> 三阶段命名：阶段 1 毫无兴趣 / 阶段 2 愿意了解 / 阶段 3 热情。
> 每条遵循「明确意图 + 严格字数 + few-shot 示例 + fallback 兜底」结构。

---

## 22. 测试与调试

### 22.1 单元测试关键模块
- `applyAffinityEvent` - 各事件 delta 是否正确，跨阈值是否切换 tier
- `decideMemoryReference` - 白名单、冷却、关键词匹配
- `postProcess` - 各类违规是否拦截
- `selectTemplate` - 缺失模板时的 fallback

### 22.2 集成测试场景
- 完整跑通：用户提交描述+复盘 → /api/feixia/task_complete → 收到回复 + 表情 + 好感度变化
- 重试链路：mock LLM 输出违规词 → 程序应重试 2 次 → 失败后用 fallback_text
- 阶段跃迁：按时完成 4 个支线任务（4×8=32）→ 跨过 score=30 阈值 → 应切到阶段 2 模板

### 22.3 Demo 兜底
- 预录制 5 组「典型问答」截图作为 demo 兜底
- score=0 和 score=60 两个固定演示账号，状态预填好
- 现场演示前先跑一遍完整流程录屏

---

## 23. 工时账（方案 A · 73 人时 · v3.1 砍拍照后）

| 模块 | 角色 | 工时 |
|------|------|------|
| 脚手架 + 路由 + DB schema 全表 | B | 4 |
| 场景路由 + 状态读取器 | C | 2 |
| 好感度引擎 | C | 3 |
| 记忆引擎（写+读+引用决策） | C | 4 |
| 模板渲染器 + 后处理 | C | 3 |
| 5 核心 Agent（任务拆解/文本判定/对话/复盘/NPC）| C | 5 |
| 20 NPC prompt | C | 2 |
| 选英雄页 + 对话页 + 任务树 + 状态栏 + 表情切换 | B | 8 |
| 描述+复盘双输入提交表单 | B | 1 |
| 商店页 + 换装页 | B | 3 |
| 社区/好友/排行榜壳子（v0.dev）| B | 4 |
| Vercel 部署 + 抛光 | B | 3 |
| 立绘 3 套（Midjourney）| A | 4 |
| 占位图 ~50 张（GPT Image 2）| A | 6 |
| 文案：选英雄 + 模板 15 条 + 台词 | A | 5 |
| PPT 5 页 + 配图 + 演讲稿 | A | 4 |
| Demo 演练 + 录屏 | A | 2 |
| Kickoff + 联调 + 缓冲 | 全员 | 10 |
| **合计** | | **73** |

3 人 × ≈24h ≈ 每人加班 4 小时（在 2 天 60h 基础上）。比 v3 的 78h 更可控。

**v3.1 节省的部分**：
- C 任务验证 Agent 从 Vision 简化为纯文本（-1h）
- B 拍照上传 + Storage 简化为文本表单（-1h）
- A 不再需要预跑 Vision 测试图（-1h）
- 整体联调缓冲时间减少（-2h）

---

*文档结束。任何范围变动请回到 §0 确认。*
