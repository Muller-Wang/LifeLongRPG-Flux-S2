'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
 ArrowLeft, Save, Heart, Coins, Sword, RefreshCw,
 CheckCircle2, AlertTriangle, Zap
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import {
 getAffinityState,
 bootstrapProfile,
 adminSetAffinity
} from '@/lib/client/api';
import { HEROES } from '@/lib/heroes';
import type { HeroId } from '@/lib/client/storage';

const STAGE_NAMES: Record<1 | 2 | 3, string> = {
 1: '保持距离',
 2: '愿意了解',
 3: '深厚羁绊'
};
const STAGE_COLORS: Record<1 | 2 | 3, string> = {
 1: '#5A6A7E',
 2: '#084B83',
 3: '#FFBC42'
};
// 三阶段快捷跳转分数（取每段中点附近）
const STAGE_QUICK_SCORE: Record<1 | 2 | 3, number> = {
 1: 10,
 2: 50,
 3: 85
};

const STAGE_RARITY_CLASS: Record<1 | 2 | 3, string> = {
 1: 'rarity-n',
 2: 'rarity-sr',
 3: 'rarity-ssr'
};

type ToastType = 'ok' | 'err';
interface Toast {
 type: ToastType;
 text: string;
}

export default function AdminPage() {
 const router = useRouter();
 const { user, profile, loading, refreshProfile } = useAuth();

 const [score, setScore] = useState<number>(0);
 const [stage, setStage] = useState<1 | 2 | 3>(1);
 const [pointsDraft, setPointsDraft] = useState<string>('0');
 const [heroDraft, setHeroDraft] = useState<HeroId | ''>('');
 const [onboardedDraft, setOnboardedDraft] = useState(false);
 const [busy, setBusy] = useState<string | null>(null);
 const [toast, setToast] = useState<Toast | null>(null);

 // 守卫 + 初次拉数据
 useEffect(() => {
 if (loading) return;
 if (!user) { router.replace('/login'); return; }

 getAffinityState(user.id).then(s => {
  setScore(s.score);
  setStage(s.stage);
 });
 }, [loading, user, router]);

 // profile 同步到 draft
 useEffect(() => {
 if (!profile) return;
 setPointsDraft(String(profile.points ?? 0));
 setHeroDraft((profile.heroId ?? '') as HeroId | '');
 setOnboardedDraft(!!profile.onboardedAt);
 }, [profile]);

 function showToast(t: Toast) {
 setToast(t);
 setTimeout(() => setToast(null), 2200);
 }

 async function applyAffinity(targetScore: number) {
 if (!user) return;
 setBusy('affinity');
 const result = await adminSetAffinity(user.id, targetScore);
 setBusy(null);
 if (!result) {
  showToast({ type: 'err', text: '好感度写入失败（看控制台）' });
  return;
 }
 setScore(result.score);
 setStage(result.stage);
 showToast({ type: 'ok', text: `已设为 ${result.score} · ${STAGE_NAMES[result.stage]}` });
 }

 async function applyProfile(patch: {
 points?: number;
 heroId?: HeroId;
 onboarded?: boolean;
 }) {
 if (!user) return;
 setBusy('profile');
 const result = await bootstrapProfile({ userId: user.id, ...patch });
 await refreshProfile();
 setBusy(null);
 if (!result) {
  showToast({ type: 'err', text: '档案写入失败' });
  return;
 }
 showToast({ type: 'ok', text: '已保存' });
 }

 const heroNow = profile?.heroId
 ? HEROES.find(h => h.id === profile.heroId)
 : null;

 if (loading || !user) {
 return (
  <main className="app-world-bg min-h-screen flex items-center justify-center">
  <div className="font-mono text-xs tracking-widest text-text-mute">LOADING…</div>
  </main>
 );
 }

 return (
 <main className="app-world-bg min-h-screen px-6 py-8">
  <div className="max-w-4xl mx-auto">
  {/* 顶栏 */}
  <header className="flex items-center justify-between mb-6 animate-fade-in">
   <div>
   <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.3em] text-accent-flame mb-2">
    <span className="w-2 h-2 bg-accent-flame animate-pulse"/>
    <span>DEBUG · 调试后台</span>
   </div>
   <h1 className="font-display text-3xl tracking-wider text-text-display title-deco">
    账号数据调试台
   </h1>
   <p className="text-xs text-text-dim mt-1 font-mono">
    当前账号 · {profile?.displayName ?? '冒险者'} · UID {profile?.publicUid ?? '--'} · ID {user.id.slice(0, 8)}
   </p>
   </div>
   <Link
   href="/home"
   className="flex items-center gap-1.5 text-sm text-text-dim hover:text-accent-flame transition border-2 border-line px-3 py-2 hover:border-primary-DEFAULT"
   >
   <ArrowLeft size={14} />
   回主页
   </Link>
  </header>

  {/* 警告横条 */}
  <div className="bg-accent-warning/5 border-2 border-accent-warning p-3 mb-6 flex items-start gap-2 text-xs text-text">
   <AlertTriangle size={14} className="text-accent-warning mt-0.5 shrink-0"/>
   <div>
   <span className="font-bold text-accent-warning">仅供本地测试。</span>
   <span className="text-text-dim ml-1">
    这里直接写数据库，绕过事件 / 防刷 / 业务校验。Beta 阶段无权限保护——上线前必须加管理员鉴权。
   </span>
   </div>
  </div>

  <div className="grid md:grid-cols-2 gap-4">
   {/* ─── 好感度 ─── */}
   <section className="card space-y-4">
   <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-line">
    <Heart size={14} style={{ color: STAGE_COLORS[stage] }} />
    <span className="font-mono text-[10px] tracking-[0.3em] text-text-dim">
    AFFINITY · 好感度
    </span>
   </div>

   <div className="mb-4">
    <div className="flex items-baseline justify-between mb-2">
    <span className="text-xs text-text-dim">当前</span>
    <div className="flex items-baseline gap-2">
     <span
     className="font-display text-3xl font-bold leading-none"
     style={{ color: STAGE_COLORS[stage] }}
     >
     {score}
     </span>
     <span
     className="font-mono text-[10px] tracking-widest"
     style={{ color: STAGE_COLORS[stage] }}
     >
     STAGE {stage} · {STAGE_NAMES[stage]}
     </span>
    </div>
    </div>
    {/* 进度条 */}
    <div className="relative h-2 bg-bg-deep border-2 border-line">
    <div
     className="absolute inset-y-0 left-0 transition-all duration-500"
     style={{
     width: `${Math.max(2, score)}%`,
     background: `linear-gradient(90deg, #084B83, ${STAGE_COLORS[stage]})`
     }}
    />
    {/* 阶段分隔线 */}
    <div className="absolute inset-y-0 left-[30%] w-px bg-border-light"/>
    <div className="absolute inset-y-0 left-[70%] w-px bg-border-light"/>
    </div>
    <div className="flex justify-between font-mono text-[9px] text-text-mute mt-1">
    <span>0</span><span>30</span><span>70</span><span>100</span>
    </div>
   </div>

   {/* 滑块 + 输入 */}
   <div className="space-y-2">
    <input
    type="range"
    min={0}
    max={100}
    step={1}
    value={score}
    onChange={e => setScore(Number(e.target.value))}
    className="w-full accent-primary-DEFAULT"
    />
    <div className="flex items-center gap-2">
    <input
     type="number"
     min={0}
     max={100}
     value={score}
     onChange={e => setScore(Number(e.target.value))}
     className="w-20 bg-bg-deep border border-line cut-tl text-sm py-1.5"
    />
    <button
     onClick={() => applyAffinity(score)}
     disabled={busy === 'affinity'}
     className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-accent-flame text-white text-sm border-2 border-primary-DEFAULT hover:bg-primary-hover disabled:opacity-50 transition"
    >
     <Save size={12} />
     {busy === 'affinity' ? '保存中…' : '应用'}
    </button>
    </div>
   </div>

   {/* 三阶段快捷 */}
   <div className="mt-4 pt-3 border-t-2 border-line">
    <div className="font-mono text-[9px] tracking-widest text-text-mute mb-2">
    快捷 · 一键跳阶段
    </div>
    <div className="grid grid-cols-3 gap-2">
    {([1, 2, 3] as const).map(s => (
     <button
     key={s}
     onClick={() => applyAffinity(STAGE_QUICK_SCORE[s])}
     disabled={busy === 'affinity'}
     className={`px-2 py-2 text-xs flex flex-col items-center gap-0.5 hover:bg-bg-deep transition disabled:opacity-50 ${STAGE_RARITY_CLASS[s]}`}
     >
     <span className="font-mono text-[9px] tracking-widest opacity-70">
      → {STAGE_QUICK_SCORE[s]}
     </span>
     <span className="font-bold">{STAGE_NAMES[s]}</span>
     </button>
    ))}
    </div>
   </div>

   {/* 微调 */}
   <div className="mt-3 grid grid-cols-4 gap-1">
    {[-10, -5, 5, 10].map(d => (
    <button
     key={d}
     onClick={() => applyAffinity(score + d)}
     disabled={busy === 'affinity'}
     className="px-2 py-1 text-xs font-mono border-2 border-line text-text-dim hover:text-accent-flame hover:border-primary-DEFAULT transition disabled:opacity-50"
    >
     {d > 0 ? `+${d}` : d}
    </button>
    ))}
   </div>

   <button
    onClick={() => applyAffinity(0)}
    disabled={busy === 'affinity'}
    className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-text-dim border-2 border-line hover:text-accent-flame hover:border-primary-DEFAULT transition disabled:opacity-50"
   >
    <RefreshCw size={12} />
    清零（绝交）
   </button>
   </section>

   {/* ─── 档案字段 ─── */}
   <section className="card space-y-5">
   {/* 点数 */}
   <div>
    <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-line">
    <Coins size={14} className="text-accent-gold"/>
    <span className="font-mono text-[10px] tracking-[0.3em] text-text-dim">
     POINTS · 点数
    </span>
    </div>
    <div className="flex items-center gap-2">
    <input
     type="number"
     min={0}
     value={pointsDraft}
     onChange={e => setPointsDraft(e.target.value)}
     className="flex-1 bg-bg-deep border border-line cut-tl text-sm py-1.5"
    />
    <button
     onClick={() => {
     const n = Number(pointsDraft);
     if (!Number.isFinite(n) || n < 0) {
      showToast({ type: 'err', text: '点数必须 ≥ 0' });
      return;
     }
     applyProfile({ points: Math.round(n) });
     }}
     disabled={busy === 'profile'}
     className="flex items-center gap-1 px-3 py-1.5 bg-accent-gold/10 border-2 border-accent-DEFAULT text-accent-gold text-sm hover:bg-accent-gold/20 disabled:opacity-50 transition"
    >
     <Save size={12} />
     保存
    </button>
    </div>
    <div className="font-mono text-[10px] text-text-mute mt-1.5">
    数据库当前值 · {profile?.points ?? 0}
    </div>
   </div>

   {/* 职业 */}
   <div className="pt-2 border-t-2 border-line">
    <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-line">
    <Sword size={14} className="text-accent-flame"/>
    <span className="font-mono text-[10px] tracking-[0.3em] text-text-dim">
     HERO · 职业
    </span>
    </div>
    <div className="flex items-center gap-2">
    <select
     value={heroDraft}
     onChange={e => setHeroDraft(e.target.value as HeroId | '')}
     className="flex-1 bg-bg-deep border border-line cut-tl text-sm py-1.5"
    >
     <option value="">（未选）</option>
     {HEROES.map(h => (
     <option key={h.id} value={h.id}>
      {h.name} · {h.id}
     </option>
     ))}
    </select>
    <button
     onClick={() => {
     if (!heroDraft) {
      showToast({ type: 'err', text: '请先选一个职业' });
      return;
     }
     applyProfile({ heroId: heroDraft });
     }}
     disabled={busy === 'profile' || !heroDraft}
     className="flex items-center gap-1 px-3 py-1.5 border-2 border-primary-DEFAULT text-accent-flame text-sm hover:bg-primary-light disabled:opacity-50 transition"
    >
     <Save size={12} />
     保存
    </button>
    </div>
    {heroNow && (
    <div className="font-mono text-[10px] text-text-mute mt-1.5">
     数据库当前 · <span style={{ color: heroNow.accent }}>{heroNow.name}</span>
    </div>
    )}
   </div>

   {/* Onboarded */}
   <div className="pt-2 border-t-2 border-line">
    <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-line">
    <CheckCircle2 size={14} className="text-accent-flame"/>
    <span className="font-mono text-[10px] tracking-[0.3em] text-text-dim">
     ONBOARDED · 完成引导
    </span>
    </div>
    <label className="flex items-center gap-2 cursor-pointer">
    <input
     type="checkbox"
     checked={onboardedDraft}
     onChange={e => setOnboardedDraft(e.target.checked)}
     className="accent-primary-DEFAULT"
    />
    <span className="text-sm text-text">标记为已完成 onboarding</span>
    </label>
    <button
    onClick={() => {
     // bootstrapProfile 只有 onboarded === true 才会写 onboarded_at
     // 取消勾选时这里没有"反向操作"的 API（DB 层加 reset 才行）
     if (!onboardedDraft) {
     showToast({ type: 'err', text: '取消 onboarded 需另加 API（待做）' });
     return;
     }
     applyProfile({ onboarded: true });
    }}
    disabled={busy === 'profile'}
    className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 border-2 border-primary-DEFAULT text-accent-flame text-sm hover:bg-primary-light disabled:opacity-50 transition"
    >
    <Save size={12} />
    应用
    </button>
    <div className="font-mono text-[10px] text-text-mute mt-1.5">
    数据库当前 ·{' '}
    {profile?.onboardedAt
     ? new Date(profile.onboardedAt).toLocaleString('zh-CN')
     : '未完成'}
    </div>
   </div>
   </section>
  </div>

  {/* 危险区 */}
  <section className="mt-4 card border-2 border-accent-warning">
   <div className="flex items-center gap-2 mb-3">
   <Zap size={14} className="text-accent-warning"/>
   <span className="font-mono text-[10px] tracking-[0.3em] text-accent-warning">
    DANGER ZONE · 待加
   </span>
   </div>
   <div className="text-xs text-text-dim leading-relaxed">
   清空所有任务、清空所有记忆、删除账号 — 这些操作需要写专门的 API（直接 DELETE 表行）。
   等需要时告诉我加哪一个。
   </div>
  </section>
  </div>

  {/* Toast */}
  {toast && (
  <div
   className={`fixed bottom-6 right-6 px-4 py-2.5 border-2 text-sm animate-slide-up ${
   toast.type === 'ok'
    ? 'bg-bg-card border-primary-DEFAULT text-accent-flame'
    : 'bg-bg-card border-accent-warning text-accent-warning'
   }`}
  >
   {toast.text}
  </div>
  )}
 </main>
 );
}
