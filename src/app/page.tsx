'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/Button';

/** 入口路由：根据真实 session + public.users 状态分发 */
export default function Home() {
  const router = useRouter();
  const [phase, setPhase] = useState<'init' | 'guest' | 'redirecting'>('init');
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setPhase('guest');
      return;
    }

    if (!profile?.heroId) {
      router.replace('/select-hero');
      return;
    }

    if (!profile?.onboardedAt) {
      router.replace('/onboarding');
      return;
    }

    setPhase('redirecting');
    router.replace('/home');
  }, [router, user, profile, loading]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      {phase === 'guest' ? (
        <div className="w-full max-w-xl px-6 text-center animate-fade-in">
          <div className="font-display text-4xl tracking-[0.4em] text-accent-flame mb-3">
            LIFELONGRPG
          </div>
          <div className="font-display text-xl tracking-widest text-text-dim mb-4">命途</div>
          <p className="text-sm text-text-dim mb-8">
            登录后继续你的命途进度，或注册一个新账号开始这场人生副本。
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/login" className="w-full sm:w-auto">
              <Button variant="primary" size="lg" fullWidth>
                去登录
              </Button>
            </Link>
            <Link href="/register" className="w-full sm:w-auto">
              <Button variant="ghost" size="lg" fullWidth>
                创建账号
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <div className="font-display text-3xl tracking-[0.4em] text-accent-flame mb-3 animate-pulse">
            LIFELONGRPG
          </div>
          <div className="font-mono text-[10px] tracking-[0.3em] text-text-dim">
            {phase === 'init' ? 'INITIALIZING…' : 'REDIRECTING…'}
          </div>
        </div>
      )}
    </main>
  );
}
