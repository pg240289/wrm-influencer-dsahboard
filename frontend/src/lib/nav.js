import {
  LayoutDashboard,
  Megaphone,
  Users,
  Building2,
  BarChart3,
  Database,
  ShieldCheck,
} from 'lucide-react'

// Roles allowed to see each item. Empty/undefined => all staff roles.
const STAFF = ['Admin', 'Campaign Manager', 'Campaign Executor']

export const navSections = [
  {
    heading: null,
    items: [
      { label: 'Dashboard', to: '/', icon: LayoutDashboard, end: true, roles: STAFF },
      { label: 'Campaigns', to: '/campaigns', icon: Megaphone, roles: STAFF },
      { label: 'Influencers', to: '/influencers', icon: Users, roles: STAFF },
      { label: 'Brands', to: '/brands', icon: Building2, roles: STAFF },
      { label: 'Analytics', to: '/analytics', icon: BarChart3, roles: ['Admin', 'Campaign Manager'] },
    ],
  },
  {
    heading: 'Settings',
    items: [
      { label: 'Master Data', to: '/masters', icon: Database, roles: ['Admin', 'Campaign Manager'] },
      { label: 'Users & Roles', to: '/users', icon: ShieldCheck, roles: ['Admin'] },
    ],
  },
]

/** Filter nav sections to those the current user (by roles) can access. */
export function filterNav(sections, hasAnyRole) {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.roles || hasAnyRole(item.roles)),
    }))
    .filter((section) => section.items.length > 0)
}
