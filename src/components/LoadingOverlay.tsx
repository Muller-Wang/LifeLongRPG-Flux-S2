'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';

export function LoadingOverlay() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const prevPathRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 标记客户端已挂载（避免 SSR 时闪现）
  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted) return;

    // 清除之前的定时器
    if (timerRef.current) clearTimeout(timerRef.current);

    // 淡入
    setIsVisible(true);

    // 最少显示 800ms，然后淡出
    timerRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 800);

    prevPathRef.current = pathname;

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname, hasMounted]);

  // SSR 阶段不渲染任何内容
  if (!hasMounted) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-500 ease-in-out"
      style={{
        background: '#DCEDFF',
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'all' : 'none'
      }}
    >
      <img
        src="/loading-screen.png"
        alt="Loading"
        className="w-full h-full object-cover select-none"
        style={{
          opacity: imgLoaded ? 1 : 0,
          transition: 'opacity 0.4s ease-out'
        }}
        onLoad={() => setImgLoaded(true)}
      />
    </div>
  );
}
