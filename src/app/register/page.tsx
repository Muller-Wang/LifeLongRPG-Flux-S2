'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AuthApiError } from '@supabase/supabase-js';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/components/auth/AuthProvider';
import { getBrowserSupabase, hasBrowserSupabaseEnv } from '@/lib/auth/client';
import { registerWithUsername } from '@/lib/client/api';
import { isValidUsername, normalizeUsername } from '@/lib/auth/username';

export default function RegisterPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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

    const trimmedName = name.trim();
    const normalizedUsername = normalizeUsername(username);
    if (!trimmedName || !normalizedUsername || password.length < 6) return;

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      if (!isValidUsername(normalizedUsername)) {
        setError('用户名需为 3-20 位，只能包含小写字母、数字和下划线。');
        return;
      }

      const result = await registerWithUsername({
        displayName: trimmedName,
        username: normalizedUsername,
        password
      });

      if (!result) {
        setError('注册失败，请稍后重试。');
        return;
      }

      const supabase = getBrowserSupabase();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: result.authEmail,
        password
      });

      if (signInError) {
        setMessage('注册成功，请直接用用户名和密码登录。');
        router.push('/login');
      } else {
        router.push('/select-hero');
      }
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError('注册失败，请稍后重试。');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-grid">
      <div className="relative w-full max-w-md animate-slide-up">
        {/* 角落 HUD */}
        <div className="absolute -top-3 -left-3 w-6 h-6 border-t-2 border-l-2 border-accent-flame" />
        <div className="absolute -top-3 -right-3 w-6 h-6 border-t-2 border-r-2 border-accent-flame" />
        <div className="absolute -bottom-3 -left-3 w-6 h-6 border-b-2 border-l-2 border-accent-flame" />
        <div className="absolute -bottom-3 -right-3 w-6 h-6 border-b-2 border-r-2 border-accent-flame" />

        <div className="bg-bg-card border border-line cut-both p-10">
          {/* Logo */}
          <div className="text-center mb-10">
            <div className="font-display text-4xl tracking-[0.4em] text-accent-flame mb-2">
              LIFELONGRPG
            </div>
            <div className="font-display text-xl tracking-widest text-text-dim mb-3">命途</div>
            <div className="font-mono text-[10px] tracking-[0.3em] text-text-mute">
              把人生变成一场你愿意打通关的游戏
            </div>
          </div>

          {/* 版本标 */}
          <div className="mb-6 flex items-center justify-center gap-2 font-mono text-[10px] tracking-widest text-text-mute">
            <span className="w-2 h-2 bg-accent-cyan rounded-full animate-pulse" />
            <span>BETA · v0.3 · ACCOUNT REGISTER</span>
          </div>

          <div className="mb-2 font-mono text-[10px] tracking-widest text-text-dim uppercase">
            Step 01 · 创建账号
          </div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            placeholder="冒险者名字（怎么叫都行）"
            autoFocus
            className="w-full bg-bg-deep border border-line text-base text-text px-4 py-3 mb-4 cut-tl outline-none focus:border-accent-flame transition"
          />
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            placeholder="用户名（3-20 位，小写字母/数字/下划线）"
            className="w-full bg-bg-deep border border-line text-base text-text px-4 py-3 mb-4 cut-tl outline-none focus:border-accent-flame transition"
          />
          <input
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            placeholder="密码（至少 6 位）"
            type="password"
            className="w-full bg-bg-deep border border-line text-base text-text px-4 py-3 mb-4 cut-tl outline-none focus:border-accent-flame transition"
          />

          {error && (
            <div className="mb-4 text-xs text-accent-flame font-mono">{error}</div>
          )}
          {message && (
            <div className="mb-4 text-xs text-accent-cyan font-mono">{message}</div>
          )}
          {!authReady && (
            <div className="mb-4 text-xs text-accent-flame font-mono">
              当前未配置 `NEXT_PUBLIC_SUPABASE_ANON_KEY`，注册功能暂不可用。
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={
              !name.trim() ||
              !username.trim() ||
              password.length < 6 ||
              submitting ||
              !authReady
            }
            onClick={submit}
            icon={<ArrowRight size={16} />}
          >
            {submitting ? '注册中…' : '创建账号'}
          </Button>

          <div className="mt-5 text-[10px] text-text-mute text-center font-mono leading-relaxed">
            当前本地阶段使用用户名 + 密码注册与登录<br />
            后续会补充绑定邮箱功能<br />
            已有账号？
            <Link href="/login" className="text-accent-flame hover:underline ml-1">
              去登录
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
