import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/** 带重试的 fetch：网络错误时自动重试 2 次 */
async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const MAX_RETRIES = 2;
  const TIMEOUT_MS = 15000;

  let lastErr: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(input, {
        ...init,
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      return res;
    } catch (err: any) {
      lastErr = err;
      // 只对网络层错误重试（TypeError: fetch failed / 超时等）
      // 4xx/5xx 不会抛异常，会直接返回 Response，所以不需要判断
      const isNetworkError =
        err instanceof TypeError ||
        err?.name === 'AbortSignalTimeout' ||
        err?.name === 'TimeoutError';

      if (!isNetworkError || attempt === MAX_RETRIES) {
        throw err;
      }

      // 指数退避：500ms、1000ms
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }

  throw lastErr!;
}

export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      '[supabase] 缺少环境变量 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithRetry }
  });

  return _client;
}
