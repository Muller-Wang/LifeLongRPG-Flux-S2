'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2, Circle, ArrowRight, Sparkles,
  Compass, Target, BookOpen, Coffee
} from 'lucide-react';
import { FeixiaPortrait } from '@/components/FeixiaPortrait';
import { ComicBubble } from '@/components/ComicBubble';
import { MainQuestEditor } from '@/components/MainQuestEditor';
import {
  SideQuestTemplates,
  SideQuestSelection,
  templateSelectionsToQuestData
} from '@/components/SideQuestTemplates';
import { setQuests } from '@/lib/client/storage';
import { useAuth } from '@/components/auth/AuthProvider';
import { saveQuestTree, updateProfile } from '@/lib/client/api';
// onboarding 阶段不调 LLM，使用预设台词
import {
  getIntroLine,
  getMainGuideLine,
  getMainReactLine,
  getCompleteLine
} from '@/lib/feixia-scripted';
import type { HeroId } from '@/lib/client/storage';

type Phase =
  | 'intro'
  | 'main'
  | 'main-react'
  | 'side'
  | 'finalizing';

const PHASE_STEPS: { id: Phase; label: string; sub: string }[] = [
  { id: 'intro',     label: '初次见面', sub: '让她看见你' },
  { id: 'main',      label: '主线设定', sub: '你想去哪里' },
  { id: 'main-react',label: '回应',     sub: '她看见了' },
  { id: 'side',      label: '支线模板', sub: '减负的起点' },
  { id: 'finalizing',label: '进入主页', sub: '开始命途' }
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useAuth();
  const [phase, setPhase] = useState<Phase>('intro');
  const [bubbleText, setBubbleText] = useState<string>('');
  const [bubbleKey, setBubbleKey] = useState(0);
  const [bubbleSpeaking, setBubbleSpeaking] = useState(false);
  const [mainQuestDrafts, setMainQuestDrafts] = useState<
    { id: string; title: string; description: string }[]
  >([]);
  const [transitioning, setTransitioning] = useState(false);

  /**
   * 显示一段预设台词（不调 LLM）。
   * 触发 typewriter 动画，speaking 状态按文字长度估算时长。
   * 返回 Promise，可 await 等待动画结束。
   */
  const showScripted = useCallback((text: string): Promise<void> => {
    return new Promise(resolve => {
      setBubbleSpeaking(true);
      setBubbleText(text);
      setBubbleKey(k => k + 1);
      // typewriter 速度 32ms/字 + 600ms 缓冲
      const duration = Math.max(800, text.length * 35 + 600);
      setTimeout(() => {
        setBubbleSpeaking(false);
        resolve();
      }, duration);
    });
  }, []);

  // 守卫 + 初次见面（预设台词，按职业差异化）
  useEffect(() => {
    if (loading) return;
    const heroId = (profile?.heroId ?? null) as HeroId | null;
    if (!user) { router.replace('/login'); return; }
    if (!heroId) { router.replace('/select-hero'); return; }

    showScripted(getIntroLine(heroId));
  }, [router, showScripted, user, profile?.heroId, loading]);

  // 进入 main 阶段时显示引导话（预设）
  useEffect(() => {
    if (phase !== 'main') return;
    showScripted(getMainGuideLine());
  }, [phase, showScripted]);

  // 提交主线 → 进 main-react 阶段并即时回应（预设模板插值）
  function commitMainQuests(quests: typeof mainQuestDrafts) {
    setMainQuestDrafts(quests);
    setPhase('main-react');
    showScripted(getMainReactLine(quests.map(q => q.title)));
  }

  // 提交支线 → 持久化 + 完成话 + 跳转
  async function commitSideQuests(selections: SideQuestSelection[]) {
    setPhase('finalizing');
    const { side, subs } = templateSelectionsToQuestData(selections);
    const nextQuestData = {
      mainQuests: mainQuestDrafts.map(q => ({
        id: q.id, title: q.title, description: q.description
      })),
      sideQuests: side.map(s => ({ id: s.id, title: s.title, templateKey: s.templateKey })),
      subTasks: subs
    };
    if (!user) return;
    setQuests(nextQuestData, user.id);

    const goal = mainQuestDrafts.map(q => q.title.trim()).filter(Boolean).join(' / ');
    await updateProfile({
      userId: user.id,
      heroId: profile?.heroId ?? undefined,
      currentGoal: goal || '未命名目标',
      onboarded: true,
      metadata: { onboardingVersion: 'v0.4-auth' }
    });
    await saveQuestTree({
      userId: user.id,
      heroId: profile?.heroId ?? null,
      goal: goal || '未命名目标',
      mainQuests: nextQuestData.mainQuests,
      sideQuests: nextQuestData.sideQuests,
      subTasks: nextQuestData.subTasks
    });
    await refreshProfile();

    await showScripted(getCompleteLine());
    // 完成台词显示完，停留让用户读
    await new Promise(r => setTimeout(r, 800));
    // 触发全屏光晕过渡
    setTransitioning(true);
    // 光晕动画 1.1s 中段 push 路由，让 home 页接着光的尾声
    setTimeout(() => router.push('/home'), 700);
  }

  const stepIndex = PHASE_STEPS.findIndex(s => s.id === phase);

  return (
    <main className="min-h-screen relative overflow-x-hidden bg-grid">
      {/* 背景装饰：浮动几何 */}
      <FloatingDeco />

      {/* 进入主页的丝滑过渡：全屏光晕 + 中央标识 */}
      {transitioning && (
        <>
          <div className="world-bloom" />
          <div className="world-mark text-center">
            <div
              className="font-display text-5xl tracking-[0.4em] text-accent-flame mb-2"
              style={{
                fontFamily: 'Bebas Neue, "Noto Sans SC", sans-serif',
                textShadow: '0 0 24px rgba(8,75,131,0.5)'
              }}
            >
              LIFELONGRPG
            </div>
            <div className="font-mono text-xs tracking-[0.4em] text-accent-flame/80">
              ENTERING WORLD
            </div>
          </div>
        </>
      )}

      <div className="grid lg:grid-cols-[1fr_440px] xl:grid-cols-[1fr_500px] min-h-screen">
        {/* ─── 左：内容区 ─── */}
        <section className="flex flex-col px-6 lg:px-12 py-8">
          {/* 顶部：步骤指示器 */}
          <header className="mb-6 animate-fade-in">
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.3em] text-text-dim mb-3">
              <span className="w-2 h-2 bg-accent-flame rounded-full animate-pulse" />
              <span>STEP 03 · INITIATING WORLD</span>
            </div>

            {/* 步骤进度条 */}
            <div className="flex items-center gap-2">
              {PHASE_STEPS.map((s, i) => {
                const done = i < stepIndex;
                const active = i === stepIndex;
                return (
                  <div key={s.id} className="flex-1 flex items-center gap-2">
                    <div
                      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all ${
                        active
                          ? 'bg-accent-flame text-white'
                          : done
                          ? 'text-accent-flame'
                          : 'text-text-mute'
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 size={12} />
                      ) : active ? (
                        <Circle size={12} className="animate-pulse" />
                      ) : (
                        <Circle size={12} />
                      )}
                      <span className="hidden md:inline font-medium">{s.label}</span>
                    </div>
                    {i < PHASE_STEPS.length - 1 && (
                      <div
                        className={`flex-1 h-px ${
                          done ? 'bg-accent-flame' : 'bg-line'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </header>

          {/* 主内容容器 */}
          <div className="flex-1 flex flex-col">
            {/* intro：绯夏说话 + 开始按钮 */}
            {phase === 'intro' && (
              <IntroSection
                bubbleText={bubbleText}
                bubbleKey={bubbleKey}
                onStart={() => setPhase('main')}
              />
            )}

            {/* main：绯夏引导 + 主线录入 */}
            {phase === 'main' && (
              <MainSection bubbleText={bubbleText} bubbleKey={bubbleKey}>
                <MainQuestEditor onConfirm={commitMainQuests} />
              </MainSection>
            )}

            {/* main-react：绯夏即时回应 + 继续按钮 */}
            {phase === 'main-react' && (
              <ReactSection
                bubbleText={bubbleText}
                bubbleKey={bubbleKey}
                quests={mainQuestDrafts}
                onContinue={() => setPhase('side')}
              />
            )}

            {/* side：支线模板 */}
            {phase === 'side' && (
              <div className="animate-fade-in">
                <SideQuestTemplates onConfirm={commitSideQuests} />
              </div>
            )}

            {/* finalizing */}
            {phase === 'finalizing' && (
              <FinalizingSection bubbleText={bubbleText} bubbleKey={bubbleKey} />
            )}
          </div>
        </section>

        {/* ─── 右：立绘（始终在最右）─── */}
        <aside className="hidden lg:flex sticky top-0 h-screen p-6">
          <FeixiaPortrait stage={1} speaking={bubbleSpeaking} size="full" />
        </aside>
      </div>
    </main>
  );
}

// ─── intro 阶段 ───────────────────────────────────────
function IntroSection({
  bubbleText, bubbleKey, onStart
}: { bubbleText: string; bubbleKey: number; onStart: () => void; }) {
  return (
    <div className="flex-1 flex flex-col gap-6 animate-fade-in">
      <h1 className="font-display text-2xl md:text-3xl tracking-wider text-text-display">
        初次见面
      </h1>

      {/* 漫画风对话框 */}
      {bubbleText && (
        <div key={bubbleKey} className="self-start">
          <ComicBubble text={bubbleText} tailSide="right" />
        </div>
      )}

      {/* 填充：操作引导卡 */}
      <div className="grid sm:grid-cols-2 gap-3 mt-2">
        <HintCard
          icon={<Compass size={16} />}
          title="她不会自我介绍"
          desc="绯夏不主动靠近——开场的第一步要你来迈。"
        />
        <HintCard
          icon={<Target size={16} />}
          title="主线由你自己写"
          desc="支线我们提供模板，但主线必须是你的话。"
          accent="violet"
        />
        <HintCard
          icon={<BookOpen size={16} />}
          title="按时完成会被看见"
          desc="她对「按时性」敏感——按时完成会让她真正注意到你。"
          accent="cyan"
        />
        <HintCard
          icon={<Coffee size={16} />}
          title="一切都可以慢慢来"
          desc="先设一个最重要的主线就行。其他可以之后补。"
          accent="gold"
        />
      </div>

      <div className="mt-auto pt-6">
        <button
          onClick={onStart}
          className="group inline-flex items-center gap-2 bg-accent-flame text-white px-7 py-3 cut-tl border border-accent-flame text-sm font-medium tracking-wide hover:shadow-primaryHover hover:bg-accent-flameHi transition-all"
        >
          <Sparkles size={14} />
          开始设定我的主线
          <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}

// ─── main 阶段 ────────────────────────────────────────
function MainSection({
  bubbleText, bubbleKey, children
}: { bubbleText: string; bubbleKey: number; children: React.ReactNode; }) {
  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <h1 className="font-display text-2xl md:text-3xl tracking-wider text-text-display">
        设定你的主线
      </h1>

      {bubbleText && (
        <div key={bubbleKey} className="self-start">
          <ComicBubble text={bubbleText} tailSide="right" />
        </div>
      )}

      {children}
    </div>
  );
}

// ─── main-react 阶段 ─────────────────────────────────
function ReactSection({
  bubbleText, bubbleKey, quests, onContinue
}: {
  bubbleText: string; bubbleKey: number;
  quests: { id: string; title: string; description: string }[];
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <h1 className="font-display text-2xl md:text-3xl tracking-wider text-text-display">
        她看见了你写的内容
      </h1>

      {/* 用户已写主线的回顾卡 */}
      <div className="bg-bg-card border border-line p-4 cut-br">
        <div className="font-mono text-[10px] tracking-[0.3em] text-text-dim mb-2">
          你刚提交的主线
        </div>
        <ul className="space-y-1.5">
          {quests.map((q, i) => (
            <li key={q.id} className="flex items-start gap-2 text-sm text-text">
              <span className="font-mono text-[10px] text-accent-flame mt-1">
                M{String(i + 1).padStart(2, '0')}
              </span>
              <span className="flex-1">{q.title}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 绯夏即时回应 */}
      {bubbleText && (
        <div key={bubbleKey} className="self-start">
          <ComicBubble text={bubbleText} tailSide="right" />
        </div>
      )}

      <button
        onClick={onContinue}
        className="self-start group inline-flex items-center gap-2 bg-accent-flame text-white px-6 py-2.5 cut-tl border border-accent-flame text-sm font-medium tracking-wide hover:bg-accent-flameHi hover:shadow-primaryHover transition-all"
      >
        继续 · 选择支线模板
        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
      </button>
    </div>
  );
}

// ─── finalizing 阶段 ────────────────────────────────
function FinalizingSection({
  bubbleText, bubbleKey
}: { bubbleText: string; bubbleKey: number; }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center animate-fade-in">
      {bubbleText && (
        <div key={bubbleKey}>
          <ComicBubble text={bubbleText} tailSide="bottom" />
        </div>
      )}
      <div className="font-mono text-xs tracking-[0.3em] text-accent-cyan animate-pulse mt-4">
        ENTERING WORLD…
      </div>
    </div>
  );
}

// ─── 提示卡 ───────────────────────────────────────────
function HintCard({
  icon, title, desc, accent = 'flame'
}: {
  icon: React.ReactNode; title: string; desc: string;
  accent?: 'flame' | 'cyan' | 'gold' | 'violet';
}) {
  const colorMap = {
    flame: 'text-accent-flame border-accent-flame/30 bg-accent-flame/5',
    cyan:  'text-accent-cyan border-accent-cyan/40 bg-accent-cyan/5',
    gold:  'text-accent-gold border-accent-gold/40 bg-accent-gold/5',
    violet:'text-[#7C6FB0] border-[#7C6FB0]/30 bg-[#7C6FB0]/5'
  };
  return (
    <div className={`p-3 cut-br border ${colorMap[accent]} group hover:scale-[1.01] transition`}>
      <div className="flex items-start gap-2">
        <div className={`shrink-0 mt-0.5 ${colorMap[accent].split(' ')[0]}`}>{icon}</div>
        <div>
          <div className="text-sm font-medium text-text-display mb-0.5">{title}</div>
          <div className="text-xs text-text-dim leading-relaxed">{desc}</div>
        </div>
      </div>
    </div>
  );
}

// ─── 浮动几何装饰（背景填充，避免空白）────────────────
function FloatingDeco() {
  return (
    <>
      <div
        className="absolute top-12 left-12 w-32 h-32 border-2 border-accent-flame/15 animate-float pointer-events-none"
        style={{ borderRadius: '24% 76% 35% 65% / 47% 30% 70% 53%' }}
      />
      <div
        className="absolute bottom-20 left-8 w-24 h-24 border border-accent-cyan/30 rotate-12 animate-float pointer-events-none"
        style={{ animationDelay: '1.5s' }}
      />
      <div
        className="absolute top-1/3 left-1/2 w-2 h-2 bg-accent-gold rounded-full animate-pulse pointer-events-none"
      />
      <div
        className="absolute bottom-1/3 left-1/4 w-1.5 h-1.5 bg-accent-flame rounded-full animate-pulse pointer-events-none"
        style={{ animationDelay: '0.5s' }}
      />
    </>
  );
}
