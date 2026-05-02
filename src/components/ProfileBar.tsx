'use client';

import { useEffect, useState } from 'react';
import { Coins, Settings as SettingsIcon, User2 } from 'lucide-react';
import { getAffinityState } from '@/lib/client/api';
import { useAuth } from './auth/AuthProvider';

interface Props {
  /** 触发刷新（外部 incrementing 数字 → 重新拉数据）*/
  refreshKey?: number;
  onSettingsClick?: () => void;
}

const STAGE_NAME: Record<number, string> = {
  1: '保持距离',
  2: '愿意了解',
  3: '深厚羁绊'
};

// 浅色主题：阶段进阶 = 灰→蓝→金（冷到暖）
const STAGE_COLOR: Record<number, string> = {
  1: '#5A6A7E', // Slate Grey · 中性
  2: '#084B83', // Yale Blue · 主强调
  3: '#A39171'  // Camel · 温暖偏向
};

export function ProfileBar({ refreshKey = 0, onSettingsClick }: Props) {
  const { user, profile } = useAuth();
  const [score, setScore] = useState(0);
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const displayUid =
    typeof profile?.publicUid === 'number' ? `UID ${profile.publicUid}` : 'UID --';

  // 拉好感度状态（数值不展示，只展示阶段名 + 进度条）
  useEffect(() => {
    if (!user) return;
    getAffinityState(user.id).then(s => {
      setScore(s.score);
      setStage(s.stage);
    });
  }, [refreshKey, user]);

  // 进度条按 0-100 映射，但不显示数字
  const pct = Math.max(2, Math.min(100, score));
  const stageColor = STAGE_COLOR[stage];

  return (
    <div className="flex items-center gap-3">
      {/* 好感度条（无数字）*/}
      <div className="hidden md:flex flex-col gap-1 w-44">
        <div className="flex items-center justify-between font-mono text-xs font-bold tracking-widest text-text-dim">
          <span>RAPPORT</span>
          <span className="font-bold" style={{ color: stageColor }}>{STAGE_NAME[stage]}</span>
        </div>
        <div className="relative h-1.5 bg-bg-deep border border-line cut-tl overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${stageColor}, ${stageColor}cc)`,
              boxShadow: `0 0 8px ${stageColor}88`
            }}
          />
          {/* 进度条上的"刻度"装饰 */}
          {[30, 70].map(p => (
            <div
              key={p}
              className="absolute top-0 bottom-0 w-px bg-text-dim/30"
              style={{ left: `${p}%` }}
            />
          ))}
        </div>
      </div>

      {/* 点数 */}
      <div className="flex items-center gap-2 px-3 py-2 bg-bg-card border border-line cut-tl">
        <Coins size={14} className="text-accent-gold" />
        <span className="font-mono text-base font-bold text-accent-gold tracking-wider">{profile?.points ?? 0}</span>
        <span className="font-mono text-xs font-bold text-text-dim tracking-widest hidden sm:inline">PT</span>
      </div>

      {/* 用户名 */}
      <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-bg-card border border-line cut-tl">
        <User2 size={14} className="text-text-dim" />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold text-text">{profile?.displayName || '冒险者'}</span>
          <span className="font-mono text-xs font-bold tracking-widest text-text-mute">{displayUid}</span>
        </div>
      </div>

      {/* 设置按钮 */}
      <button
        onClick={onSettingsClick}
        className="p-2 bg-bg-card border border-line cut-tl text-text-dim hover:text-accent-gold hover:border-accent-gold transition"
        aria-label="设置"
      >
        <SettingsIcon size={16} />
      </button>
    </div>
  );
}
