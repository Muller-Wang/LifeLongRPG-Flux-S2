'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { HEROES, Hero } from '@/lib/heroes';
import { setHero } from '@/lib/client/storage';
import type { HeroId } from '@/lib/client/storage';
import { useAuth } from '@/components/auth/AuthProvider';
import { bootstrapProfile } from '@/lib/client/api';

export default function SelectHeroPage() {
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useAuth();
  const [selected, setSelected] = useState<HeroId | null>(null);
  const [hovered, setHovered] = useState<HeroId | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (profile?.heroId) setSelected(profile.heroId as HeroId);
  }, [loading, user, profile, router]);

  // hover 优先于 selected：鼠标停在哪就展开哪
  const active = hovered ?? selected;

  async function confirm() {
    if (!selected || !user || submitting) return;
    setSubmitting(true);
    try {
      // 写库 profile.heroId（数据库 SSOT）
      await bootstrapProfile({ userId: user.id, heroId: selected });
      await refreshProfile();
      // localStorage fallback（onboarding 当前还在用 getHero()）
      setHero(selected);
      router.push('/onboarding');
    } catch (err) {
      console.warn('[select-hero] 保存失败:', err);
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col px-4 md:px-6 py-6 bg-grid">
      {/* 头部 */}
      <header className="mb-5 animate-fade-in flex-shrink-0 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.3em] text-text-dim mb-2">
          <span className="w-2 h-2 bg-accent-flame rounded-full animate-pulse" />
          <span>STEP 02 · CHOOSE YOUR HERO</span>
        </div>
        <h1 className="font-display text-3xl md:text-4xl tracking-wider text-text-display mb-1">
          选择你的英雄
        </h1>
        <p className="text-sm text-text-dim max-w-2xl">
          鼠标移到一张卡上看完整故事。点击锁定你的出身——那不是你必须成为的样子，而是你出发时所站的地方。
        </p>
      </header>

      {/* 横排 7 列：hover 那列展开 */}
      <div
        className="flex gap-2 md:gap-3 flex-1 mb-5 max-w-[1600px] mx-auto w-full"
        style={{ minHeight: '60vh' }}
        onMouseLeave={() => setHovered(null)}
      >
        {HEROES.map((h, idx) => {
          const isExpanded = active === h.id;
          const isSelected = selected === h.id;
          return (
            <HeroPanel
              key={h.id}
              hero={h}
              expanded={isExpanded}
              selected={isSelected}
              animationDelay={idx * 60}
              onMouseEnter={() => setHovered(h.id)}
              onClick={() => setSelected(h.id)}
            />
          );
        })}
      </div>

      {/* 底部操作栏 */}
      <div className="flex items-center justify-between flex-shrink-0 max-w-7xl mx-auto w-full">
        <div className="font-mono text-[10px] tracking-widest text-text-dim">
          {selected ? (
            <>
              已选择 ·{' '}
              <span className="text-accent-flame">
                {HEROES.find(h => h.id === selected)?.name}
              </span>
            </>
          ) : (
            <>请选择一位</>
          )}
        </div>
        <Button
          variant="primary"
          size="lg"
          disabled={!selected || submitting}
          onClick={confirm}
          icon={<ArrowRight size={16} />}
        >
          {submitting ? '保存中…' : '确认 · 进入命途'}
        </Button>
      </div>
    </main>
  );
}

// ─── 单列卡片 ─────────────────────────────────────
interface PanelProps {
  hero: Hero;
  expanded: boolean;
  selected: boolean;
  animationDelay: number;
  onMouseEnter: () => void;
  onClick: () => void;
}

