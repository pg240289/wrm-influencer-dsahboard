import React from 'react'
import { cn } from '@/lib/utils'

/**
 * Standardized page header used across all module screens.
 *
 * Props:
 *  - title:       string (required)
 *  - description: string
 *  - breadcrumb:  array of { label, to } | undefined
 *  - actions:     ReactNode (buttons rendered on the right)
 */
export function PageHeader({ title, description, breadcrumb, actions, className }) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-muted-foreground/50">/</span>}
                <span className={cn(i === breadcrumb.length - 1 && 'text-foreground')}>{crumb.label}</span>
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
