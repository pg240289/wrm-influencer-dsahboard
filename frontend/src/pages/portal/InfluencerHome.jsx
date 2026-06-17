import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Megaphone, Users, Heart, Eye, ExternalLink, RefreshCw, Link2, Check, X, ChevronRight, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { formatNumber } from '@/components/charts'
import { StatCard } from '@/components/StatCard'
import { StatusBadge } from '@/components/StatusBadge'
import { FadeIn, Stagger, StaggerItem } from '@/components/motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const TIER_VARIANT = { Mega: 'default', Macro: 'info', Micro: 'success', Nano: 'secondary' }
const SOCIAL = [
  { label: 'Instagram', handle: 'instagram_handle', url: 'instagram_url', key: 'instagram', connectable: true },
  { label: 'YouTube', handle: 'youtube_handle', url: 'youtube_url', key: 'youtube', connectable: false },
  { label: 'Facebook', handle: 'facebook_handle', url: 'facebook_url', key: 'facebook', connectable: true },
  { label: 'Twitter / X', handle: 'twitter_handle', url: 'twitter_url', key: 'twitter', connectable: false },
  { label: 'LinkedIn', handle: 'linkedin_handle', url: 'linkedin_url', key: 'linkedin', connectable: false },
]

export default function InfluencerHome() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const confirm = useConfirm()
  const [searchParams, setSearchParams] = useSearchParams()

  const [profile, setProfile] = useState(null)
  const [campaigns, setCampaigns] = useState([])
  const [socialAccounts, setSocialAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editing, setEditing] = useState(false)
  const [connecting, setConnecting] = useState(null)
  const [form, setForm] = useState({})

  const [countries, setCountries] = useState([])
  const [states, setStates] = useState([])
  const [cities, setCities] = useState([])

  const flashOk = (m) => { setSuccess(m); setTimeout(() => setSuccess(''), 3000) }

  useEffect(() => {
    fetchData()
    fetchSocial()
    axios.get('/countries').then((r) => setCountries(r.data || [])).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const ok = searchParams.get('oauth_success')
    const err = searchParams.get('oauth_error')
    if (ok) { flashOk(`${ok.charAt(0).toUpperCase() + ok.slice(1)} connected successfully!`); setSearchParams({}); fetchSocial(); fetchData() }
    if (err) { setError(`OAuth error: ${err.replace(/_/g, ' ')}`); setSearchParams({}) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [p, c] = await Promise.all([axios.get('/influencer/me'), axios.get('/influencer/me/campaigns')])
      const prof = p.data
      setProfile(prof)
      setCampaigns(c.data || [])
      setForm({
        bio: prof.bio || '', phone: prof.phone || '', profile_pic: prof.profile_pic || '',
        country_id: prof.country_id || '', state_id: prof.state_id || '', city_id: prof.city_id || '',
        instagram_handle: prof.instagram_handle || '', instagram_url: prof.instagram_url || '',
        youtube_handle: prof.youtube_handle || '', youtube_url: prof.youtube_url || '',
        facebook_handle: prof.facebook_handle || '', facebook_url: prof.facebook_url || '',
        twitter_handle: prof.twitter_handle || '', twitter_url: prof.twitter_url || '',
        linkedin_handle: prof.linkedin_handle || '', linkedin_url: prof.linkedin_url || '',
      })
      if (prof.country_id) {
        setStates((await axios.get(`/states?country_id=${prof.country_id}`)).data)
        if (prof.state_id) setCities((await axios.get(`/cities?state_id=${prof.state_id}`)).data)
      }
    } catch {
      setError('Failed to load data')
    }
    setLoading(false)
  }

  const fetchSocial = async () => {
    try { setSocialAccounts((await axios.get('/influencer/me/social-accounts')).data || []) } catch { /* ignore */ }
  }

  const onCountry = async (v) => {
    const id = v ? parseInt(v) : ''
    setForm((p) => ({ ...p, country_id: id, state_id: '', city_id: '' }))
    setCities([]); setStates(id ? (await axios.get(`/states?country_id=${id}`)).data : [])
  }
  const onState = async (v) => {
    const id = v ? parseInt(v) : ''
    setForm((p) => ({ ...p, state_id: id, city_id: '' }))
    setCities(id ? (await axios.get(`/cities?state_id=${id}`)).data : [])
  }
  const onField = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }))

  const saveProfile = async () => {
    try {
      const res = await axios.put('/influencer/me', form)
      setProfile(res.data)
      setEditing(false)
      flashOk('Profile updated successfully')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile')
    }
  }

  const connectSocial = async (platform) => {
    setConnecting(platform)
    try {
      const res = await axios.post(`/auth/${platform}/connect`)
      window.location.href = res.data.auth_url
    } catch (err) {
      setError(err.response?.data?.error || `Failed to connect ${platform}`)
      setConnecting(null)
    }
  }
  const disconnectSocial = async (accountId, platform) => {
    if (!(await confirm({ title: `Disconnect ${platform}?`, description: 'You can reconnect anytime to resume syncing your stats.', confirmText: 'Disconnect', destructive: true }))) return
    try {
      await axios.delete(`/influencer/me/social-accounts/${accountId}`)
      setSocialAccounts((p) => p.filter((a) => a.id !== accountId))
      flashOk(`${platform} disconnected`)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to disconnect')
    }
  }
  const refreshStats = async (platform) => {
    try { await axios.post(`/influencer/me/refresh-${platform}-stats`); flashOk(`${platform} stats refreshed`); fetchData() }
    catch (err) { setError(err.response?.data?.error || `Failed to refresh ${platform} stats`) }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-lg" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  // Group assignments by campaign id
  const grouped = {}
  campaigns.forEach((c) => {
    if (!grouped[c.id]) grouped[c.id] = { ...c, assignments: [] }
    if (c.assignment) grouped[c.id].assignments.push(c.assignment)
  })
  const uniqueCampaigns = Object.values(grouped)

  const stats = [
    { label: 'Campaigns', value: String(uniqueCampaigns.length), icon: Megaphone, tone: 'primary' },
    { label: 'Instagram', value: formatNumber(profile?.instagram_followers), icon: Heart, tone: 'destructive' },
    { label: 'YouTube', value: formatNumber(profile?.youtube_subscribers), icon: Eye, tone: 'warning' },
    { label: 'Facebook', value: formatNumber(profile?.facebook_followers), icon: Users, tone: 'info' },
  ]

  return (
    <>
      {error && <Alert variant="destructive" className="mb-4"><X className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert variant="success" className="mb-4"><Check className="h-4 w-4" /><AlertDescription>{success}</AlertDescription></Alert>}

      {/* Profile header */}
      <FadeIn>
        <Card className="mb-6">
          <CardContent className="flex flex-wrap items-center gap-4 p-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xl font-semibold text-primary">
              {profile?.profile_pic ? <img src={profile.profile_pic} alt="" className="h-full w-full object-cover" /> : (profile?.name || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">{profile?.name || 'Influencer'}</h1>
                {profile?.tier && <Badge variant={TIER_VARIANT[profile.tier] || 'secondary'}>{profile.tier}</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Stats */}
      <Stagger className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => <StaggerItem key={s.label}><StatCard {...s} /></StaggerItem>)}
      </Stagger>

      <Tabs defaultValue="campaigns">
        <TabsList>
          <TabsTrigger value="campaigns">My campaigns</TabsTrigger>
          <TabsTrigger value="profile">My profile</TabsTrigger>
        </TabsList>

        {/* Campaigns */}
        <TabsContent value="campaigns">
          {uniqueCampaigns.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"><Megaphone className="h-6 w-6 text-muted-foreground" /></div>
              <p className="text-sm font-medium text-foreground">No campaigns assigned yet</p>
              <p className="text-sm text-muted-foreground">You'll see campaigns here once a manager assigns you.</p>
            </CardContent></Card>
          ) : (
            <Stagger className="grid gap-4 md:grid-cols-2">
              {uniqueCampaigns.map((c) => (
                <StaggerItem key={c.id}>
                  <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => navigate(`/influencer/campaign/${c.id}`)}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground">{c.campaign_name}</h3>
                          <p className="text-sm text-muted-foreground">{c.brand_name}</p>
                        </div>
                        <StatusBadge status={c.status} />
                      </div>
                      {c.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Platform: <strong className="text-foreground">{c.assignments.map((a) => a.platform).join(', ') || 'N/A'}</strong></span>
                        <span>Start: <strong className="text-foreground">{c.start_date}</strong></span>
                      </div>
                      <div className="mt-3 flex items-center gap-1 text-sm font-medium text-primary">View details <ChevronRight className="h-4 w-4" /></div>
                    </CardContent>
                  </Card>
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </TabsContent>

        {/* Profile */}
        <TabsContent value="profile" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">My profile</h2>
            {editing ? (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setEditing(false); fetchData() }}>Cancel</Button>
                <Button size="sm" onClick={saveProfile}>Save changes</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit profile</Button>
            )}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm">Basic info</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" value={profile?.name} />
              <Field label="Email" value={profile?.email} />
              <div className="space-y-2">
                <Label>Phone</Label>
                {editing ? <Input name="phone" value={form.phone} onChange={onField} /> : <p className="text-sm text-foreground">{profile?.phone || '—'}</p>}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Bio</Label>
                {editing ? <Textarea name="bio" value={form.bio} onChange={onField} rows={3} /> : <p className="text-sm text-foreground">{profile?.bio || '—'}</p>}
              </div>
              {editing && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Profile picture URL</Label>
                  <Input name="profile_pic" value={form.profile_pic} onChange={onField} placeholder="https://…" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Location</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Country</Label>
                {editing ? (
                  <Select value={form.country_id ? String(form.country_id) : ''} onValueChange={onCountry}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{countries.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                ) : <p className="text-sm text-foreground">{profile?.country || '—'}</p>}
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                {editing ? (
                  <Select value={form.state_id ? String(form.state_id) : ''} onValueChange={onState} disabled={!form.country_id}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{states.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                ) : <p className="text-sm text-foreground">{profile?.state || '—'}</p>}
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                {editing ? (
                  <Select value={form.city_id ? String(form.city_id) : ''} onValueChange={(v) => setForm((p) => ({ ...p, city_id: v ? parseInt(v) : '' }))} disabled={!form.state_id}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{cities.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                ) : <p className="text-sm text-foreground">{profile?.city || '—'}</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Social platforms</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {SOCIAL.map((s) => {
                const connected = socialAccounts.find((a) => a.platform === s.key)
                return (
                  <div key={s.key} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{s.label}</span>
                      {s.connectable && !editing && (
                        connected ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="success" className="gap-1"><Check className="h-3 w-3" /> Connected{connected.platform_username ? ` · @${connected.platform_username}` : ''}</Badge>
                            <Button size="sm" variant="ghost" className="h-7" onClick={() => refreshStats(s.key)}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
                            <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive" onClick={() => disconnectSocial(connected.id, s.label)}>Disconnect</Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7" onClick={() => connectSocial(s.key)} disabled={connecting === s.key}>
                            {connecting === s.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                            Connect
                          </Button>
                        )
                      )}
                    </div>
                    {editing ? (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <Input name={s.handle} value={form[s.handle]} onChange={onField} placeholder="Handle" />
                        <Input name={s.url} value={form[s.url]} onChange={onField} placeholder="Profile URL" />
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{profile?.[s.handle] || '—'}</span>
                        {profile?.[s.url] && <a href={profile[s.url]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">View <ExternalLink className="h-3 w-3" /></a>}
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}

function Field({ label, value }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-sm text-foreground">{value || '—'}</p>
    </div>
  )
}
