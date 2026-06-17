import React from 'react'
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Stagger, StaggerItem } from '@/components/motion'

const TONE = {
  positive: { icon: TrendingUp, wrap: 'bg-success/10 text-success' },
  warning: { icon: AlertTriangle, wrap: 'bg-warning/10 text-warning' },
  opportunity: { icon: Lightbulb, wrap: 'bg-info/10 text-info' },
  neutral: { icon: Info, wrap: 'bg-primary/10 text-primary' },
}

/**
 * Premium "AI insights" panel. Fully offline — `insights` are computed from
 * real data by lib/insights.js (no tokens / API calls).
 */
export function InsightsPanel({ insights = [], className }) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b bg-gradient-to-r from-primary/[0.07] to-transparent">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          AI insights
        </CardTitle>
        <Badge variant="secondary" className="gap-1 text-[11px]">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Offline · live
        </Badge>
      </CardHeader>
      <CardContent className="p-2">
        <Stagger className="flex flex-col">
          {insights.map((it) => {
            const tone = TONE[it.tone] || TONE.neutral
            const Icon = tone.icon
            return (
              <StaggerItem key={it.id}>
                <div className="flex gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50">
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tone.wrap)}>
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{it.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{it.detail}</p>
                  </div>
                </div>
              </StaggerItem>
            )
          })}
        </Stagger>
      </CardContent>
    </Card>
  )
}
