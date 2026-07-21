import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, AlertCircle, Plus, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PLATFORMS as PLATFORM_SPECS, CONTENT_TYPES, getPlatform, looksLikeValidPostUrl } from '@/lib/platforms'

const TIERS = ['Mega', 'Macro', 'Micro', 'Nano']
const OBJECTIVES = ['Brand Awareness', 'Product Launch', 'Engagement', 'Lead Generation', 'Sales Conversion', 'Content Creation']
const TIER_VARIANT = { Mega: 'default', Macro: 'info', Micro: 'success', Nano: 'secondary' }

const formatNumber = (num) => {
  if (!num) return '0'
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

const followersFor = (inf, platform) =>
  ({
    Instagram: inf.instagram_followers,
    YouTube: inf.youtube_subscribers,
    Facebook: inf.facebook_followers,
    'X (Twitter)': inf.twitter_followers,
    LinkedIn: inf.linkedin_followers,
  }[platform])

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
        active ? 'border-primary bg-primary/10 text-primary' : 'border-input text-muted-foreground hover:bg-accent'
      )}
    >
      {children}
    </button>
  )
}

export default function NewCampaign() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [users, setUsers] = useState([])
  const [brands, setBrands] = useState([])
  const [influencers, setInfluencers] = useState([])
  const [selectedInfluencers, setSelectedInfluencers] = useState([])
  const [selectedTiers, setSelectedTiers] = useState([])
  const [selectedPlatforms, setSelectedPlatforms] = useState([])

  const [formData, setFormData] = useState({
    campaign_name: '',
    objective: '',
    brand_id: '',
    description: '',
    status: 'active',
    start_date: '',
    end_date: '',
    assigned_user_ids: [],
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, brandsRes] = await Promise.all([axios.get('/users'), axios.get('/brands')])
        setUsers((usersRes.data || []).filter((u) => u.is_active))
        setBrands((brandsRes.data || []).filter((b) => b.status === 'active'))
      } catch {
        /* assignment data optional */
      }
    }
    fetchData()
  }, [])

  const fetchFilteredInfluencers = async (tiers, platforms) => {
    setSelectedInfluencers([])
    if (tiers.length === 0) {
      setInfluencers([])
      return
    }
    try {
      const params = { status: 'active', for_campaign: true, tier: tiers.join(',') }
      if (platforms.length > 0) params.platforms = platforms.join(',')
      const res = await axios.get('/influencers', { params })
      setInfluencers(res.data || [])
    } catch {
      setInfluencers([])
    }
  }

  const toggleTier = (tier) => {
    const next = selectedTiers.includes(tier) ? selectedTiers.filter((t) => t !== tier) : [...selectedTiers, tier]
    setSelectedTiers(next)
    fetchFilteredInfluencers(next, selectedPlatforms)
  }

  const togglePlatform = (platform) => {
    const next = selectedPlatforms.includes(platform)
      ? selectedPlatforms.filter((p) => p !== platform)
      : [...selectedPlatforms, platform]
    setSelectedPlatforms(next)
    fetchFilteredInfluencers(selectedTiers, next)
  }

  const setField = (name, value) => setFormData((prev) => ({ ...prev, [name]: value }))

  const toggleUser = (userId) =>
    setFormData((prev) => ({
      ...prev,
      assigned_user_ids: prev.assigned_user_ids.includes(userId)
        ? prev.assigned_user_ids.filter((id) => id !== userId)
        : [...prev.assigned_user_ids, userId],
    }))

  const isSelected = (influencerId, platform) =>
    selectedInfluencers.some((i) => i.influencer_id === influencerId && i.platform === platform)

  const toggleInfluencer = (influencerId, platform) =>
    setSelectedInfluencers((prev) => {
      const exists = prev.find((i) => i.influencer_id === influencerId && i.platform === platform)
      if (exists) return prev.filter((i) => !(i.influencer_id === influencerId && i.platform === platform))
      return [...prev, { influencer_id: influencerId, platform, content_links: [], agreed_amount: '' }]
    })

  const getLinks = (influencerId, platform) =>
    selectedInfluencers.find((i) => i.influencer_id === influencerId && i.platform === platform)?.content_links || []

  const getAgreed = (influencerId, platform) =>
    selectedInfluencers.find((i) => i.influencer_id === influencerId && i.platform === platform)?.agreed_amount ?? ''
  const setAgreed = (influencerId, platform, value) =>
    setSelectedInfluencers((prev) => prev.map((i) => (i.influencer_id === influencerId && i.platform === platform ? { ...i, agreed_amount: value } : i)))

  const mutateLinks = (influencerId, platform, fn) =>
    setSelectedInfluencers((prev) =>
      prev.map((i) =>
        i.influencer_id === influencerId && i.platform === platform ? { ...i, content_links: fn(i.content_links) } : i
      )
    )

  const addLink = (id, p) => mutateLinks(id, p, (links) => [...links, { content_type: 'Post', url: '' }])
  const updateLink = (id, p, idx, field, value) =>
    mutateLinks(id, p, (links) => links.map((l, i) => (i === idx ? { ...l, [field]: value } : l)))
  const removeLink = (id, p, idx) => mutateLinks(id, p, (links) => links.filter((_, i) => i !== idx))

  const platformsForInfluencer = (inf) => {
    const all = PLATFORM_SPECS.map((p) => p.value).filter((p) => (followersFor(inf, p) || 0) > 0)
    return selectedPlatforms.length > 0 ? all.filter((p) => selectedPlatforms.includes(p)) : all
  }

  const validate = () => {
    if (!formData.campaign_name.trim()) return 'Campaign name is required'
    if (!formData.objective.trim()) return 'Objective is required'
    if (!formData.brand_id) return 'Brand is required'
    if (!formData.start_date) return 'Start date is required'
    if (formData.end_date && formData.start_date > formData.end_date) return 'End date must be after start date'
    for (const inf of selectedInfluencers) {
      for (const cl of inf.content_links) {
        if (cl.url && cl.url.trim() && !looksLikeValidPostUrl(inf.platform, cl.url)) {
          return 'One or more content links are not valid for their platform. Fix the highlighted URLs.'
        }
      }
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setLoading(true)
    try {
      const payload = {
        campaign_name: formData.campaign_name,
        objective: formData.objective,
        brand_id: parseInt(formData.brand_id),
        description: formData.description,
        status: formData.status,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
      }
      if (formData.assigned_user_ids.length > 0) payload.assigned_user_ids = formData.assigned_user_ids
      if (selectedInfluencers.length > 0) payload.influencer_assignments = selectedInfluencers.map((i) => ({ ...i, agreed_amount: parseFloat(i.agreed_amount) || null }))
      const res = await axios.post('/campaigns', payload)
      navigate(`/campaign/${res.data.id}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create campaign. Please try again.')
      setLoading(false)
    }
  }

  const totalLinks = selectedInfluencers.reduce((s, i) => s + i.content_links.length, 0)

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground" onClick={() => navigate('/campaigns')}>
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <PageHeader
        title="Create campaign"
        description="Set up a new influencer marketing campaign."
        breadcrumb={[{ label: 'Campaigns' }, { label: 'New campaign' }]}
      />

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic information</CardTitle>
            <CardDescription>The core details about your campaign.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="campaign_name">Campaign name *</Label>
              <Input id="campaign_name" value={formData.campaign_name}
                onChange={(e) => setField('campaign_name', e.target.value)}
                placeholder="e.g., Summer Product Launch 2026" required />
            </div>
            <div className="space-y-2">
              <Label>Brand *</Label>
              <Select value={formData.brand_id} onValueChange={(v) => setField('brand_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select brand…" /></SelectTrigger>
                <SelectContent>
                  {brands.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Objective *</Label>
              <Select value={formData.objective} onValueChange={(v) => setField('objective', v)}>
                <SelectTrigger><SelectValue placeholder="Select objective…" /></SelectTrigger>
                <SelectContent>
                  {OBJECTIVES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={formData.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Describe the campaign goals, target audience, and key messaging…" rows={4} />
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
            <CardDescription>Define when your campaign will run.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start date *</Label>
              <Input id="start_date" type="date" value={formData.start_date}
                onChange={(e) => setField('start_date', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End date</Label>
              <Input id="end_date" type="date" value={formData.end_date} min={formData.start_date}
                onChange={(e) => setField('end_date', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Status *</Label>
              <Select value={formData.status} onValueChange={(v) => setField('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Team members */}
        {users.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Assign team members</CardTitle>
              <CardDescription>Select who can access this campaign (you're assigned automatically).</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {users.map((u) => {
                const checked = formData.assigned_user_ids.includes(u.id)
                return (
                  <label key={u.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                      checked ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'
                    )}>
                    <Checkbox checked={checked} onCheckedChange={() => toggleUser(u.id)} />
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {(u.first_name || u.username || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : u.username}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                    </div>
                  </label>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Influencers */}
        <Card>
          <CardHeader>
            <CardTitle>Select influencers <span className="font-normal text-muted-foreground">(optional)</span></CardTitle>
            <CardDescription>Pick influencer tiers and platforms, then choose who to assign.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label className="mb-2 block">Influencer level</Label>
                <div className="flex flex-wrap gap-2">
                  {TIERS.map((t) => (
                    <Chip key={t} active={selectedTiers.includes(t)} onClick={() => toggleTier(t)}>{t}</Chip>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Campaign platforms</Label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORM_SPECS.map((p) => (
                    <Chip key={p.value} active={selectedPlatforms.includes(p.value)} onClick={() => togglePlatform(p.value)}>{p.label}</Chip>
                  ))}
                </div>
              </div>
            </div>

            {selectedTiers.length > 0 && influencers.length === 0 && (
              <p className="text-sm text-muted-foreground">No active influencers found for the selected level(s).</p>
            )}

            {influencers.length > 0 && (
              <div className="grid gap-3 lg:grid-cols-2">
                {influencers.map((inf) => {
                  const platforms = platformsForInfluencer(inf)
                  if (platforms.length === 0) return null
                  return (
                    <div key={inf.id} className="rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {inf.profile_pic ? <img src={inf.profile_pic} alt="" className="h-full w-full object-cover" /> : (inf.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-foreground">{inf.name}</div>
                          {inf.tier && <Badge variant={TIER_VARIANT[inf.tier] || 'secondary'} className="mt-0.5">{inf.tier}</Badge>}
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        {platforms.map((platform) => {
                          const selected = isSelected(inf.id, platform)
                          const links = getLinks(inf.id, platform)
                          return (
                            <div key={platform} className="rounded-md border bg-muted/30 p-2.5">
                              <label className="flex cursor-pointer items-center gap-2">
                                <Checkbox checked={selected} onCheckedChange={() => toggleInfluencer(inf.id, platform)} />
                                <span className="text-sm font-medium text-foreground">{platform}</span>
                                <span className="ml-auto text-xs text-muted-foreground">{formatNumber(followersFor(inf, platform))} followers</span>
                              </label>

                              {selected && (
                                <div className="mt-2 space-y-2 pl-6">
                                  <div className="flex items-center gap-2">
                                    <span className="w-28 text-xs text-muted-foreground">Agreed amount</span>
                                    <div className="relative">
                                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                                      <Input type="number" value={getAgreed(inf.id, platform)} onChange={(e) => setAgreed(inf.id, platform, e.target.value)} placeholder="0" className="h-8 w-40 pl-6" />
                                    </div>
                                  </div>
                                  {links.map((cl, idx) => {
                                    const invalid = !looksLikeValidPostUrl(platform, cl.url)
                                    return (
                                    <div key={idx} className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <Select value={cl.content_type} onValueChange={(v) => updateLink(inf.id, platform, idx, 'content_type', v)}>
                                          <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            {(getPlatform(platform)?.contentTypes || CONTENT_TYPES).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                          </SelectContent>
                                        </Select>
                                        <Input type="url" value={cl.url} placeholder={getPlatform(platform)?.example || 'https://…'}
                                          className={cn('h-8 flex-1', invalid && 'border-destructive')}
                                          onChange={(e) => updateLink(inf.id, platform, idx, 'url', e.target.value)} />
                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                          onClick={() => removeLink(inf.id, platform, idx)}>
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                      <p className={cn('pl-1 text-xs', invalid ? 'text-destructive' : 'text-muted-foreground')}>{getPlatform(platform)?.hint}</p>
                                    </div>
                                    )
                                  })}
                                  <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => addLink(inf.id, platform)}>
                                    <Plus className="h-3.5 w-3.5" /> Add content link
                                  </Button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {selectedInfluencers.length > 0 && (
              <div className="rounded-md bg-primary/5 px-4 py-3 text-sm text-primary">
                {selectedInfluencers.length} influencer-platform combination(s) selected
                {totalLinks > 0 && ` with ${totalLinks} content link(s)`}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/campaigns')} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {loading ? 'Creating…' : 'Create campaign'}
          </Button>
        </div>
      </form>
    </>
  )
}
