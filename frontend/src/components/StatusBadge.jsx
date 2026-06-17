import React from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

// Maps the various status strings used across campaigns, assignments and content
// to a semantic badge variant.
const VARIANT = {
  active: 'success',
  completed: 'info',
  draft: 'secondary',
  paused: 'warning',
  cancelled: 'destructive',
  pending: 'warning',
  in_progress: 'info',
  submitted: 'info',
  approved: 'success',
  published: 'success',
  rejected: 'destructive',
  inactive: 'secondary',
  blacklisted: 'destructive',
}

export function StatusBadge({ status, className }) {
  if (!status) return null
  const key = String(status).toLowerCase()
  return (
    <Badge variant={VARIANT[key] || 'secondary'} className={cn('capitalize', className)}>
      {String(status).replace(/_/g, ' ')}
    </Badge>
  )
}
