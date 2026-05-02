'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';

interface Props {
  /** 要显示的文本 */
  text: string;
  /** 说话者名（默认 "绯夏"，避免出现"看板娘"称呼）*/
  speaker?: string;
  /** 弹出方向：尾巴指向哪边 */
  tailSide?: 'right' | 'left' | 'bottom';
  /** 是否启用逐字打印效果 */
  typewriter?: boolean;
  /** 打印速度（毫秒/字符）*/
  speed?: number;
  /** 完成回调（最后一个字打完时）*/
  onComplete?: () => void;
}

/**
 * 漫画风对话框
 * 浅色底 + Yale Blue 描边 + 弹出动效（cubic-bezier 弹性）+ 可选 typewriter
 */
export function ComicBubble({
  text,
  speaker = '绯夏',
  tailSide = 'right',
  typewriter = true,
  speed = 32,
  onComplete
}: Props) {
  const [shown, setShown] = useState(typewriter ? '' : text);
  const completedRef = useRef(false);

  useEffect(() => {
    completedRef.current = false;
    if (!typewriter) {
      setShown(text);
      onComplete?.();
      return;
    }
    setShown('');
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete?.();
        }
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, typewriter, speed, onComplete]);

  return (
    <div className="relative inline-block max-w-full animate-bubble-pop">
      {/* 主气泡 */}
      <div
        className="relative bg-bg-card border-2 border-accent-flame px-5 py-4 rounded-2xl shadow-[0_4px_18px_rgba(8,75,131,0.18)]"
        style={{
          minWidth: 240
        }}
      >
        {/* 顶部 3px Yale Blue 实色横条（design reg 推荐）*/}
        <div className="absolute top-0 left-4 right-4 h-[3px] bg-accent-flame rounded-b" style={{ width: '32%' }} />

        {/* 说话者标签 */}
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles size={11} className="text-accent-flame" />
          <span className="font-mono text-[10px] tracking-[0.3em] text-accent-flame font-bold">
            {speaker.toUpperCase()} · {speaker}
          </span>
          <span className="ml-auto font-mono text-[9px] text-text-mute">
            {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* 文字 */}
        <p className="text-base text-text-display leading-relaxed min-h-[1.6em]">
          {shown}
          {typewriter && shown.length < text.length && (
            <span className="inline-block w-[2px] h-[1.1em] bg-accent-flame ml-0.5 align-middle animate-blink" />
          )}
        </p>

        {/* 尾部三角（指向角色）*/}
        {tailSide === 'right' && (
          <>
            <div
              className="absolute top-1/2 -right-3 w-0 h-0 -translate-y-1/2"
              style={{
                borderTop: '10px solid transparent',
                borderBottom: '10px solid transparent',
                borderLeft: '14px solid #084B83'
              }}
            />
            <div
              className="absolute top-1/2 -right-2 w-0 h-0 -translate-y-1/2"
              style={{
                borderTop: '8px solid transparent',
                borderBottom: '8px solid transparent',
                borderLeft: '11px solid #FFFFFF'
              }}
            />
          </>
        )}
        {tailSide === 'left' && (
          <>
            <div
              className="absolute top-1/2 -left-3 w-0 h-0 -translate-y-1/2"
              style={{
                borderTop: '10px solid transparent',
                borderBottom: '10px solid transparent',
                borderRight: '14px solid #084B83'
              }}
            />
            <div
              className="absolute top-1/2 -left-2 w-0 h-0 -translate-y-1/2"
              style={{
                borderTop: '8px solid transparent',
                borderBottom: '8px solid transparent',
                borderRight: '11px solid #FFFFFF'
              }}
            />
          </>
        )}
        {tailSide === 'bottom' && (
          <>
            <div
              className="absolute left-8 -bottom-3 w-0 h-0"
              style={{
                borderLeft: '10px solid transparent',
                borderRight: '10px solid transparent',
                borderTop: '14px solid #084B83'
              }}
            />
            <div
              className="absolute left-9 -bottom-2 w-0 h-0"
              style={{
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop: '11px solid #FFFFFF'
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
