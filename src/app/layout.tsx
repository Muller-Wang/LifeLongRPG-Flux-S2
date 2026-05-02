import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { LoadingOverlay } from '@/components/LoadingOverlay';

export const metadata: Metadata = {
  title: '命途 · LifeLongRPG',
  description: '把人生变成一场你愿意打通关的游戏'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;800;900&family=Inter:wght@500;700&family=JetBrains+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <AuthProvider>
          {children}
          <LoadingOverlay />
        </AuthProvider>
      </body>
    </html>
  );
}
