import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, Plus, Pencil, Trash2, ExternalLink, Check, X, Layers, Eye, Heart, MessageCircle, Share2, TrendingUp } from 'lucide-react'
import { useConfirm } from '@/contexts/ConfirmContext'
import { MetricAreaChart, TimelineBarChart, formatNumber, formatDate } from '@/components/charts'
import { StatCard } from '@/components/StatCard'
import { StatusBadge } from '@/components/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const CONTENT_TYPES = ['Post', 'Reel', 'Story', 'Video', 'Short']
const CHART = { views: '#6366f1', likes: '#ec4899', comments: '#10b981' }

export default function InfluencerCampaign() {
  const { id } = useParams()
  const navigate = useNavigate()
  const confirm = useConfirm()

  const [campaign, setCampaign] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [viewsMode, setViewsMode] = useState('cumulative')
  const [likesMode, setLikesMode] = useState('cumulative')
  const [commentsMode, setCommentsMode] = useState('cumulative')

  const [addingFor, setAddingFor] = useState(null)
  const [newType, setNewType] = useState('Post')
  const [newUrl, setNewUrl] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editUrl, setEditUrl] = useState('')

  const flashOk = (m) => { setSuccess(m); setTimeout(() => setSuccess(''), 3000) }

  useEffect(() => { fetchData() /* eslint-disable-next-line */ }, [id])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [c, a] = await Promise.all([
        axios.get(`/influencer/me/campaign/${id}`),
        axios.get(`/influencer/me/campaign/${id}/analytics`),
      ])
      setCampaign(c.data)
      setAnalytics(a.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load campaign details')
    }
    setLoading(false)
  }

  const refreshAnalytics = () => axios.get(`/influencer/me/campaign/${id}/analytics`).then((r) => setAnalytics(r.data)).catch(() => {})

  const cumulative = (data, key) => {
    let t = 0
    return data.map((it) => { t += it[key] || 0; return { ...it, [key]: t } })
  }
  const chartData = (mode, key) => {
    const dm = analytics?.daily_metrics || []
    return mode === 'cumulative' ? cumulative(dm, key) : dm
  }

  const addContent = async (assignmentId) => {
    if (!newUrl.trim()) return
    try {
      const res = await axios.post(`/influencer/me/assignments/${assignmentId}/content`, { content_type: newType, url: newUrl.trim() })
      setCampaign((p) => ({ ...p, assignments: p.assignments.map((a) => a.id === assignmentId ? { ...a, content_links: [...(a.content_links || []), res.data] } : a) }))
      setNewType('Post'); setNewUrl(''); setAddingFor(null); flashOk('Content link added'); refreshAnalytics()
    } catch (err) { setError(err.response?.data?.error || 'Failed to add content link') }
  }
  const updateContent = async (assignmentId, contentId) => {
    if (!editUrl.trim()) return
    try {
      await axios.put(`/influencer/me/content/${contentId}`, { url: editUrl.trim() })
      setCampaign((p) => ({ ...p, assignments: p.assignments.map((a) => a.id === assignmentId ? { ...a, content_links: (a.content_links || []).map((cl) => cl.id === contentId ? { ...cl, url: editUrl.trim() } : cl) } : a) }))
      setEditingId(null); setEditUrl(''); flashOk('Content link updated')
    } catch (err) { setError(err.response?.data?.error || 'Failed to update content link') }
  }
  const deleteContent = async (assignmentId, contentId) => {
    if (!(await confirm({ title: 'Delete content link?', description: 'This permanently removes the link from this campaign.', confirmText: 'Delete', destructive: true }))) return
    try {
      await axios.delete(`/influencer/me/content/${contentId}`)
      setCampaign((p) => ({ ...p, assignments: p.assignments.map((a) => a.id === assignmentId ? { ...a, content_links: (a.content_links || []).filter((cl) => cl.id !== contentId) } : a) }))
      flashOk('Content link deleted'); refreshAnalytics()
    } catch (err) { setError(err.response?.data?.error || 'Failed to delete content link') }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  if (!campaign) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-muted-foreground">{error || 'Campaign not found'}</p>
          <Button onClick={() => navigate('/influencer/dashboard')}>Back to dashboard</Button>
        </CardContent>
      </Card>
    )
  }

  const assignments = campaign.assignments || []
  const stats = [
    { label: 'Content', value: String(campaign.my_total_content || 0), icon: Layers, tone: 'primary' },
    { label: 'Views', value: formatNumber(campaign.my_total_views), icon: Eye, tone: 'info' },
    { label: 'Likes', value: formatNumber(campaign.my_total_likes), icon: Heart, tone: 'destructive' },
    { label: 'Comments', value: formatNumber(campaign.my_total_comments), icon: MessageCircle, tone: 'success' },
    { label: 'Shares', value: formatNumber(campaign.my_total_shares), icon: Share2, tone: 'primary' },
    { label: 'Engagement', value: `${campaign.my_engagement_rate || 0}%`, icon: TrendingUp, tone: 'warning' },
  ]

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground" onClick={() => navigate('/influencer/dashboard')}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{campaign.campaign_name}</h1>
          <p className="text-sm text-muted-foreground">{campaign.brand_name}</p>
        </div>
        <StatusBadge status={campaign.status} />
      </div>

      {error && <Alert variant="destructive" className="mb-4"><X className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert variant="success" className="mb-4"><Check className="h-4 w-4" /><AlertDescription>{success}</AlertDescription></Alert>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      {campaign.description && (
        <Card className="mt-4"><CardContent className="py-3 text-sm text-muted-foreground">{campaign.description}</CardContent></Card>
      )}

      <Tabs defaultValue="performance" className="mt-6">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="content">My content</TabsTrigger>
          <TabsTrigger value="top">Top performers</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <MetricAreaChart id="ic-views" title="Views over time" data={chartData(viewsMode, 'views')} dataKey="views" color={CHART.views} mode={viewsMode} onMode={setViewsMode} height={300} />
          <div className="grid gap-4 lg:grid-cols-2">
            <MetricAreaChart id="ic-likes" title="Likes" data={chartData(likesMode, 'likes')} dataKey="likes" color={CHART.likes} mode={likesMode} onMode={setLikesMode} height={240} />
            <MetricAreaChart id="ic-comments" title="Comments" data={chartData(commentsMode, 'comments')} dataKey="comments" color={CHART.comments} mode={commentsMode} onMode={setCommentsMode} height={240} />
          </div>
          {(analytics?.daily_metrics?.length > 0) && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Publishing timeline</CardTitle></CardHeader>
              <CardContent><TimelineBarChart data={analytics.daily_metrics} /></CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="content" className="space-y-4">
          {assignments.map((a) => {
            const links = a.content_links || []
            return (
              <Card key={a.id}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{a.platform}</Badge>
                      <span className="text-sm font-medium text-foreground">Content links ({links.length})</span>
                    </div>
                    {addingFor !== a.id && (
                      <Button size="sm" onClick={() => { setAddingFor(a.id); setNewType('Post'); setNewUrl('') }}>
                        <Plus className="h-4 w-4" /> Add content
                      </Button>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{formatNumber(a.total_views || 0)} views</span>
                    <span>{formatNumber(a.total_likes || 0)} likes</span>
                    <span>{formatNumber(a.total_comments || 0)} comments</span>
                    <span>{formatNumber(a.followers || 0)} followers</span>
                    <span>Status: {a.status || 'pending'}</span>
                  </div>

                  {addingFor === a.id && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Select value={newType} onValueChange={setNewType}>
                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>{CONTENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input type="url" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://…" className="min-w-[180px] flex-1" />
                      <Button size="sm" onClick={() => addContent(a.id)} disabled={!newUrl.trim()}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setAddingFor(null)}>Cancel</Button>
                    </div>
                  )}

                  {links.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">No content links yet. Add your first published link above.</p>
                  ) : (
                    <div className="mt-3 space-y-1">
                      {links.map((cl) => (
                        <div key={cl.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                          <Badge variant="secondary" className="shrink-0">{cl.content_type}</Badge>
                          {editingId === cl.id ? (
                            <div className="flex flex-1 items-center gap-2">
                              <Input type="url" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} className="flex-1" />
                              <Button size="sm" onClick={() => updateContent(a.id, cl.id)}>Save</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                            </div>
                          ) : (
                            <>
                              <a href={cl.url || '#'} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center gap-1 truncate text-primary hover:underline">
                                <span className="truncate">{cl.url || 'No URL'}</span><ExternalLink className="h-3 w-3 shrink-0" />
                              </a>
                              <div className="hidden shrink-0 gap-2 text-xs text-muted-foreground sm:flex">
                                {(cl.views || 0) > 0 && <span>{formatNumber(cl.views)} views</span>}
                                {(cl.likes || 0) > 0 && <span>{formatNumber(cl.likes)} likes</span>}
                              </div>
                              <div className="flex shrink-0 gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingId(cl.id); setEditUrl(cl.url) }}><Pencil className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteContent(a.id, cl.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>

        <TabsContent value="top">
          {analytics?.top_performers?.length > 0 ? (
            <div className="space-y-3">
              {analytics.top_performers.map((content, idx) => (
                <Card key={content.id}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">#{idx + 1}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{content.platform}</Badge>
                        <span className="text-sm font-medium text-foreground">{content.content_type}</span>
                        {content.published_at && <span className="text-xs text-muted-foreground">{formatDate(content.published_at)}</span>}
                      </div>
                      {content.url && <a href={content.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 block truncate text-sm text-primary hover:underline">{content.url}</a>}
                    </div>
                    <div className="hidden shrink-0 gap-4 text-center text-xs sm:flex">
                      <div><div className="font-semibold text-foreground">{formatNumber(content.views)}</div><div className="text-muted-foreground">views</div></div>
                      <div><div className="font-semibold text-foreground">{formatNumber(content.likes)}</div><div className="text-muted-foreground">likes</div></div>
                      <div><div className="font-semibold text-foreground">{content.engagement_rate || 0}%</div><div className="text-muted-foreground">eng.</div></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card><CardContent className="py-14 text-center text-sm text-muted-foreground">No content performance data available yet</CardContent></Card>
          )}
        </TabsContent>
      </Tabs>
    </>
  )
}
