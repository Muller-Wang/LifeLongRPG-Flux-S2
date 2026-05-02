export function normalizeUsername(value: string | undefined | null): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

export function isValidUsername(value: string | undefined | null): boolean {
  const normalized = normalizeUsername(value);
  return normalized ? /^[a-z0-9_]{3,20}$/.test(normalized) : false;
}

export function buildUsernameAuthEmail(username: string): string {
  const normalized = normalizeUsername(username);
  if (!normalized || !isValidUsername(normalized)) {
    throw new Error('[auth.username] 用户名不合法');
  }
  return `${normalized}@lifelongrpg.local`;
}
