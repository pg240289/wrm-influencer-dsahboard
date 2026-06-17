import React, { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { Eye, TrendingUp, Wallet, Gauge, Download, BarChart3 } from 'lucide-react'
import { generateDashboardInsights } from '@/lib/insights'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/StatCard'
import { StatusBadge } from '@/components/StatusBadge'
import { InsightsPanel } from '@/components/InsightsPanel'
import { FadeIn, Stagger, StaggerItem } from '@/components/motion'
import { MetricAreaChart, DonutChart, HorizontalBarChart, formatNumber } from '@/components/charts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const fmtMoney = (n) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(1)}K` : `₹${Math.round(n || 0)}`)
const erOf = (c) => (c.total_views > 0 ? ((c.total_likes + c.total_comments) / c.total_views) * 100 : 0)

export default function Analytics() {
  const [campaigns, setCampaigns] = useState([])
  const [details, setDetails] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const list = (await axios.get('/campaigns')).data || []
        if (!active) return
        setCampaigns(list)
        const det = await Promise.all(list.map((c) => axios.get(`/campaigns/${c.id}`).then((r) => r.data).catch(() => null)))
        if (active) setDetails(det.filter(Boolean))
      } catch {
        if (active) setError('Failed to load analytics')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  const a = useMemo(() => {
    const totals = campaigns.reduce(
      (acc, c) => ({
        views: acc.views + (c.total_views || 0),
        likes: acc.likes + (c.total_likes || 0),
        comments: acc.comments + (c.total_comments || 0),
        content: acc.content + (c.total_content || 0),
        influencers: acc.influencers + (c.num_influencers || 0),
      }),
      { views: 0, likes: 0, comments: 0, content: 0, influencers: 0 }
    )
    const er = totals.views > 0 ? ((totals.likes + totals.comments) / totals.views) * 100 : 0

    const spendByCampaign = {}
    let spend = 0
    const platformViews = {}
    const dailyMap = {}
    details.forEach((d) => {
      const cSpend = (d.influencers || []).reduce((s, inf) => s + (inf.agreed_amount || 0), 0)
      spendByCampaign[d.id] = cSpend
      spend += cSpend
      ;(d.content || []).forEach((ct) => {
        if (ct.platform) platformViews[ct.platform] = (platformViews[ct.platform] || 0) + (ct.views || 0)
        const date = ct.published_at || ct.created_at
        if (date) {
          const e = (dailyMap[date] = dailyMap[date] || { date, views: 0 })
          e.views += ct.views || 0
        }
      })
    })

    const daily = Object.values(dailyMap).sort((x, y) => new Date(x.date) - new Date(y.date))
    let run = 0
    const reachTrend = daily.map((d) => ({ date: d.date, views: (run += d.views) }))

    const statusData = Object.entries(
      campaigns.reduce((m, c) => ({ ...m, [c.status || 'unknown']: (m[c.status || 'unknown'] || 0) + 1 }), {})
    ).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))

    const reachByCampaign = [...campaigns]
      .map((c) => ({ name: c.campaign_name, value: c.total_views || 0 }))
      .sort((x, y) => y.value - x.value)
      .filter((x) => x.value > 0)
      .slice(0, 8)

    const platformData = Object.entries(platformViews).map(([name, value]) => ({ name, value })).filter((x) => x.value > 0).sort((x, y) => y.value - x.value)

    const topCampaigns = [...campaigns]
      .sort((x, y) => (y.total_views || 0) - (x.total_views || 0))
      .slice(0, 6)
      .map((c) => ({ ...c, er: erOf(c), spend: spendByCampaign[c.id] || 0 }))

    const cpm = spend > 0 && totals.views > 0 ? (spend / totals.views) * 1000 : 0

    return { totals, er, spend, cpm, reachTrend, statusData, reachByCampaign, platformData, topCampaigns, spendByCampaign }
  }, [campaigns, details])

  const insights = useMemo(() => {
    const base = generateDashboardInsights(campaigns)
    if (a.platformData.length && a.totals.views > 0) {
      const top = a.platformData[0]
      base.unshift({ id: 'platform', tone: 'opportunity', title: `${top.name} drives ${((top.value / a.totals.views) * 100).toFixed(0)}% of your reach`, detail: `${formatNumber(top.value)} views came from ${top.name}. Consider weighting future briefs toward your strongest channels.` })
    }
    if (a.spend > 0) {
      base.unshift({ id: 'spend', tone: 'neutral', title: `${fmtMoney(a.spend)} committed across campaigns`, detail: `That's about ${fmtMoney(a.cpm)} per 1,000 views — a useful CPM benchmark for planning.` })
    }
    return base.slice(0, 5)
  }, [campaigns, a])

  const exportCSV = () => {
    const header = ['Campaign', 'Brand', 'Status', 'Influencers', 'Content', 'Views', 'Likes', 'Comments', 'Engagement %', 'Spend']
    const rows = campaigns.map((c) => [c.campaign_name, c.brand_name, c.status, c.num_influencers, c.total_content, c.total_views, c.total_likes, c.total_comments, erOf(c).toFixed(2), a.spendByCampaign[c.id] || 0])
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'campaign-analytics.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const stats = [
    { label: 'Total reach', value: formatNumber(a.totals.views), hint: `${formatNumber(a.totals.content)} content pieces`, icon: Eye, tone: 'primary' },
    { label: 'Avg engagement', value: `${a.er.toFixed(1)}%`, hint: 'Likes + comments / views', icon: TrendingUp, tone: 'success' },
    { label: 'Total spend', value: a.spend > 0 ? fmtMoney(a.spend) : '—', hint: a.spend > 0 ? 'Agreed amounts' : 'Not tracked yet', icon: Wallet, tone: 'warning' },
    { label: 'Cost / 1K views', value: a.cpm > 0 ? fmtMoney(a.cpm) : '—', hint: a.cpm > 0 ? 'Portfolio CPM' : 'Add spend to compute', icon: Gauge, tone: 'info' },
  ]

  if (!loading && campaigns.length === 0) {
    return (
      <>
        <PageHeader title="Analytics & Reports" description="Portfolio-level insight across all your campaigns." />
        <Card><CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"><BarChart3 className="h-6 w-6 text-muted-foreground" /></div>
          <p className="text-sm font-medium text-foreground">No data to analyze yet</p>
          <p className="text-sm text-muted-foreground">Create campaigns and publish content to see analytics here.</p>
        </CardContent></Card>
      </>
    )
  }

  return (
    <>
      <FadeIn>
        <PageHeader
          title="Analytics & Reports"
          description="Portfolio-level insight across all your campaigns."
          actions={!loading && <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4" /> Export CSV</Button>}
        />
      </FadeIn>

      {error && <Card className="mb-6 border-destructive/40 bg-destructive/5"><CardContent className="py-4 text-sm text-destructive">{error}</CardContent></Card>}

      {loading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[116px] rounded-lg" />)}</div>
          <Skeleton className="h-80 w-full rounded-lg" />
        </div>
      ) : (
        <>
          <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((s) => <StaggerItem key={s.label}><StatCard {...s} /></StaggerItem>)}
          </Stagger>

          {/* Reach trend + AI insights */}
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <FadeIn delay={0.05} className="lg:col-span-2">
              <MetricAreaChart id="an-reach" title="Cumulative reach over time" data={a.reachTrend} dataKey="views" color="#6366f1" height={300} />
            </FadeIn>
            <FadeIn delay={0.1}>
              <InsightsPanel insights={insights} />
            </FadeIn>
          </div>

          {/* Reach by campaign + status */}
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <FadeIn delay={0.05} className="lg:col-span-2">
              <Card>
                <CardHeader><CardTitle className="text-sm">Reach by campaign</CardTitle></CardHeader>
                <CardContent><HorizontalBarChart data={a.reachByCampaign} height={Math.max(220, a.reachByCampaign.length * 38)} /></CardContent>
              </Card>
            </FadeIn>
            <FadeIn delay={0.1}>
              <Card>
                <CardHeader><CardTitle className="text-sm">Campaigns by status</CardTitle></CardHeader>
                <CardContent><DonutChart data={a.statusData} /></CardContent>
              </Card>
            </FadeIn>
          </div>

          {/* Platform mix + top campaigns */}
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <FadeIn delay={0.05}>
              <Card>
                <CardHeader><CardTitle className="text-sm">Reach by platform</CardTitle></CardHeader>
                <CardContent><DonutChart data={a.platformData} /></CardContent>
              </Card>
            </FadeIn>
            <FadeIn delay={0.1} className="lg:col-span-2">
              <Card className="overflow-hidden">
                <CardHeader><CardTitle className="text-sm">Top campaigns</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Campaign</TableHead>
                        <TableHead className="text-right">Reach</TableHead>
                        <TableHead className="text-right">Engagement</TableHead>
                        <TableHead className="text-right">Spend</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {a.topCampaigns.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium text-foreground">{c.campaign_name}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(c.total_views)}</TableCell>
                          <TableCell className="text-right tabular-nums">{c.er.toFixed(1)}%</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{c.spend > 0 ? fmtMoney(c.spend) : '—'}</TableCell>
                          <TableCell><StatusBadge status={c.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </FadeIn>
          </div>
        </>
      )}
    </>
  )
}
