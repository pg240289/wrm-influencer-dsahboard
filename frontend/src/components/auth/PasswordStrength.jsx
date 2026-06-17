import React from 'react'
import { cn } from '@/lib/utils'

function scorePassword(pw) {
  if (!pw) return 0
  let s = 0
  if (pw.length >= 6) s++
  if (pw.length >= 10) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return Math.min(s, 4)
}

const LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong']
const COLORS = ['bg-destructive', 'bg-destructive', 'bg-warning', 'bg-info', 'bg-success']

export function PasswordStrength({ value }) {
  if (!value) return null
  const s = scorePassword(value)
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn('h-1.5 flex-1 rounded-full transition-colors', i < s ? COLORS[s] : 'bg-muted')}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Password strength: {LABELS[s]}</p>
    </div>
  )
}
