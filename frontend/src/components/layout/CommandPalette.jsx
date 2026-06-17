import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Sun } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { navSections, filterNav } from '@/lib/nav'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command'

export function CommandPalette({ open, onOpenChange }) {
  const navigate = useNavigate()
  const { hasAnyRole, isManager } = useAuth()
  const { toggleTheme } = useTheme()
  const sections = filterNav(navSections, hasAnyRole)
  const items = sections.flatMap((s) => s.items)

  const go = (to) => {
    onOpenChange(false)
    navigate(to)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {items.map((item) => (
            <CommandItem key={item.to} value={item.label} onSelect={() => go(item.to)}>
              <item.icon />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {isManager() && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Create">
              <CommandItem value="new campaign" onSelect={() => go('/campaigns/new')}>
                <Plus />
                <span>New campaign</span>
              </CommandItem>
              <CommandItem value="new influencer" onSelect={() => go('/influencers/new')}>
                <Plus />
                <span>New influencer</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Preferences">
          <CommandItem
            value="toggle theme dark light"
            onSelect={() => {
              toggleTheme()
              onOpenChange(false)
            }}
          >
            <Sun />
            <span>Toggle light / dark theme</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
