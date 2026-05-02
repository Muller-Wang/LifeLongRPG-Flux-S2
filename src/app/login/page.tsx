'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { AuthApiError } from '@supabase/supabase-js';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/components/auth/AuthProvider';
import { getBrowserSupabase, hasBrowserSupabaseEnv } from '@/lib/auth/client';
import { getProfileByUsername } from '@/lib/client/api';
import { buildUsernameAuthEmail } from '@/lib/auth/username';

export default function LoginPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authReady = hasBrowserSupabaseEnv();

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (!profile?.heroId) {
      router.replace('/select-hero');
      return;
    }
    if (!profile?.onboardedAt) {
      router.replace('/onboarding');
      return;
    }
    router.replace('/home');
  }, [router, user, profile, loading]);

  async function submit() {
    if (!authReady) {
      setError('缺少 NEXT_PUBLIC_SUPABASE_ANON_KEY，请先补全前端 Supabase 配置。');
      return;
    }

    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier || !password) return;

    setSubmitting(true);
    setError(null);
    try {
      const email = await resolveLoginEmail(trimmedIdentifier);
      if (!email) {
        setError('未找到对应账号，请检查用户名或邮箱。');
        return;
      }

      const supabase = getBrowserSupabase();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) throw signInError;
      router.push('/');
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError('登录失败，请稍后重试。');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-grid">
      <div className="relative w-full max-w-md animate-slide-up">
        <div className="absolute -top-3 -left-3 w-6 h-6 border-t-2 border-l-2 border-accent-flame" />
        <div className="absolute -top-3 -right-3 w-6 h-6 border-t-2 border-r-2 border-accent-flame" />
        <div className="absolute -bottom-3 -left-3 w-6 h-6 border-b-2 border-l-2 border-accent-flame" />
        <div className="absolute -bottom-3 -right-3 w-6 h-6 border-b-2 border-r-2 border-accent-flame" />

        <div className="bg-bg-card border border-line cut-both p-10">
          <div className="text-center mb-10">
            <div className="font-display text-4xl tracking-[0.4em] text-accent-flame mb-2">
              LIFELONGRPG
            </div>
            <div className="font-display text-xl tracking-widest text-text-dim mb-3">命途</div>
            <div className="font-mono text-[10px] tracking-[0.3em] text-text-mute">
              登录后继续你的命途进度
            </div>
          </div>

          <div className="mb-6 flex items-center justify-center gap-2 font-mono text-[10px] tracking-widest text-text-mute">
            <span className="w-2 h-2 bg-accent-cyan rounded-full animate-pulse" />
            <span>BETA · v0.3 · SIGN IN</span>
          </div>

          <div className="mb-2 font-mono text-[10px] tracking-widest text-text-dim uppercase">
            Step 00 · 登录账号
          </div>

          <input
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            placeholder="用户名"
            type="text"
            autoFocus
            className="w-full bg-bg-deep border border-line text-base text-text px-4 py-3 mb-4 cut-tl outline-none focus:border-accent-flame transition"
          />
          <input
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            placeholder="密码"
            type="password"
            className="w-full bg-bg-deep border border-line text-base text-text px-4 py-3 mb-4 cut-tl outline-none focus:border-accent-flame transition"
          />

          {error && (
            <div className="mb-4 text-xs text-accent-flame font-mono">{error}</div>
          )}
          {!authReady && (
            <div className="mb-4 text-xs text-accent-flame font-mono">
              当前未配置 `NEXT_PUBLIC_SUPABASE_ANON_KEY`，登录功能暂不可用。
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!identifier.trim() || !password || submitting || !authReady}
            onClick={submit}
            icon={<ArrowRight size={16} />}
          >
            {submitting ? '登录中…' : '进入命途'}
          </Button>

          <div className="mt-5 text-[10px] text-text-mute text-center font-mono leading-relaxed">
            当前本地阶段使用用户名 + 密码登录<br />
            还没有账号？
            <Link href="/register" className="text-accent-flame hover:underline ml-1">
              去注册
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

async function resolveLoginEmail(identifier: string): Promise<string | null> {
  const normalized = identifier.trim().toLowerCase();
  if (!normalized) return null;

  const profile = await getProfileByUsername(normalized);
  const email = profile?.metadata?.email;
  if (typeof email === 'string' && email.trim()) {
    return email.trim().toLowerCase();
  }

  try {
    return buildUsernameAuthEmail(normalized);
  } catch {
    return null;
  }
}
