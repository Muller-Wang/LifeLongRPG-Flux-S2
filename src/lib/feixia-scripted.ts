/**
 * 绯夏 · onboarding 阶段的预设台词库
 *
 * 设计原则：
 * - 进入主页之前的所有对话框文本都从这里取，不调 LLM
 * - 文本风格遵循阶段 1（保持距离）的人设：御姐风范，有温度但有边界
 * - 按职业差异化（让用户感到"她看到了我是谁"）
 * - 关键节点（如即时回应主线）支持模板插值
 *
 * 进入主页后才开始走 LLM（按好感度阶段加载提示词）。
 */

import type { HeroId } from './client/storage';

// ─── 1. 初次见面（用户刚选完英雄）─────────────────────
// 不同职业的差异化开场，体现"她看见你是什么人"
const INTRO_BY_HERO: Record<HeroId, string> = {
  student:    '……笔记本合上。\n眼睛睁开。',
  corporate:  '今天先在这里坐五分钟再说。',
  rich:       '钱不是问题——\n问题是你拿它干什么。',
  neet:       '门外那个不是外卖。\n……是你自己。',
  retiree:    '别动。\n你还有六十年没活完。',
  freelancer: '凌晨三点的那条消息——\n这次不许回。',
  researcher: 'P 值不是答案。\n是借口。'
};

// ─── 2. 引导用户设定主线（进入 main 阶段）──────────────
// 一句话，让用户停下来认真想"为什么是现在"
const MAIN_GUIDE_VARIANTS = [
  '主线我不替你写。\n想清楚——你为什么是现在，做这件事。',
  '主线只能你自己写。\n别敷衍——这是你的命途，不是我的。',
  '我不会给你模板。\n写下来——哪怕只有一句，也得是你的。'
];

// ─── 3. 即时回应主线（用户提交主线后）─────────────────
// 模板插值：{first} = 用户写的第一条主线 title
// 按主线条数分支
const MAIN_REACT_SINGLE = '「{first}」。\n……知道了。剩下的我看着。';
const MAIN_REACT_MULTI = '「{first}」……还有几个。\n先把这一个做实再说。';
const MAIN_REACT_TOO_MANY = '你写了 {count} 条。\n……贪心。但记住——一次只能往前走一步。';

// ─── 4. 全部完成，准备进主页 ──────────────────────────
const COMPLETE_VARIANTS = [
  '准备好了。\n进吧。',
  '走了。\n剩下的路你自己迈。',
  '可以了。\n我在你右边。'
];

// ─── 5. 进入 home 后绯夏主动开场（带昵称插值）─────────────
// 按好感度阶段切换冷暖度。{name} 替换为用户昵称
const HOME_GREETING: Record<1 | 2 | 3, string[]> = {
  1: [
    '{name}……到了。',
    '嗯。{name}。',
    '{name}，坐。'
  ],
  2: [
    '今天过得怎么样，{name}？',
    '{name}……我等了你一会儿。',
    '回来了，{name}。从今天的事说起。'
  ],
  3: [
    '{name}。\n你来了。',
    '终于看到你了，{name}。',
    '我在等你，{name}。'
  ]
};

// ─── API ────────────────────────────────────────────

/** 初次见面台词（按职业）*/
export function getIntroLine(heroId: HeroId | null | undefined): string {
  if (!heroId) return '……说吧。';
  return INTRO_BY_HERO[heroId] ?? '……说吧。';
}

/** 主线引导台词（多个变体随机选一句，避免反复进入永远是同一句）*/
export function getMainGuideLine(): string {
  return pickRandom(MAIN_GUIDE_VARIANTS);
}

/** 主线即时回应（按用户提交的主线数量选模板 + 插值）*/
export function getMainReactLine(mainTitles: string[]): string {
  if (mainTitles.length === 0) return '……';
  const first = mainTitles[0];
  if (mainTitles.length === 1) {
    return MAIN_REACT_SINGLE.replace('{first}', first);
  }
  if (mainTitles.length <= 3) {
    return MAIN_REACT_MULTI.replace('{first}', first);
  }
  return MAIN_REACT_TOO_MANY
    .replace('{count}', String(mainTitles.length))
    .replace('{first}', first);
}

/** 全部完成台词 */
export function getCompleteLine(): string {
  return pickRandom(COMPLETE_VARIANTS);
}

/** 进入 home 后的主动开场（带昵称 · 按好感度阶段冷暖切换）*/
export function getHomeGreetingLine(name: string, stage: 1 | 2 | 3): string {
  const variants = HOME_GREETING[stage] ?? HOME_GREETING[1];
  const safeName = (name ?? '').trim() || '冒险者';
  return pickRandom(variants).replace(/\{name\}/g, safeName);
}

// ─── 内部 ────────────────────────────────────────
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
