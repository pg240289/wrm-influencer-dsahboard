import React from 'react'
import { NavLink } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { navSections, filterNav } from '@/lib/nav'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

function NavItem({ item, collapsed, onNavigate }) {
  const Icon = item.icon
  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-sidebar-accent text-sidebar-primary'
            : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground'
        )
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  )

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    )
  }
  return link
}

export function Sidebar({ collapsed = false, onNavigate }) {
  const { hasAnyRole } = useAuth()
  const sections = filterNav(navSections, hasAnyRole)

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Brand */}
      <div className={cn('flex h-16 items-center gap-2.5 border-b border-sidebar-border px-4', collapsed && 'justify-center px-0')}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Sparkles className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-tight text-foreground">Influencer Hub</div>
            <div className="truncate text-xs text-muted-foreground">Campaign Platform</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-6 overflow-y-auto scrollbar-thin px-3 py-4">
        {sections.map((section, si) => (
          <div key={si} className="space-y-1">
            {section.heading && !collapsed && (
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {section.heading}
              </div>
            )}
            {section.items.map((item) => (
              <NavItem key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>
    </div>
  )
}
