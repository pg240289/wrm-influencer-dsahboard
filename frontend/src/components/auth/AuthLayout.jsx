import React from 'react'
import { Sparkles, BarChart3, Users, ShieldCheck, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/button'

const FEATURES = [
  { icon: Users, title: 'One influencer master', desc: 'Reusable profiles, rate cards and collaboration history.' },
  { icon: BarChart3, title: 'Campaign analytics', desc: 'Track reach, engagement and content as it happens.' },
  { icon: ShieldCheck, title: 'Role-based access', desc: 'The right access for admins, managers and creators.' },
]

/**
 * Split-screen authentication layout: brand panel (left) + form panel (right).
 * The brand panel collapses on small screens, where a compact brand mark shows
 * above the form instead.
 */
export function AuthLayout({ children }) {
  const { theme, toggleTheme } = useTheme()
  const year = new Date().getFullYear()

  return (
    <div className="flex min-h-screen bg-background">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-black/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <div className="text-lg font-semibold leading-tight">Influencer Hub</div>
            <div className="text-sm text-primary-foreground/70">Campaign Management Platform</div>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">Run influencer campaigns, end to end.</h2>
          <p className="mt-3 text-primary-foreground/80">
            From casting to content to results — one platform for your whole team.
          </p>
          <ul className="mt-8 space-y-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium">{f.title}</div>
                  <div className="text-sm text-primary-foreground/70">{f.desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-sm text-primary-foreground/60">© {year} White Rivers Media</div>
      </div>

      {/* Form panel */}
      <div className="relative flex w-full flex-col lg:w-1/2">
        <div className="absolute right-4 top-4">
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-sm">
            <div className="mb-8 flex items-center gap-2.5 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="text-base font-semibold">Influencer Hub</div>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
