/**
 * localStorage 封装
 *
 * 认证由 Supabase Auth 管理（见 components/auth/AuthProvider），
 * 但 hero / onboarded / username 状态目前仍保留 localStorage 兼容路径，
 * select-hero / onboarding 等 UI 仍可同步读写本地。AuthProvider profile
 * 是数据库的 SSOT，本地是兼容层。
 *
 * quests / points 迁移到按 userId scoped（同设备多账号互不污染）。
 */

const KEY = {
  userId:     'lifelongrpg_userId',
  username:   'lifelongrpg_username',
  heroId:     'lifelongrpg_heroId',
  onboarded:  'lifelongrpg_onboarded',
  quests:     'lifelongrpg_quests',
  points:     'lifelongrpg_points'
} as const;

export type HeroId =
  | 'student'      // 大学生
  | 'corporate'    // 社畜
  | 'rich'         // 富哥
  | 'neet'         // 家里蹲
  | 'retiree'      // 退休大爷
  | 'freelancer'   // 自由职业者
  | 'researcher';  // 科研人员

export interface QuestData {
  mainQuests: { id: string; title: string; description?: string }[];
  sideQuests: { id: string; title: string; templateKey?: string; parentMainId?: string }[];
  subTasks:   { id: string; title: string; parentId: string; done?: boolean }[];
}

const isClient = () => typeof window !== 'undefined';

function genId(): string {
  if (isClient() && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── User ─────────────────────────────────
export function getUserId(): string | null {
  if (!isClient()) return null;
  return localStorage.getItem(KEY.userId);
}

export function ensureUserId(): string {
  if (!isClient()) return '';
  let uid = localStorage.getItem(KEY.userId);
  if (!uid) {
    uid = genId();
    localStorage.setItem(KEY.userId, uid);
  }
  return uid;
}

export function setUsername(name: string) {
  if (!isClient()) return;
  localStorage.setItem(KEY.username, name);
}
export function getUsername(): string {
  if (!isClient()) return '';
  return localStorage.getItem(KEY.username) ?? '';
}

// ─── Hero ─────────────────────────────────
export function setHero(hero: HeroId) {
  if (!isClient()) return;
  localStorage.setItem(KEY.heroId, hero);
}
export function getHero(): HeroId | null {
  if (!isClient()) return null;
  return (localStorage.getItem(KEY.heroId) as HeroId | null) ?? null;
}

// ─── Onboarded flag ───────────────────────
export function setOnboarded(v: boolean) {
  if (!isClient()) return;
  if (v) localStorage.setItem(KEY.onboarded, 'true');
  else localStorage.removeItem(KEY.onboarded);
}
export function isOnboarded(): boolean {
  if (!isClient()) return false;
  return localStorage.getItem(KEY.onboarded) === 'true';
}

// ─── Quests (scoped by userId) ────────────
export function setQuests(q: QuestData, userId: string) {
  if (!isClient()) return;
  localStorage.setItem(scopedKey(KEY.quests, userId), JSON.stringify(q));
}
export function getQuests(userId: string): QuestData {
  if (!isClient()) return { mainQuests: [], sideQuests: [], subTasks: [] };
  const raw = localStorage.getItem(scopedKey(KEY.quests, userId));
  if (!raw) return { mainQuests: [], sideQuests: [], subTasks: [] };
  try { return JSON.parse(raw); }
  catch { return { mainQuests: [], sideQuests: [], subTasks: [] }; }
}

export function newQuestId(): string { return genId(); }

// ─── Points (scoped by userId) ────────────
export function getPoints(userId: string): number {
  if (!isClient()) return 0;
  return Number(localStorage.getItem(scopedKey(KEY.points, userId)) ?? 0);
}
export function addPoints(userId: string, n: number) {
  if (!isClient()) return;
  const cur = getPoints(userId);
  localStorage.setItem(scopedKey(KEY.points, userId), String(Math.max(0, cur + n)));
}

// ─── Reset ────────────────────────────────

/** 清当前设备本地缓存（不影响数据库），可指定 userId 只清单用户 */
export function resetLocalProgress(userId?: string | null) {
  if (!isClient()) return;
  if (userId) {
    localStorage.removeItem(scopedKey(KEY.quests, userId));
    localStorage.removeItem(scopedKey(KEY.points, userId));
    return;
  }
  Object.values(KEY).forEach(k => {
    Object.keys(localStorage)
      .filter(storageKey => storageKey.startsWith(`${k}:`))
      .forEach(storageKey => localStorage.removeItem(storageKey));
  });
}

/** 兼容旧调用：清空所有本地状态（包括 user/hero/onboarded） */
export function resetAll() {
  if (!isClient()) return;
  Object.values(KEY).forEach(k => {
    localStorage.removeItem(k);
    Object.keys(localStorage)
      .filter(storageKey => storageKey.startsWith(`${k}:`))
      .forEach(storageKey => localStorage.removeItem(storageKey));
  });
}

function scopedKey(key: string, userId: string) {
  return `${key}:${userId}`;
}
