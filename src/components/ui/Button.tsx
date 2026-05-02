'use client';

import { ReactNode, ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
 variant?: Variant;
 size?: Size;
 fullWidth?: boolean;
 icon?: ReactNode;
}

const variantClass: Record<Variant, string> = {
 primary:
 'bg-accent-flame text-white border-2 border-primary-DEFAULT hover:bg-primary-hover',
 secondary:
 'bg-white/55 text-accent-flame border-2 border-line backdrop-blur-md hover:bg-white/85 hover:border-primary-DEFAULT/35',
 ghost:
 'bg-transparent text-text-dim border-2 border-transparent hover:text-accent-flame',
 danger:
 'bg-white/55 text-[#C47A5C] border-2 border-[#C47A5C]/30 backdrop-blur-md hover:bg-[#C47A5C]/10'
};

const sizeClass: Record<Size, string> = {
 sm: 'text-xs px-3 py-1.5',
 md: 'text-sm px-4 py-2',
 lg: 'text-base px-6 py-3'
};

export function Button({
 variant = 'primary',
 size = 'md',
 fullWidth = false,
 icon,
 className = '',
 children,
 ...rest
}: Props) {
 return (
 <button
  {...rest}
  className={[
  'relative inline-flex items-center justify-center gap-2',
  'font-semibold tracking-[0.08em] rounded-none',
  'transition-all duration-150 ',
  'disabled:opacity-40 disabled:cursor-not-allowed',
  variantClass[variant],
  sizeClass[size],
  fullWidth ? 'w-full' : '',
  className
  ].join(' ')}
 >
  {icon}
  {children}
 </button>
 );
}
