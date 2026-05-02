'use client';

import Image from 'next/image';
import { Hero } from '@/lib/heroes';

interface Props {
  hero: Hero;
  selected?: boolean;
  onSelect: () => void;
}

export function HeroCard({ hero, selected, onSelect }: Props) {
  return (
    <button
      onClick={onSelect}
      className={[
        'group relative flex flex-col bg-bg-card border cut-both overflow-hidden',
        'transition-all duration-300 text-left',
        selected
          ? 'border-accent-flame scale-[1.02] shadow-[0_0_40px_rgba(230,57,70,0.35)]'
          : 'border-line hover:border-accent-gold hover:scale-[1.01]'
      ].join(' ')}
    >
      {/* 立绘区（占位）*/}
      <div className="relative h-72 overflow-hidden">
        <div
          className="absolute inset-0 bg-grid opacity-30"
          style={{
            background: `radial-gradient(ellipse at 50% 60%, ${hero.accent}30 0%, transparent 60%)`
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Image
            src={`/heroes/${hero.id}.png`}
            alt={hero.name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover object-top select-none pointer-events-none transition-transform duration-500 group-hover:scale-105"
            onError={e => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          {/* glyph 作为加载失败时的 fallback */}
          <div
            className="font-display font-bold text-[140px] leading-none select-none transition-transform duration-500 group-hover:scale-110 absolute inset-0 flex items-center justify-center -z-10"
            style={{ color: hero.accent }}
          >
            {hero.glyph}
          </div>
        </div>
        {/* 焦点光晕（替代深色版扫描线）*/}
        <div className="absolute inset-0 focus-aura pointer-events-none" />
        {/* 边角 HUD 装饰 */}
        <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-text-dim/40" />
        <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-text-dim/40" />
        <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-text-dim/40" />
        <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-text-dim/40" />

        {/* 稀有度标签 */}
        <div
          className="absolute top-3 left-3 font-mono text-[10px] font-bold tracking-widest px-2 py-0.5 cut-tl"
          style={{
            color: hero.rarityColor,
            background: 'rgba(10,14,26,0.7)',
            border: `1px solid ${hero.rarityColor}80`
          }}
        >
          {hero.rarity}
        </div>
      </div>

      {/* 信息区 */}
      <div className="flex-1 flex flex-col p-5 border-t border-line">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="font-display text-2xl text-text tracking-wider">{hero.name}</h3>
          <span className="font-mono text-[10px] text-text-mute tracking-widest">
            CLASS · {hero.id.toUpperCase()}
          </span>
        </div>
        <p className="text-xs text-accent-cyan font-mono italic mb-3">『{hero.tagline}』</p>
        <p className="text-sm text-text-dim leading-relaxed line-clamp-4 mb-4">
          {hero.story}
        </p>

        {/* 天赋 */}
        <div className="mt-auto pt-3 border-t border-line/50">
          <div className="font-mono text-[9px] tracking-widest text-text-mute mb-1.5">
            STARTING TRAITS
          </div>
          <div className="flex flex-wrap gap-1.5">
            {hero.talents.map(t => (
              <span
                key={t}
                className="font-mono text-[10px] text-text-dim border border-line/70 px-1.5 py-0.5 cut-tl"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 选中标识 */}
      {selected && (
        <div className="absolute top-3 right-3 px-2 py-0.5 bg-accent-flame text-white font-mono text-[10px] tracking-widest cut-tl animate-pulse-slow">
          SELECTED
        </div>
      )}
    </button>
  );
}
