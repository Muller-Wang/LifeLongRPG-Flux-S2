'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

interface Props {
  /** 当前阶段，影响发光强度和氛围 */
  stage?: 1 | 2 | 3;
  /** 是否在说话（轻微脉动）*/
  speaking?: boolean;
  /** 完整尺寸（onboarding/home 主立绘）vs 紧凑（其他场景）*/
  size?: 'full' | 'compact';
  /** 标题与标签的叠放方式 */
  overlayMode?: 'behind' | 'hidden';
}

// 浅色主题：阶段越靠后越"温暖"，从蓝灰到驼金
const STAGE_AURA: Record<1 | 2 | 3, string> = {
  1: 'from-bg via-bg-card to-bg-card',
  2: 'from-[#E0EAF6] via-bg-card to-bg-card',
  3: 'from-[#F2EBDD] via-bg-card to-bg-card'
};

const STAGE_RING: Record<1 | 2 | 3, string> = {
  1: 'border-line',
  2: 'border-[rgba(8,75,131,0.30)]',
  3: 'border-[rgba(163,145,113,0.55)]'
};

const STAGE_GLOW: Record<1 | 2 | 3, string> = {
  1: '',
  2: 'shadow-[0_0_24px_rgba(8,75,131,0.15)]',
  3: 'shadow-[0_0_40px_rgba(163,145,113,0.30)]'
};

/** 根据好感度阶段随机选择立绘图片路径 */
function getPortraitCandidates(stage: 1 | 2 | 3): string[] {
  switch (stage) {
    case 1:
      return ['/portraits/1.png', '/portraits/2.png'];
    case 2:
      return ['/portraits/2.png', '/portraits/3.png'];
    case 3:
      return ['/portraits/3.png', '/portraits/4.png'];
  }
}

function pickRandomPortrait(stage: 1 | 2 | 3): string {
  const candidates = getPortraitCandidates(stage);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function FeixiaPortrait({
  stage = 1,
  speaking = false,
  size = 'full',
  overlayMode = 'behind'
}: Props) {
  const [tick, setTick] = useState(0);
  const [portraitSrc, setPortraitSrc] = useState('/hinatsu.png');

  // 客户端挂载后，根据阶段随机选择立绘
  useEffect(() => {
    setPortraitSrc(pickRandomPortrait(stage));
  }, [stage]);

  useEffect(() => {
    if (!speaking) return;
    const t = setInterval(() => setTick(x => x + 1), 800);
    return () => clearInterval(t);
  }, [speaking]);

  const isFull = size === 'full';

  return (
    <div className={`relative ${isFull ? 'w-full h-full' : 'w-32 h-44'}`}>
      {/* 背景渐变 */}
      <div
        className={`absolute inset-0 cut-both bg-gradient-to-b ${STAGE_AURA[stage]} ${STAGE_GLOW[stage]} transition-all duration-700`}
      />
      {/* 网格 */}
      <div className="absolute inset-0 cut-both bg-grid opacity-50" />
      {/* 焦点光晕（替代深色版扫描线）*/}
      <div className="absolute inset-0 cut-both focus-aura" />
      {/* 描边 */}
      <div className={`absolute inset-0 cut-both border ${STAGE_RING[stage]} transition-colors duration-700`} />

      {/* 背景名字特写 */}
      <div className="absolute inset-0 flex flex-col items-center justify-start pt-[12%] pointer-events-none overflow-hidden">
        <div
          className={`font-display font-black leading-none select-none tracking-[-0.04em] ${
            isFull ? 'text-[clamp(72px,9vw,126px)]' : 'text-3xl'
          }`}
          style={{
            color: stage === 3 ? 'rgba(255,188,66,0.10)' : stage === 2 ? 'rgba(8,75,131,0.10)' : 'rgba(90,106,126,0.08)',
            marginBottom: isFull ? '0.5em' : '0.3em'
          }}
        >
          HINATSU
        </div>
        <div
          className={`font-display font-black leading-none select-none transition-transform duration-700 ${
            isFull ? 'text-[clamp(180px,22vw,320px)]' : 'text-7xl'
          }`}
          style={{
            color: stage === 3 ? 'rgba(255,188,66,0.12)' : stage === 2 ? 'rgba(8,75,131,0.12)' : 'rgba(90,106,126,0.10)',
            transform: speaking ? 'scale(1.02)' : 'scale(1)',
            marginTop: isFull ? '-0.15em' : '-0.1em'
          }}
        >
          緋
        </div>
      </div>

      {/* 立绘 */}
      <div
        className={`absolute inset-0 overflow-hidden ${isFull ? 'animate-breathe' : ''} ${
          speaking ? 'animate-pulse-slow' : ''
        }`}
        style={{
          // 阶段越靠后越饱和、越温暖；阶段 1 微微去饱和拉远距离感
          filter:
            stage === 1
              ? 'saturate(0.85) brightness(0.98)'
              : stage === 3
                ? 'saturate(1.08) brightness(1.02)'
                : 'none'
        }}
      >
        <Image
          src={portraitSrc}
          alt="緋夏"
          fill
          priority
          sizes={isFull ? '40vw' : '128px'}
          className="object-contain object-bottom select-none pointer-events-none"
        />
      </div>

      {/* 角色名标签 */}
      {isFull && overlayMode !== 'hidden' && (
        <div className="absolute bottom-4 left-4 font-mono text-[10px] tracking-[0.3em] text-text-dim uppercase">
          <div>FEIXIA · 緋夏</div>
          <div className="mt-0.5 opacity-50">AGENT · v0.2 · stage {stage}</div>
        </div>
      )}

      {/* 边角装饰 */}
      <div className="absolute top-3 left-3 w-3 h-3 border-t border-l border-accent-gold/70" />
      <div className="absolute top-3 right-3 w-3 h-3 border-t border-r border-accent-gold/70" />
      <div className="absolute bottom-3 left-3 w-3 h-3 border-b border-l border-accent-gold/70" />
      <div className="absolute bottom-3 right-3 w-3 h-3 border-b border-r border-accent-gold/70" />

      {/* speaking 提示 */}
      {speaking && isFull && (
        <div
          key={tick}
          className="absolute top-6 right-6 flex items-center gap-1 animate-fade-in"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-accent-flame animate-pulse" />
          <span className="font-mono text-[10px] tracking-widest text-accent-flame">SPEAKING</span>
        </div>
      )}
    </div>
  );
}
