import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  ArrowLeft, Users, Layers, Eye, Heart, MessageCircle, TrendingUp, Plus, Trash2, Pencil,
  ExternalLink, Loader2, X, Check,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/StatCard'
import { StatusBadge } from '@/components/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { PLATFORMS as PLATFORM_SPECS, CONTENT_TYPES, getPlatform, looksLikeValidPostUrl } from '@/lib/platforms'

const CHART = { views: '#6366f1', likes: '#ec4899', comments: '#10b981' }

const formatNumber = (num) => {
  if (num == null) return '0'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

const formatDate = (s) => {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const calculateCumulative = (data, key) => {
  let total = 0
  return data.map((item) => {
    total += item[key] || 0
    return { ...item, [key]: total }
  })
}

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
        <p className="mb-1 font-medium text-foreground">{formatDate(label)}</p>
        {payload.map((entry, i) => (
          <p key={i} style={{ color: entry.color }}>
            {`${entry.name || entry.dataKey}: ${formatNumber(entry.value)}`}
          </p>
        ))}
      </div>
    )
  }
  return null
}

function MetricChart({ id, title, data, dataKey, color, mode, onMode, height = 280, grid, axis }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <div className="inline-flex rounded-md bg-muted p-0.5 text-xs">
          {['cumulative', 'daily'].map((m) => (
            <button
              key={m}
              onClick={() => onMode(m)}
              className={`rounded px-2.5 py-1 font-medium capitalize transition-colors ${
                mode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="date" stroke={axis} fontSize={11} tickFormatter={formatDate} axisLine={false} tickLine={false} />
              <YAxis stroke={axis} fontSize={11} tickFormatter={formatNumber} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} fill={`url(#${id})`}
                dot={{ r: 3, fill: color, strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 5, fill: color, strokeWidth: 2, stroke: '#fff' }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            No data available for this period
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function CampaignDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { theme } = useTheme()
  const { isCampaignManager, isCampaignExecutor } = useAuth()
  const confirm = useConfirm()

  const [campaign, setCampaign] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [tab, setTab] = useState('graph')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [viewsMode, setViewsMode] = useState('cumulative')
  const [likesMode, setLikesMode] = useState('cumulative')
  const [commentsMode, setCommentsMode] = useState('cumulative')

  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [availableInfluencers, setAvailableInfluencers] = useState([])
  const [selInfluencer, setSelInfluencer] = useState('')
  const [selPlatform, setSelPlatform] = useState('')
  const [selAmount, setSelAmount] = useState('')
  const [addingInfluencer, setAddingInfluencer] = useState(false)

  const [actionSuccess, setActionSuccess] = useState('')
  const [actionError, setActionError] = useState('')

  const [addingContentFor, setAddingContentFor] = useState(null)
  const [newContentUrl, setNewContentUrl] = useState('')
  const [newContentType, setNewContentType] = useState('Post')
  const [editingContentId, setEditingContentId] = useState(null)
  const [editContentUrl, setEditContentUrl] = useState('')
  const [editingAmountFor, setEditingAmountFor] = useState(null)
  const [amountValue, setAmountValue] = useState('')

  const grid = theme === 'dark' ? '#27272a' : '#eef2f7'
  const axis = theme === 'dark' ? '#71717a' : '#94a3b8'

  const flash = (setter, msg) => {
    setter(msg)
    setTimeout(() => setter(''), 3000)
  }

  useEffect(() => {
    fetchCampaignData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const fetchCampaignData = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await axios.get(`/campaigns/${id}`)
      const data = res.data
      setCampaign(data)
      const today = new Date().toISOString().split('T')[0]
      const startDate = data.start_date || today
      setFilterStartDate(startDate)
      setFilterEndDate(today)
      const aRes = await axios.get(`/campaigns/${id}/analytics`, { params: { start_date: startDate, end_date: today } })
      setAnalytics(aRes.data)
      setLoading(false)
    } catch (err) {
      if (err.response?.status === 403) setError('You do not have permission to view this campaign.')
      else if (err.response?.status === 401) setError('Session expired. Please login again.')
      else setError('Failed to load campaign data. Please try again.')
      setLoading(false)
    }
  }

  const fetchAnalytics = async (startDate, endDate) => {
    try {
      setAnalyticsLoading(true)
      const params = {}
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate
      const res = await axios.get(`/campaigns/${id}/analytics`, { params })
      setAnalytics(res.data)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const onStartDate = (e) => {
    const v = e.target.value
    setFilterStartDate(v)
    if (v && filterEndDate) fetchAnalytics(v, filterEndDate)
  }
  const onEndDate = (e) => {
    const v = e.target.value
    setFilterEndDate(v)
    if (filterStartDate && v) fetchAnalytics(filterStartDate, v)
  }

  const openAddInfluencer = async () => {
    setAddOpen(true)
    try {
      const res = await axios.get('/influencers', { params: { status: 'active', for_campaign: true } })
      setAvailableInfluencers(res.data || [])
    } catch {
      setAvailableInfluencers([])
    }
  }

  const handleAddInfluencer = async () => {
    if (!selInfluencer || !selPlatform) return
    setAddingInfluencer(true)
    try {
      await axios.post(`/campaigns/${id}/influencers`, { influencer_id: parseInt(selInfluencer), platform: selPlatform, agreed_amount: parseFloat(selAmount) || null })
      setAddOpen(false)
      setSelInfluencer('')
      setSelPlatform('')
      setSelAmount('')
      flash(setActionSuccess, 'Influencer added successfully')
      fetchCampaignData()
    } catch (err) {
      flash(setActionError, err.response?.data?.error || 'Failed to add influencer')
    }
    setAddingInfluencer(false)
  }

  const handleSaveAmount = async (assignmentId) => {
    try {
      await axios.put(`/campaigns/${id}/influencers/${assignmentId}/link`, { agreed_amount: parseFloat(amountValue) || null })
      setEditingAmountFor(null)
      setAmountValue('')
      flash(setActionSuccess, 'Agreed amount updated')
      fetchCampaignData()
    } catch (err) {
      flash(setActionError, err.response?.data?.error || 'Failed to update amount')
    }
  }

  const handleAddContent = async (assignmentId) => {
    if (!newContentUrl.trim()) return
    try {
      await axios.post(`/campaigns/${id}/influencers/${assignmentId}/content`, { url: newContentUrl, content_type: newContentType })
      setAddingContentFor(null)
      setNewContentUrl('')
      setNewContentType('Post')
      flash(setActionSuccess, 'Content link added')
      fetchCampaignData()
    } catch (err) {
      flash(setActionError, err.response?.data?.error || 'Failed to add content')
    }
  }

  const handleUpdateContent = async (contentId) => {
    if (!editContentUrl.trim()) return
    try {
      await axios.put(`/campaigns/${id}/content/${contentId}`, { url: editContentUrl })
      setEditingContentId(null)
      setEditContentUrl('')
      flash(setActionSuccess, 'Content link updated')
      fetchCampaignData()
    } catch (err) {
      flash(setActionError, err.response?.data?.error || 'Failed to update content')
    }
  }

  const handleDeleteContent = async (contentId) => {
    if (!(await confirm({ title: 'Delete content link?', description: 'This permanently removes the link from this campaign.', confirmText: 'Delete', destructive: true }))) return
    try {
      await axios.delete(`/campaigns/${id}/content/${contentId}`)
      flash(setActionSuccess, 'Content link deleted')
      fetchCampaignData()
    } catch (err) {
      flash(setActionError, err.response?.data?.error || 'Failed to delete content')
    }
  }

  const handleRemoveInfluencer = async (assignmentId) => {
    if (!(await confirm({ title: 'Remove influencer?', description: 'This removes the influencer and their content from this campaign.', confirmText: 'Remove', destructive: true }))) return
    try {
      await axios.delete(`/campaigns/${id}/influencers/${assignmentId}`)
      flash(setActionSuccess, 'Influencer removed')
      fetchCampaignData()
    } catch (err) {
      flash(setActionError, err.response?.data?.error || 'Failed to remove influencer')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <X className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">{error || 'Campaign not found'}</h3>
          <p className="text-sm text-muted-foreground">We couldn't load the campaign details.</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/campaigns')}>Back to campaigns</Button>
            <Button onClick={fetchCampaignData}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const engagementRate = campaign.total_views > 0
    ? ((campaign.total_likes + campaign.total_comments) / campaign.total_views * 100).toFixed(2)
    : '0.00'

  const dailyMetrics = analytics?.daily_metrics || []
  const chartData = (mode, key) => (mode === 'cumulative' ? calculateCumulative(dailyMetrics, key) : dailyMetrics)

  const stats = [
    { label: 'Influencers', value: String(campaign.num_influencers ?? 0), icon: Users, tone: 'primary' },
    { label: 'Content', value: String(campaign.total_content ?? 0), icon: Layers, tone: 'info' },
    { label: 'Views', value: formatNumber(campaign.total_views), icon: Eye, tone: 'primary' },
    { label: 'Likes', value: formatNumber(campaign.total_likes), icon: Heart, tone: 'destructive' },
    { label: 'Comments', value: formatNumber(campaign.total_comments), icon: MessageCircle, tone: 'success' },
    { label: 'Engagement', value: `${engagementRate}%`, icon: TrendingUp, tone: 'warning' },
  ]

  const influencers = campaign.influencers || []
  const allContent = campaign.content || []

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground" onClick={() => navigate('/campaigns')}>
        <ArrowLeft className="h-4 w-4" />
        Back to campaigns
      </Button>

      {/* Campaign header */}
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary text-xl font-semibold text-primary-foreground">
          {(campaign.campaign_name || '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{campaign.campaign_name}</h1>
            <StatusBadge status={campaign.status} />
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{campaign.objective}</span>
            <span>·</span>
            <span>{campaign.brand_name}</span>
            {campaign.start_date && (
              <>
                <span>·</span>
                <span>{formatDate(campaign.start_date)}{campaign.end_date && ` – ${formatDate(campaign.end_date)}`}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {(actionSuccess || actionError) && (
        <Alert variant={actionError ? 'destructive' : 'success'} className="mb-4">
          {actionError ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          <AlertDescription>{actionError || actionSuccess}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      {campaign.description && (
        <Card className="mt-4">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <span className="text-muted-foreground">{campaign.description}</span>
            <span className="shrink-0 text-xs text-muted-foreground">Created {formatDate(campaign.created_at)}</span>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="graph">Graph</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="top-performers">Top Performers</TabsTrigger>
          <TabsTrigger value="influencers">Influencers</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
        </TabsList>

        {/* Date filter for analytics tabs */}
        {['graph', 'timeline', 'top-performers'].includes(tab) && (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <Input type="date" value={filterStartDate} onChange={onStartDate} className="w-40" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Input type="date" value={filterEndDate} onChange={onEndDate} className="w-40" />
            </div>
            {analyticsLoading && (
              <span className="flex items-center gap-1.5 pb-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating…
              </span>
            )}
          </div>
        )}

        <TabsContent value="graph" className="space-y-4">
          <MetricChart id="g-views" title="Views" data={chartData(viewsMode, 'views')} dataKey="views"
            color={CHART.views} mode={viewsMode} onMode={setViewsMode} height={300} grid={grid} axis={axis} />
          <div className="grid gap-4 lg:grid-cols-2">
            <MetricChart id="g-likes" title="Likes" data={chartData(likesMode, 'likes')} dataKey="likes"
              color={CHART.likes} mode={likesMode} onMode={setLikesMode} height={240} grid={grid} axis={axis} />
            <MetricChart id="g-comments" title="Comments" data={chartData(commentsMode, 'comments')} dataKey="comments"
              color={CHART.comments} mode={commentsMode} onMode={setCommentsMode} height={240} grid={grid} axis={axis} />
          </div>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm">Content Publishing Timeline</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Daily content published during the campaign</p>
              </div>
              {dailyMetrics.length > 0 && (
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>Days: {dailyMetrics.length}</span>
                  <span>Avg/day: {(campaign.total_content / dailyMetrics.length).toFixed(1)}</span>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {dailyMetrics.length > 0 ? (
                <ResponsiveContainer width="100%" height={380}>
                  <BarChart data={dailyMetrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                    <XAxis dataKey="date" stroke={axis} fontSize={11} tickFormatter={formatDate} axisLine={false} tickLine={false} />
                    <YAxis stroke={axis} fontSize={11} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="content_count" name="Content" fill={CHART.views} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                  No publishing data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="top-performers">
          {analytics?.top_performers?.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {analytics.top_performers.slice(0, 6).map((content, idx) => (
                <Card key={content.id} className="overflow-hidden">
                  <div className="relative aspect-video bg-muted">
                    <img src={content.thumbnail || 'https://placehold.co/400x225'} alt="" className="h-full w-full object-cover" />
                    <div className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-xs font-bold text-foreground shadow">
                      {idx + 1}
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {(content.influencer_name || '?').charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">{content.influencer_name}</div>
                        <Badge variant="secondary" className="mt-0.5">{content.content_type}</Badge>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                      <div><div className="font-semibold text-foreground">{formatNumber(content.views)}</div><div className="text-muted-foreground">views</div></div>
                      <div><div className="font-semibold text-foreground">{formatNumber(content.likes)}</div><div className="text-muted-foreground">likes</div></div>
                      <div><div className="font-semibold text-foreground">{formatNumber(content.comments)}</div><div className="text-muted-foreground">comm.</div></div>
                      <div><div className="font-semibold text-foreground">{content.engagement_rate}%</div><div className="text-muted-foreground">eng.</div></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState text="No content data available" />
          )}
        </TabsContent>

        <TabsContent value="influencers" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Influencers ({influencers.length})</h3>
            {isCampaignExecutor() && (
              <Button size="sm" onClick={openAddInfluencer}>
                <Plus className="h-4 w-4" />
                Add influencer
              </Button>
            )}
          </div>

          {influencers.length > 0 ? (
            <div className="space-y-3">
              {influencers.map((inf) => {
                const links = inf.content_links || []
                const eng = inf.total_views > 0
                  ? ((inf.total_likes + inf.total_comments) / inf.total_views * 100).toFixed(2)
                  : '0.00'
                return (
                  <Card key={inf.assignment_id || inf.id}>
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                            {(inf.name || 'U').charAt(0)}
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{inf.name || 'Unknown'}</div>
                            <Badge variant="secondary" className="mt-0.5">{inf.platform || 'N/A'}</Badge>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>{formatNumber(inf.followers || 0)} followers</span>
                          <span>{links.length} posts</span>
                          <span>{formatNumber(inf.total_views || 0)} views</span>
                          <span>{eng}% eng.</span>
                          {editingAmountFor === inf.assignment_id ? (
                            <span className="inline-flex items-center gap-1">
                              <div className="relative">
                                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                                <Input type="number" value={amountValue} onChange={(e) => setAmountValue(e.target.value)} className="h-7 w-24 pl-5" autoFocus />
                              </div>
                              <Button size="sm" className="h-7" onClick={() => handleSaveAmount(inf.assignment_id)}>Save</Button>
                              <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingAmountFor(null)}>Cancel</Button>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <span className={inf.agreed_amount ? 'font-medium text-foreground' : ''}>{inf.agreed_amount ? `₹${formatNumber(inf.agreed_amount)}` : 'No amount'}</span>
                              {isCampaignExecutor() && (
                                <button type="button" className="text-muted-foreground hover:text-foreground" title="Edit agreed amount"
                                  onClick={() => { setEditingAmountFor(inf.assignment_id); setAmountValue(inf.agreed_amount || '') }}>
                                  <Pencil className="h-3 w-3" />
                                </button>
                              )}
                            </span>
                          )}
                          {isCampaignManager() && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleRemoveInfluencer(inf.assignment_id)} title="Remove">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 border-t pt-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">Content links ({links.length})</span>
                          {isCampaignExecutor() && addingContentFor !== inf.assignment_id && (
                            <Button variant="ghost" size="sm" className="h-7"
                              onClick={() => { setAddingContentFor(inf.assignment_id); setNewContentUrl(''); setNewContentType('Post') }}>
                              <Plus className="h-3.5 w-3.5" /> Add link
                            </Button>
                          )}
                        </div>

                        {addingContentFor === inf.assignment_id && (
                          <div className="mb-2 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Select value={newContentType} onValueChange={setNewContentType}>
                                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {(getPlatform(inf.platform)?.contentTypes || CONTENT_TYPES).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <Input type="url" value={newContentUrl} onChange={(e) => setNewContentUrl(e.target.value)}
                                placeholder={getPlatform(inf.platform)?.example || 'https://…'}
                                className={cn('flex-1 min-w-[180px]', !looksLikeValidPostUrl(inf.platform, newContentUrl) && 'border-destructive')} />
                              <Button size="sm" onClick={() => handleAddContent(inf.assignment_id)} disabled={!newContentUrl.trim() || !looksLikeValidPostUrl(inf.platform, newContentUrl)}>Add</Button>
                              <Button size="sm" variant="ghost" onClick={() => setAddingContentFor(null)}>Cancel</Button>
                            </div>
                            <p className="pl-1 text-xs text-muted-foreground">{getPlatform(inf.platform)?.hint}</p>
                          </div>
                        )}

                        {links.length > 0 ? (
                          <div className="space-y-1">
                            {links.map((content, ci) => (
                              <div key={content.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                                <span className="w-5 shrink-0 text-xs text-muted-foreground">{ci + 1}.</span>
                                <Badge variant="secondary" className="shrink-0">{content.content_type}</Badge>
                                {editingContentId === content.id ? (
                                  <div className="flex flex-1 items-center gap-2">
                                    <Input type="url" value={editContentUrl} onChange={(e) => setEditContentUrl(e.target.value)}
                                      className={cn('flex-1', !looksLikeValidPostUrl(content.platform, editContentUrl) && 'border-destructive')} />
                                    <Button size="sm" onClick={() => handleUpdateContent(content.id)} disabled={!editContentUrl.trim() || !looksLikeValidPostUrl(content.platform, editContentUrl)}>Save</Button>
                                    <Button size="sm" variant="ghost" onClick={() => setEditingContentId(null)}>Cancel</Button>
                                  </div>
                                ) : (
                                  <>
                                    <a href={content.url || '#'} target="_blank" rel="noopener noreferrer"
                                      className="flex flex-1 items-center gap-1 truncate text-primary hover:underline">
                                      <span className="truncate">{content.url || 'No URL'}</span>
                                      <ExternalLink className="h-3 w-3 shrink-0" />
                                    </a>
                                    {content.views > 0 && <span className="shrink-0 text-xs text-muted-foreground">{formatNumber(content.views)} views</span>}
                                    {isCampaignExecutor() && (
                                      <div className="flex shrink-0 gap-1">
                                        <Button variant="ghost" size="icon" className="h-7 w-7"
                                          onClick={() => { setEditingContentId(content.id); setEditContentUrl(content.url) }}>
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                                          onClick={() => handleDeleteContent(content.id)}>
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="py-1 text-xs text-muted-foreground">No content links added yet</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <EmptyState text="No influencers assigned to this campaign" />
          )}
        </TabsContent>

        <TabsContent value="content">
          {allContent.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {allContent.map((content) => (
                <Card key={content.id} className="overflow-hidden">
                  <div className="aspect-video bg-muted">
                    <img src={content.thumbnail || 'https://placehold.co/400x225'} alt="" className="h-full w-full object-cover" />
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{content.influencer_name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDate(content.published_at)}</span>
                    </div>
                    <Badge variant="secondary" className="mt-1">{content.content_type}</Badge>
                    <div className="mt-3 grid grid-cols-4 gap-1 text-center text-xs">
                      <div><div className="font-semibold text-foreground">{formatNumber(content.views)}</div><div className="text-muted-foreground">views</div></div>
                      <div><div className="font-semibold text-foreground">{formatNumber(content.likes)}</div><div className="text-muted-foreground">likes</div></div>
                      <div><div className="font-semibold text-foreground">{formatNumber(content.comments)}</div><div className="text-muted-foreground">comm.</div></div>
                      <div><div className="font-semibold text-foreground">{content.engagement_rate}%</div><div className="text-muted-foreground">eng.</div></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState text="No content available for this campaign" />
          )}
        </TabsContent>
      </Tabs>

      {/* Add influencer dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add influencer to campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Influencer</label>
              <Select value={selInfluencer} onValueChange={setSelInfluencer}>
                <SelectTrigger><SelectValue placeholder="Select influencer" /></SelectTrigger>
                <SelectContent>
                  {availableInfluencers.map((inf) => (
                    <SelectItem key={inf.id} value={String(inf.id)}>{inf.name} ({inf.tier || 'N/A'})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Platform</label>
              <Select value={selPlatform} onValueChange={setSelPlatform}>
                <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
                <SelectContent>
                  {PLATFORM_SPECS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Agreed amount <span className="font-normal text-muted-foreground">(optional)</span></label>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                <Input type="number" value={selAmount} onChange={(e) => setSelAmount(e.target.value)} placeholder="0" className="pl-7" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddInfluencer} disabled={addingInfluencer || !selInfluencer || !selPlatform}>
              {addingInfluencer && <Loader2 className="h-4 w-4 animate-spin" />}
              Add influencer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function EmptyState({ text }) {
  return (
    <Card>
      <CardContent className="py-14 text-center text-sm text-muted-foreground">{text}</CardContent>
    </Card>
  )
}
