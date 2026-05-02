-- ───────────────────────────────────────────────
-- 演示账号（用于 demo 彩蛋：阶段 1 vs 阶段 3）
-- 阶段 1 账号：score=0，无记忆
-- 阶段 3 账号：score=80，预填 5 条记忆
-- ───────────────────────────────────────────────

-- 阶段 1 演示账号
INSERT INTO users (id, display_name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'demo_stage1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO affinity (user_id, score, stage) VALUES
  ('00000000-0000-0000-0000-000000000001', 0, 1)
ON CONFLICT (user_id) DO UPDATE SET score = 0, stage = 1, updated_at = NOW();

-- 阶段 3 演示账号
INSERT INTO users (id, display_name) VALUES
  ('00000000-0000-0000-0000-000000000003', 'demo_stage3')
ON CONFLICT (id) DO NOTHING;

INSERT INTO affinity (user_id, score, stage) VALUES
  ('00000000-0000-0000-0000-000000000003', 80, 3)
ON CONFLICT (user_id) DO UPDATE SET score = 80, stage = 3, updated_at = NOW();

-- 阶段 3 账号的预填记忆（让绯夏"记得"他做过的事）
INSERT INTO memories (user_id, category, content, importance, triggered_by) VALUES
  ('00000000-0000-0000-0000-000000000003', 'milestone',
   '他在 2026-04-22 完成了第一个主线"高数复习"，说当时手都在抖',
   3, 'main_quest_001'),
  ('00000000-0000-0000-0000-000000000003', 'confession',
   '他在复盘里写过："其实我不是怕考不上，我是怕考上了也没什么不同。"',
   3, 'reflection_017'),
  ('00000000-0000-0000-0000-000000000003', 'habit',
   '通常在晚上 10-11 点之间来，很少在早上',
   1, NULL),
  ('00000000-0000-0000-0000-000000000003', 'emotion',
   '连续 3 天任务完成度下滑，复盘字数从 200 降到 30',
   2, NULL),
  ('00000000-0000-0000-0000-000000000003', 'quote',
   '"今天和投资人聊了，感觉可以做一个 b 端平台。"',
   2, 'reflection_023')
ON CONFLICT DO NOTHING;
