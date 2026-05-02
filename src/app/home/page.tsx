'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sword, RefreshCw, LogOut, X, Calendar, TrendingUp, Sparkles, Flame, Wrench, Users, Globe, Trophy, ShoppingBag } from 'lucide-react';
import { ProfileBar } from '@/components/ProfileBar';
import { QuestSidebar } from '@/components/QuestSidebar';
import { DialogueArea } from '@/components/DialogueArea';
import { FeixiaPortrait } from '@/components/FeixiaPortrait';
import { TaskRewardModal } from '@/components/TaskRewardModal';
import {
  getQuests,
  setQuests,
  resetLocalProgress,
  QuestData
} from '@/lib/client/storage';
import { getAffinityState, saveQuestTree } from '@/lib/client/api';
import { getHero as findHero } from '@/lib/heroes';
import { useAuth } from '@/components/auth/AuthProvider';
import Link from 'next/link';

export default function HomePage() {
  const router = useRouter();
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const [questData, setQuestData] = useState<QuestData>({ mainQuests: [], sideQuests: [], subTasks: [] });
  const [refreshKey, setRefreshKey] = useState(0);
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [speaking, setSpeaking] = useState(false);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [activeSubId, setActiveSubId] = useState<string | null>(null);
  const [activeSubTitle, setActiveSubTitle] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 守卫：未完成 onboarding 跳走
  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (!profile?.heroId)   { router.replace('/select-hero'); return; }
    if (!profile?.onboardedAt) { router.replace('/onboarding'); return; }

    setQuestData(getQuests(user.id));

    // 拉一次好感度，决定立绘氛围
    getAffinityState(user.id).then(s => setStage(s.stage));
  }, [router, user, profile, loading]);

  async function refreshAll() {
    if (!user) return;
    setRefreshKey(k => k + 1);
    setQuestData(getQuests(user.id));
    await refreshProfile();
    getAffinityState(user.id).then(s => setStage(s.stage));
  }

  function onCompleteSubTask(subId: string) {
    const sub = questData.subTasks.find(s => s.id === subId);
    if (!sub || sub.done) return;
    setActiveSubId(subId);
    setActiveSubTitle(sub.title);
    setRewardOpen(true);
  }

  return (
    <main className="h-screen flex flex-col bg-grid home-enter">
      {/* 顶栏 */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-line bg-bg/70 backdrop-blur-sm">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-2xl font-bold tracking-[0.3em] text-accent-flame">
            LIFELONGRPG
          </h1>
          <span className="font-mono text-xs font-bold tracking-widest text-text-mute hidden sm:inline">
            命途 · BETA
          </span>
        </div>

        {/* 导航按钮（假功能） */}
        <nav className="hidden md:flex items-center gap-1">
          {[
            { label: '好友', icon: <Users size={13} /> },
            { label: '社区', icon: <Globe size={13} /> },
            { label: '排行榜', icon: <Trophy size={13} /> },
            { label: '商店', icon: <ShoppingBag size={13} /> }
          ].map(item => (
            <button
              key={item.label}
              onClick={() => {
                if (item.label === '商店') {
                  setStoreOpen(true);
                } else {
                  alert(`${item.label}功能开发中，敬请期待～`);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-text-dim border border-transparent hover:border-line hover:bg-bg-deep hover:text-text cut-tl transition"
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <ProfileBar refreshKey={refreshKey} onSettingsClick={() => setSettingsOpen(true)} />
      </header>

      {/* 主区域：左任务面板（左上，≤50% 高）+ 左下今日卡 + 中对话 + 右立绘 */}
      <div className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* 左：上半任务栏（max-h 50%） + 下半今日提示 */}
        <div className="col-span-3 xl:col-span-3 min-w-0 h-full flex flex-col gap-3 overflow-hidden">
          {/* 任务面板：限高 50% */}
          <div className="h-[50%] overflow-hidden">
            <QuestSidebar
              data={questData}
              onChange={d => {
                if (!user) return;
                setQuests(d, user.id);
                setQuestData(d);
                saveQuestTree({
                  userId: user.id,
                  goal:
                    profile?.currentGoal?.trim() ||
                    d.mainQuests[0]?.title ||
                    '当前主线',
                  heroId: profile?.heroId ?? null,
                  mainQuests: d.mainQuests,
                  sideQuests: d.sideQuests,
                  subTasks: d.subTasks
                });
              }}
              onCompleteSubTask={onCompleteSubTask}
            />
          </div>
          {/* 下半：今日提示卡 */}
          <div className="flex-1 overflow-hidden">
            <DailyHintCard
              questData={questData}
              stage={stage}
            />
          </div>
        </div>

        {/* 中：对话 */}
        <div className="col-span-6 xl:col-span-5 min-w-0 h-full overflow-hidden">
          <DialogueArea
            onSpeakingChange={setSpeaking}
            onAffinityMaybeChanged={refreshAll}
          />
        </div>

        {/* 右：立绘 */}
        <div className="col-span-3 xl:col-span-4 min-w-0 h-full overflow-hidden relative">
          {/* 背景装饰文字 */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <span
              className="font-display font-black text-[8rem] xl:text-[10rem] tracking-[-0.04em] select-none"
              style={{
                color: stage === 3
                  ? 'rgba(163, 145, 113, 0.10)'
                  : stage === 2
                    ? 'rgba(8, 75, 131, 0.10)'
                    : 'rgba(90, 106, 126, 0.10)'
              }}
            >
              HINATSU
            </span>
          </div>
          <div className="relative z-10 h-full">
            <FeixiaPortrait stage={stage} speaking={speaking} size="full" />
          </div>
        </div>
      </div>

      {/* 任务奖励 */}
      <TaskRewardModal
        open={rewardOpen}
        subTaskId={activeSubId}
        subTaskTitle={activeSubTitle}
        onClose={() => setRewardOpen(false)}
        onCompleted={refreshAll}
      />

      {/* 商店页面 */}
      {storeOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-12 animate-fade-in bg-black/80 backdrop-blur-sm" onClick={() => setStoreOpen(false)}>
          <div className="relative w-full h-full max-w-5xl bg-bg-card border border-line cut-both overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* 顶部栏 */}
            <div className="flex items-center justify-between px-5 py-3 bg-bg/90 border-b border-line absolute top-0 left-0 right-0 z-10 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <ShoppingBag size={16} className="text-accent-gold" />
                <span className="font-display tracking-widest text-sm text-text">STORE · 商店</span>
              </div>
              <button onClick={() => setStoreOpen(false)} className="p-1.5 text-text-dim hover:text-accent-flame transition-colors bg-bg-deep border border-line cut-tl">
                <X size={16} />
              </button>
            </div>
            
            {/* 商店图片 */}
            <div className="w-full h-full pt-14 pb-4 px-4 flex items-center justify-center overflow-auto bg-black/40">
              <img 
                src="/proxy1.png" 
                alt="Store" 
                className="max-w-full max-h-full object-contain shadow-xl"
                draggable={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* 设置面板 */}
      {settingsOpen && (
        <SettingsPanel
          userId={user?.id ?? null}
          publicUid={profile?.publicUid ?? null}
          displayName={profile?.displayName ?? null}
          heroId={profile?.heroId ?? null}
          onSignOut={async () => {
            await signOut();
            router.replace('/login');
          }}
          onClose={() => setSettingsOpen(false)}
          onReselectHero={() => router.push('/select-hero')}
          onReset={() => {
            resetLocalProgress(user?.id);
            setQuestData({ mainQuests: [], sideQuests: [], subTasks: [] });
          }}
        />
      )}
    </main>
  );
}

// ─── 设置面板 ───────────────────────────────────
function SettingsPanel({
  userId,
  publicUid,
  displayName,
  heroId,
  onSignOut,
  onClose,
  onReselectHero,
  onReset
}: {
  userId: string | null;
  publicUid: number | null;
  displayName: string | null;
  heroId: string | null;
  onSignOut: () => void | Promise<void>;
  onClose: () => void;
  onReselectHero: () => void;
  onReset: () => void;
}) {
  const hero = heroId ? findHero(heroId) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-bg/85 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-bg-card border border-line cut-both animate-slide-up">
        <div className="flex items-center justify-between px-5 py-3 border-b border-line">
          <span className="font-display tracking-widest text-xs text-text-dim">SETTINGS · 设置</span>
          <button onClick={onClose} className="p-1 text-text-dim hover:text-accent-flame">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <div className="font-mono text-[10px] tracking-widest text-text-mute mb-1">PLAYER</div>
            <div className="text-sm text-text">{displayName || '冒险者'}</div>
            {typeof publicUid === 'number' && (
              <div className="text-[10px] font-mono text-text-mute mt-1">
                UID · {publicUid}
              </div>
            )}
            {userId && (
              <div className="text-[10px] font-mono text-text-mute mt-1">
                ID · {userId.slice(0, 8)}
              </div>
            )}
            {hero && (
              <div className="text-xs text-text-dim mt-1">
                当前职业 · <span style={{ color: hero.accent }}>{hero.name}</span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-line space-y-2">
            <button
              onClick={async () => {
                try {
                  await onSignOut();
                } catch (err) {
                  console.error('退出登录失败:', err);
                }
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 bg-bg-deep border border-line text-sm text-text hover:border-accent-gold hover:text-accent-gold cut-tl transition"
            >
              <LogOut size={14} />
              退出登录
            </button>
            <Link
              href="/admin"
              className="w-full flex items-center gap-2 px-3 py-2.5 bg-bg-deep border border-line text-sm text-text hover:border-accent-cyan hover:text-accent-cyan cut-tl transition"
            >
              <Wrench size={14} />
              调试后台 · 修改账号数据
            </Link>
            <button
              onClick={onReselectHero}
              className="w-full flex items-center gap-2 px-3 py-2.5 bg-bg-deep border border-line text-sm text-text hover:border-accent-cyan hover:text-accent-cyan cut-tl transition"
            >
              <Sword size={14} />
              重新选择英雄
            </button>
            <button
              onClick={() => {
                if (confirm('真的要清空当前设备上的本地任务缓存吗？数据库数据不会被删除。')) onReset();
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 bg-bg-deep border border-line text-sm text-accent-flame hover:bg-accent-flame/10 cut-tl transition"
            >
              <RefreshCw size={14} />
              重置所有进度
            </button>
          </div>

          <div className="pt-3 border-t border-line text-[10px] font-mono text-text-mute leading-relaxed">
            Beta · 登录态由 Supabase Auth 托管<br />
            任务列表当前仍保留本地缓存，后端记忆 / 好感度 / 档案已持久化
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 今日提示卡（左下，填充任务面板下方空间）─────────
function DailyHintCard({
  questData, stage
}: { questData: QuestData; stage: 1 | 2 | 3; }) {
  const total = questData.subTasks.length;
  const done = questData.subTasks.filter(s => s.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const stageHint: Record<1 | 2 | 3, { label: string; tip: string; color: string }> = {
    1: {
      label: '阶段 1',
      tip: '她还在观察你。按时完成今日任务，让她真正注意到你。',
      color: 'text-text-dim'
    },
    2: {
      label: '阶段 2',
      tip: '她开始留意你说的话了——保持节奏，别在她刚抬头时退场。',
      color: 'text-accent-flame'
    },
    3: {
      label: '阶段 3',
      tip: '她在意你了——继续做你认真做的事，她会一直看着。',
      color: 'text-accent-gold'
    }
  };
  const hint = stageHint[stage];

  return (
    <aside className="h-full flex flex-col bg-bg-card/70 border border-line cut-both backdrop-blur-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-line flex items-center gap-2">
        <Calendar size={12} className="text-accent-flame" />
        <span className="font-display tracking-widest text-xs text-text-dim">
          TODAY · 今日
        </span>
        <span className="ml-auto font-mono text-[10px] text-text-mute">
          {new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', weekday: 'short' })}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 整体完成率 */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1 text-xs text-text-dim">
              <TrendingUp size={11} className="text-accent-flame" />
              整体完成率
            </span>
            <span className="font-mono text-base font-bold text-accent-flame">{pct}%</span>
          </div>
          <div className="relative h-1.5 bg-bg-deep border border-line overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 transition-all duration-700"
              style={{
                width: `${Math.max(2, pct)}%`,
                background: 'linear-gradient(90deg, #084B83, #A39171)',
                boxShadow: '0 0 8px rgba(8,75,131,0.40)'
              }}
            />
          </div>
          <div className="font-mono text-[10px] text-text-mute mt-1">
            {done} / {total} 子任务完成
          </div>
        </div>

        {/* 阶段提示 */}
        <div className="border-t border-line/60 pt-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles size={11} className={hint.color} />
            <span className={`font-mono text-[10px] tracking-widest ${hint.color}`}>
              {hint.label.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-text-display leading-relaxed">
            {hint.tip}
          </p>
        </div>

        {/* 概览 stats */}
        <div className="border-t border-line/60 pt-3 grid grid-cols-2 gap-2">
          <MiniStat icon={<Sword size={11} />} label="主线" value={questData.mainQuests.length} accent="gold" />
          <MiniStat icon={<Flame size={11} />} label="支线" value={questData.sideQuests.length} accent="violet" />
        </div>
      </div>

      <div className="px-4 py-2 border-t border-line font-mono text-[9px] tracking-widest text-text-mute flex items-center justify-between">
        <span>HINT</span>
        <span className="text-text-dim">尝试和她聊聊 →</span>
      </div>
    </aside>
  );
}

function MiniStat({
  icon, label, value, accent
}: { icon: React.ReactNode; label: string; value: number; accent: 'gold' | 'violet'; }) {
  const color = accent === 'gold' ? 'text-accent-gold border-accent-gold/30' : 'text-[#7C6FB0] border-[#7C6FB0]/30';
  return (
    <div className={`px-2.5 py-1.5 cut-tl border ${color} bg-bg-deep`}>
      <div className="flex items-center gap-1 text-[10px] font-mono tracking-widest text-text-dim">
        {icon}<span>{label}</span>
      </div>
      <div className={`text-lg font-bold leading-tight ${color.split(' ')[0]}`}>
        {value}
      </div>
    </div>
  );
}
