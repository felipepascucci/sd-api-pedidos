import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from 'cn'
import { SAUDE_STYLE, type Saude } from '@/lib/queries'

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, children }: { icon: LucideIcon; title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
      <div className="rounded-full bg-muted p-3">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      {children}
    </div>
  )
}

export function HealthDot({ saude, pulse = true, className }: { saude: Saude; pulse?: boolean; className?: string }) {
  const s = SAUDE_STYLE[saude]
  return (
    <span className={cn('relative inline-flex size-2', className)}>
      {pulse && saude !== 'carregando' && (
        <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-50', s.dot, saude === 'ok' && 'animate-none opacity-0')} />
      )}
      <span className={cn('relative inline-flex size-2 rounded-full', s.dot)} />
    </span>
  )
}

export function Callout({ children, tone = 'info', icon: Icon, className }: { children: ReactNode; tone?: 'info' | 'warn'; icon?: LucideIcon; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs leading-relaxed',
        tone === 'info' ? 'border-sky-500/30 bg-sky-500/5 text-sky-800 dark:text-sky-200' : 'border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-200',
        className,
      )}
    >
      {Icon && <Icon className="mt-0.5 size-4 shrink-0" />}
      <div>{children}</div>
    </div>
  )
}
