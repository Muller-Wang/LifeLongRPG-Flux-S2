import { getSupabase } from '../supabase';
import { normalizeUsername } from '@/lib/auth/username';

export type HeroId =
  | 'student'
  | 'corporate'
  | 'rich'
  | 'neet'
  | 'retiree'
  | 'freelancer'
  | 'researcher';

export interface UserProfile {
  id: string;
  publicUid: number | null;
  displayName: string | null;
  username: string | null;
  heroId: HeroId | null;
  currentGoal: string | null;
  points: number;
  streakCount: number;
  lastActiveAt: string;
  onboardedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface EnsureUserProfileInput {
  id: string;
  displayName?: string;
  username?: string;
  heroId?: HeroId;
  currentGoal?: string;
  points?: number;
  streakCount?: number;
  onboarded?: boolean;
  metadata?: Record<string, unknown>;
}

const VALID_HERO_IDS = new Set<HeroId>([
  'student',
  'corporate',
  'rich',
  'neet',
  'retiree',
  'freelancer',
  'researcher'
]);

export async function ensureUserProfile(
  input: EnsureUserProfileInput
): Promise<UserProfile> {
  if (!input.id) {
    throw new Error('[user] id 不能为空');
  }
  if (input.heroId && !VALID_HERO_IDS.has(input.heroId)) {
    throw new Error(`[user] 非法 heroId: ${input.heroId}`);
  }

  const normalizedUsername = normalizeUsername(input.username);

  const sb = getSupabase();
  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    id: input.id,
    last_active_at: now
  };

  if (input.displayName !== undefined) row.display_name = input.displayName;
  if (input.username !== undefined) row.username = normalizedUsername;
  if (input.heroId !== undefined) row.hero_id = input.heroId;
  if (input.currentGoal !== undefined) row.current_goal = input.currentGoal;
  if (input.points !== undefined) row.points = input.points;
  if (input.streakCount !== undefined) row.streak_count = input.streakCount;
  if (input.metadata !== undefined) row.metadata = input.metadata;
  if (input.onboarded === true) row.onboarded_at = now;

  const { data, error } = await sb
    .from('users')
    .upsert(row, { onConflict: 'id' })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`[user] upsert 失败: ${error?.message}`);
  }

  return mapUserRow(data);
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`[user] 读取失败: ${error.message}`);
  }

  return data ? mapUserRow(data) : null;
}

export async function getUserProfileByUsername(username: string): Promise<UserProfile | null> {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;

  const sb = getSupabase();
  const { data, error } = await sb
    .from('users')
    .select('*')
    .eq('username', normalized)
    .maybeSingle();

  if (error) {
    throw new Error(`[user] 按 username 读取失败: ${error.message}`);
  }

  return data ? mapUserRow(data) : null;
}

export async function addUserPoints(userId: string, delta: number): Promise<void> {
  const profile = await ensureUserProfile({ id: userId });
  const sb = getSupabase();
  const { error } = await sb
    .from('users')
    .update({
      points: Math.max(0, profile.points + delta),
      last_active_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (error) {
    throw new Error(`[user] points 更新失败: ${error.message}`);
  }
}

export async function touchUser(userId: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from('users')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    throw new Error(`[user] touch 失败: ${error.message}`);
  }
}

function mapUserRow(row: any): UserProfile {
  return {
    id: row.id,
    publicUid: typeof row.public_uid === 'number' ? row.public_uid : null,
    displayName: row.display_name,
    username: row.username,
    heroId: (row.hero_id ?? null) as HeroId | null,
    currentGoal: row.current_goal,
    points: row.points ?? 0,
    streakCount: row.streak_count ?? 0,
    lastActiveAt: row.last_active_at,
    onboardedAt: row.onboarded_at,
    metadata: row.metadata ?? {},
    createdAt: row.created_at
  };
}
