import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'

const styles: Record<Variant, string> = {
  primary:
    'bg-[var(--ui-navy)] text-white hover:bg-[var(--ui-navy-mid)] disabled:opacity-45',
  secondary:
    'bg-white text-[var(--ui-navy)] border border-[var(--ui-line)] hover:bg-[var(--ui-soft)] disabled:opacity-45',
  ghost:
    'bg-transparent text-[var(--ui-navy)] hover:bg-[var(--ui-soft)] disabled:opacity-45',
  accent:
    'bg-[var(--ui-gold)] text-[var(--ui-navy-deep)] hover:brightness-105 disabled:opacity-45',
  danger: 'bg-[var(--ui-danger)] text-white hover:opacity-90 disabled:opacity-45',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  children: ReactNode
}

export function Button({ variant = 'primary', className = '', children, ...props }: Props) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition enabled:active:scale-[0.98] ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
