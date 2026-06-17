import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { Megaphone, Users, Activity, Layers, Plus, ArrowUpRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { generateDashboardInsights } from '@/lib/insights'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/StatCard'
import { StatusBadge } from '@/components/StatusBadge'
import { InsightsPanel } from '@/components/InsightsPanel'
import { FadeIn, Stagger, StaggerItem } from '@/components/motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const formatNumber = (n) => (n || 0).toLocaleString()

export default function DashboardHome() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const { user, isManager } = useAuth()

  useEffect(() => {
    let active = true
    axios
      .get('/campaigns')
      .then((res) => active && (setCampaigns(res.data || []), setLoading(false)))
      .catch(() => active && (setError('Failed to load dashboard data.'), setLoading(false)))
    return () => {
      active = false
    }
  }, [])

  const activeCampaigns = campaigns.filter((c) => c.status === 'active').length
  const totalInfluencers = campaigns.reduce((s, c) => s + (c.num_influencers || 0), 0)
  const totalContent = campaigns.reduce((s, c) => s + (c.total_content || 0), 0)
  const totalViews = campaigns.reduce((s, c) => s + (c.total_views || 0), 0)

  const stats = [
    { label: 'Total campaigns', value: campaigns.length, hint: `${activeCampaigns} active`, icon: Megaphone, tone: 'primary' },
    { label: 'Active campaigns', value: activeCampaigns, hint: 'In flight now', icon: Activity, tone: 'success' },
    { label: 'Influencers engaged', value: totalInfluencers, hint: 'Across all campaigns', icon: Users, tone: 'info' },
    { label: 'Content pieces', value: totalContent, hint: `${formatNumber(totalViews)} total views`, icon: Layers, tone: 'warning' },
  ]

  const recent = [...campaigns].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 6)
  const insights = generateDashboardInsights(campaigns)

  return (
    <>
      <FadeIn>
        <PageHeader
          title={`Welcome back${user?.first_name ? `, ${user.first_name}` : ''}`}
          description="Here's what's happening across your influencer campaigns."
          actions={
            isManager() && (
              <Button onClick={() => navigate('/campaigns/new')}>
                <Plus className="h-4 w-4" />
                New campaign
              </Button>
            )
          }
        />
      </FadeIn>

      {error && (
        <Card className="mb-6 border-destructive/40 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[116px] rounded-lg" />)}
        </div>
      ) : (
        <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <StaggerItem key={s.label}>
              <StatCard {...s} />
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Recent campaigns */}
        <FadeIn delay={0.05} className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Recent campaigns</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/campaigns')}>
                View all
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-2 p-6">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : recent.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Megaphone className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">No campaigns yet</p>
                    <p className="text-sm text-muted-foreground">Create your first campaign to get started.</p>
                  </div>
                  {isManager() && (
                    <Button size="sm" onClick={() => navigate('/campaigns/new')}>
                      <Plus className="h-4 w-4" />
                      New campaign
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Campaign</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead className="text-center">Influencers</TableHead>
                      <TableHead className="text-center">Content</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.map((c) => (
                      <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/campaign/${c.id}`)}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                              {(c.campaign_name || '?').charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-foreground">{c.campaign_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{c.brand_name || '—'}</TableCell>
                        <TableCell className="text-center tabular-nums">{c.num_influencers || 0}</TableCell>
                        <TableCell className="text-center tabular-nums">{c.total_content || 0}</TableCell>
                        <TableCell><StatusBadge status={c.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        {/* AI insights */}
        <FadeIn delay={0.1}>
          {loading ? <Skeleton className="h-72 rounded-lg" /> : <InsightsPanel insights={insights} />}
        </FadeIn>
      </div>
    </>
  )
}