function HeroPanel({ hero, expanded, selected, animationDelay, onMouseEnter, onClick }: PanelProps) {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={`
        relative cursor-pointer overflow-hidden cut-both bg-bg-card
        transition-all duration-500 ease-out animate-slide-up
        ${expanded ? 'shadow-cardHover' : 'shadow-card hover:shadow-cardHover'}
      `}
      style={{
        flexGrow: expanded ? 3.5 : 1,
        flexBasis: 0,
        minWidth: expanded ? '320px' : '64px',
        animationDelay: `${animationDelay}ms`,
        // 描边用每个角色的 accent 色，被选中或 hover 加粗
        boxShadow: expanded
          ? `inset 0 0 0 2px ${hero.accent}, 0 4px 16px rgba(8, 75, 131, 0.10)`
          : `inset 0 0 0 1px ${hero.accent}40, 0 2px 8px rgba(8, 75, 131, 0.04)`
      }}
    >
      {/* 渐变背景层（accent 色弱光晕）*/}
      <div
        className="absolute inset-0 transition-opacity duration-500"
        style={{
          background: `linear-gradient(180deg, ${hero.accent}18 0%, ${hero.accent}08 40%, transparent 70%)`,
          opacity: expanded ? 1 : 0.6
        }}
      />

      {/* 立绘图片 */}
      <div className="absolute inset-0 flex items-end justify-center pointer-events-none transition-all duration-500 pb-4">
        <Image
          src={`/heroes/${hero.id}.png`}
          alt={hero.name}
          fill
          sizes="(max-width: 768px) 100vw, 20vw"
          className={`object-cover object-top select-none transition-all duration-500 ${expanded ? 'opacity-100' : 'opacity-70'}`}
          style={{
            maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)'
          }}
          onError={e => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>

      {/* glyph 水印 fallback（图片加载失败时显示）*/}
      <div
        className="absolute inset-0 flex items-end justify-center pointer-events-none transition-all duration-500 pb-4 -z-10"
        style={{
          fontFamily: '"Noto Sans SC", system-ui',
          fontWeight: 900,
          color: `${hero.accent}1F`,
          lineHeight: 0.85,
          fontSize: expanded ? 'clamp(160px, 18vw, 260px)' : 'clamp(80px, 8vw, 120px)'
        }}
      >
        {hero.glyph}
      </div>

      {/* 内容层 */}
      {expanded ? (
        <ExpandedContent hero={hero} selected={selected} />
      ) : (
        <CollapsedContent hero={hero} />
      )}

      {/* 边角装饰（角色色调）*/}
      <div className="absolute top-2 left-2 w-3 h-3 border-t border-l" style={{ borderColor: hero.accent }} />
      <div className="absolute top-2 right-2 w-3 h-3 border-t border-r" style={{ borderColor: hero.accent }} />
      <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l" style={{ borderColor: hero.accent }} />
      <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r" style={{ borderColor: hero.accent }} />

      {/* 选中态左上小角标 */}
      {selected && (
        <div
          className="absolute top-3 left-3 z-10 font-mono text-[9px] tracking-widest px-1.5 py-0.5 bg-accent-flame text-white"
          style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 8% 100%)' }}
        >
          ◆ SELECTED
        </div>
      )}
    </div>
  );
}

// ─── 收起态（窄列）─────────────────────────────────
function CollapsedContent({ hero }: { hero: Hero }) {
  return (
    <div className="relative h-full flex flex-col items-center justify-between py-6 px-2">
      {/* 顶部稀有度 */}
      <div
        className="font-mono text-[10px] tracking-[0.2em] font-bold"
        style={{ color: hero.rarityColor }}
      >
        {hero.rarity}
      </div>

      {/* 中部留空（让 glyph 水印露出）*/}

      {/* 底部竖排名字 */}
      <div
        className="font-display font-bold tracking-[0.4em] text-base md:text-lg"
        style={{
          color: hero.accent,
          writingMode: 'vertical-rl',
          textOrientation: 'upright'
        }}
      >
        {hero.name}
      </div>
    </div>
  );
}

// ─── 展开态（hover/selected 那列）─────────────────
function ExpandedContent({ hero, selected }: { hero: Hero; selected: boolean }) {
  return (
    <div className="relative h-full p-5 md:p-6 flex flex-col animate-fade-in">
      {/* 顶部 meta */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="font-mono text-[10px] tracking-[0.3em] font-bold px-2 py-0.5 border"
          style={{ color: hero.rarityColor, borderColor: hero.rarityColor }}
        >
          {hero.rarity}
        </span>
        <span className="font-mono text-[9px] tracking-widest text-text-dim">
          {selected ? 'YOU' : 'HOVER'}
        </span>
      </div>

      {/* 名字 */}
      <h2
        className="font-display text-2xl md:text-3xl font-bold mb-3 tracking-wide"
        style={{ color: hero.accent }}
      >
        {hero.name}
      </h2>

      {/* tagline */}
      <p
        className="text-[13px] text-text leading-relaxed mb-4 pl-3 border-l-2"
        style={{ borderColor: hero.accent }}
      >
        {hero.tagline}
      </p>

      {/* story（可滚动）*/}
      <div className="text-[13px] text-text-dim leading-relaxed mb-4 flex-1 overflow-y-auto pr-1">
        {hero.story}
      </div>

      {/* talents */}
      <div className="space-y-1 mt-auto pt-3 border-t border-line">
        <div className="font-mono text-[9px] tracking-[0.3em] text-text-dim mb-1.5">
          天赋 · TALENTS
        </div>
        {hero.talents.map((t, i) => (
          <div key={i} className="font-mono text-[11px] text-text-display flex items-center gap-2">
            <span style={{ color: hero.accent }}>▸</span>
            <span>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
