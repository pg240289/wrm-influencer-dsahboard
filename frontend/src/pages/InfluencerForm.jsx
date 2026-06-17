import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, AlertCircle, Check, Loader2, ChevronDown, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu'

const CURRENCY_SYMBOL = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }

const PLATFORM_FIELDS = [
  { name: 'Instagram', handle: 'instagram_handle', handleLabel: 'Handle', followers: 'instagram_followers', followersLabel: 'Followers', url: 'instagram_url' },
  { name: 'YouTube', handle: 'youtube_handle', handleLabel: 'Channel name', followers: 'youtube_subscribers', followersLabel: 'Subscribers', url: 'youtube_url' },
  { name: 'Facebook', handle: 'facebook_handle', handleLabel: 'Page name', followers: 'facebook_followers', followersLabel: 'Followers', url: 'facebook_url' },
  { name: 'LinkedIn', handle: 'linkedin_handle', handleLabel: 'Profile name', followers: 'linkedin_followers', followersLabel: 'Followers', url: 'linkedin_url' },
  { name: 'Twitter / X', handle: 'twitter_handle', handleLabel: 'Handle', followers: 'twitter_followers', followersLabel: 'Followers', url: 'twitter_url' },
]

const RATE_GROUPS = [
  { platform: 'Instagram', rates: [['rate_per_post_instagram', 'Post'], ['rate_per_reel_instagram', 'Reel'], ['rate_per_story_instagram', 'Story']] },
  { platform: 'YouTube', rates: [['rate_per_video_youtube', 'Video'], ['rate_per_short_youtube', 'Short']] },
  { platform: 'Facebook', rates: [['rate_per_post_facebook', 'Post'], ['rate_per_reel_facebook', 'Reel'], ['rate_per_story_facebook', 'Story']] },
  { platform: 'LinkedIn', rates: [['rate_per_post_linkedin', 'Post']] },
]

const EMPTY = {
  name: '', email: '', phone: '', profile_pic: '', bio: '', status: 'active', currency: 'INR',
  instagram_handle: '', instagram_followers: '', instagram_url: '',
  youtube_handle: '', youtube_subscribers: '', youtube_url: '',
  facebook_handle: '', facebook_followers: '', facebook_url: '',
  linkedin_handle: '', linkedin_followers: '', linkedin_url: '',
  twitter_handle: '', twitter_followers: '', twitter_url: '',
  rate_per_post_instagram: '', rate_per_reel_instagram: '', rate_per_story_instagram: '',
  rate_per_video_youtube: '', rate_per_short_youtube: '',
  rate_per_post_facebook: '', rate_per_reel_facebook: '', rate_per_story_facebook: '',
  rate_per_post_linkedin: '',
  past_brands: '', worked_with_wrm: false, wrm_notes: '',
}

export default function InfluencerForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { isManager } = useAuth()
  const isEditMode = Boolean(id)

  const [tab, setTab] = useState('profile')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState(EMPTY)
  const [availableCategories, setAvailableCategories] = useState([])
  const [selectedCategories, setSelectedCategories] = useState([])

  const [countries, setCountries] = useState([])
  const [states, setStates] = useState([])
  const [cities, setCities] = useState([])
  const [countryId, setCountryId] = useState('')
  const [stateId, setStateId] = useState('')
  const [cityId, setCityId] = useState('')

  const currencySymbol = CURRENCY_SYMBOL[form.currency] || ''

  useEffect(() => {
    if (!isManager()) {
      navigate('/influencers')
      return
    }
    axios.get('/categories').then((res) => setAvailableCategories(res.data || [])).catch(() => {})
    axios.get('/countries').then((res) => setCountries(res.data || [])).catch(() => {})
    if (isEditMode) fetchInfluencer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Cascading location loaders for fresh selections (not initial edit-load)
  const loadStates = async (cid) => {
    if (!cid) return setStates([])
    try { setStates((await axios.get(`/states?country_id=${cid}`)).data) } catch { setStates([]) }
  }
  const loadCities = async (sid) => {
    if (!sid) return setCities([])
    try { setCities((await axios.get(`/cities?state_id=${sid}`)).data) } catch { setCities([]) }
  }

  const onCountryChange = (v) => {
    const cid = v ? parseInt(v) : ''
    setCountryId(cid); setStateId(''); setCityId(''); setCities([])
    loadStates(cid)
  }
  const onStateChange = (v) => {
    const sid = v ? parseInt(v) : ''
    setStateId(sid); setCityId('')
    loadCities(sid)
  }

  const fetchInfluencer = async () => {
    try {
      setLoading(true)
      const inf = (await axios.get(`/influencers/${id}`)).data
      setForm({
        name: inf.name || '', email: inf.email || '', phone: inf.phone || '', profile_pic: inf.profile_pic || '',
        bio: inf.bio || '', status: inf.status || 'active', currency: inf.currency || 'INR',
        instagram_handle: inf.instagram_handle || '', instagram_followers: inf.instagram_followers || '', instagram_url: inf.instagram_url || '',
        youtube_handle: inf.youtube_handle || '', youtube_subscribers: inf.youtube_subscribers || '', youtube_url: inf.youtube_url || '',
        facebook_handle: inf.facebook_handle || '', facebook_followers: inf.facebook_followers || '', facebook_url: inf.facebook_url || '',
        linkedin_handle: inf.linkedin_handle || '', linkedin_followers: inf.linkedin_followers || '', linkedin_url: inf.linkedin_url || '',
        twitter_handle: inf.twitter_handle || '', twitter_followers: inf.twitter_followers || '', twitter_url: inf.twitter_url || '',
        rate_per_post_instagram: inf.rate_per_post_instagram || '', rate_per_reel_instagram: inf.rate_per_reel_instagram || '', rate_per_story_instagram: inf.rate_per_story_instagram || '',
        rate_per_video_youtube: inf.rate_per_video_youtube || '', rate_per_short_youtube: inf.rate_per_short_youtube || '',
        rate_per_post_facebook: inf.rate_per_post_facebook || '', rate_per_reel_facebook: inf.rate_per_reel_facebook || '', rate_per_story_facebook: inf.rate_per_story_facebook || '',
        rate_per_post_linkedin: inf.rate_per_post_linkedin || '',
        past_brands: (inf.past_brands || []).join(', '), worked_with_wrm: inf.worked_with_wrm || false, wrm_notes: inf.wrm_notes || '',
      })
      setSelectedCategories(inf.categories || [])
      if (inf.country_id) {
        setCountryId(inf.country_id)
        setStates((await axios.get(`/states?country_id=${inf.country_id}`)).data)
        if (inf.state_id) {
          setStateId(inf.state_id)
          setCities((await axios.get(`/cities?state_id=${inf.state_id}`)).data)
          if (inf.city_id) setCityId(inf.city_id)
        }
      }
      setError(null)
    } catch {
      setError('Failed to load influencer data')
    } finally {
      setLoading(false)
    }
  }

  const set = (name, value) => setForm((prev) => ({ ...prev, [name]: value }))
  const onChange = (e) => set(e.target.name, e.target.value)

  const toggleCategory = (name, checked) =>
    setSelectedCategories((prev) => (checked ? [...prev, name] : prev.filter((c) => c !== name)))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.name.trim()) {
      setError('Name is required')
      setTab('profile')
      return
    }
    try {
      setSaving(true)
      const num = (v) => parseInt(v) || 0
      const rate = (v) => parseFloat(v) || null
      const payload = {
        name: form.name, email: form.email, phone: form.phone, profile_pic: form.profile_pic,
        bio: form.bio, status: form.status, currency: form.currency,
        instagram_handle: form.instagram_handle, instagram_url: form.instagram_url, instagram_followers: num(form.instagram_followers),
        youtube_handle: form.youtube_handle, youtube_url: form.youtube_url, youtube_subscribers: num(form.youtube_subscribers),
        facebook_handle: form.facebook_handle, facebook_url: form.facebook_url, facebook_followers: num(form.facebook_followers),
        linkedin_handle: form.linkedin_handle, linkedin_url: form.linkedin_url, linkedin_followers: num(form.linkedin_followers),
        twitter_handle: form.twitter_handle, twitter_url: form.twitter_url, twitter_followers: num(form.twitter_followers),
        rate_per_post_instagram: rate(form.rate_per_post_instagram), rate_per_reel_instagram: rate(form.rate_per_reel_instagram), rate_per_story_instagram: rate(form.rate_per_story_instagram),
        rate_per_video_youtube: rate(form.rate_per_video_youtube), rate_per_short_youtube: rate(form.rate_per_short_youtube),
        rate_per_post_facebook: rate(form.rate_per_post_facebook), rate_per_reel_facebook: rate(form.rate_per_reel_facebook), rate_per_story_facebook: rate(form.rate_per_story_facebook),
        rate_per_post_linkedin: rate(form.rate_per_post_linkedin),
        categories: selectedCategories,
        past_brands: form.past_brands.split(',').map((b) => b.trim()).filter(Boolean),
        worked_with_wrm: form.worked_with_wrm, wrm_notes: form.wrm_notes,
        country_id: countryId || null, state_id: stateId || null, city_id: cityId || null,
      }
      const res = isEditMode ? await axios.put(`/influencers/${id}`, payload) : await axios.post('/influencers', payload)
      const data = res.data
      let msg = 'Influencer saved successfully! Redirecting…'
      if (isEditMode) msg = 'Influencer updated! Redirecting…'
      else if (data.email_invited && data.email_sent) msg = 'Influencer created and invitation email sent! Redirecting…'
      else if (data.email_invited && !data.email_sent) msg = `Influencer created. ${data.invite_link ? 'Invite link: ' + data.invite_link : 'Email not configured.'}`
      else if (data.invite_message) msg = `${data.invite_message} Redirecting…`
      setSuccess(msg)
      setTimeout(() => navigate('/influencers'), data.invite_link ? 5000 : 1500)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save influencer')
      setSaving(false)
    }
  }

  if (loading && isEditMode) {
    return (
      <div className="space-y-4">
        <Skeletonish />
      </div>
    )
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground" onClick={() => navigate('/influencers')}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <PageHeader
        title={isEditMode ? 'Edit influencer' : 'Add influencer'}
        description={isEditMode ? 'Update influencer information.' : 'Add a new influencer to your master list.'}
        breadcrumb={[{ label: 'Influencers' }, { label: isEditMode ? 'Edit' : 'New' }]}
      />

      {error && (
        <Alert variant="destructive" className="mb-5"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
      )}
      {success && (
        <Alert variant="success" className="mb-5"><Check className="h-4 w-4" /><AlertDescription className="break-all">{success}</AlertDescription></Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="platforms">Social platforms</TabsTrigger>
            <TabsTrigger value="commercials">Commercials &amp; history</TabsTrigger>
          </TabsList>

          {/* PROFILE */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Basic information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xl font-semibold text-primary">
                    {form.profile_pic ? <img src={form.profile_pic} alt="" className="h-full w-full object-cover" /> : (form.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="profile_pic">Profile picture URL</Label>
                    <Input id="profile_pic" name="profile_pic" type="url" value={form.profile_pic} onChange={onChange} placeholder="https://example.com/photo.jpg" />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input id="name" name="name" value={form.name} onChange={onChange} placeholder="Influencer name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" value={form.email} onChange={onChange} placeholder="email@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" name="phone" value={form.phone} onChange={onChange} placeholder="+91 98765 43210" />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => set('status', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="blacklisted">Blacklisted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea id="bio" name="bio" value={form.bio} onChange={onChange} rows={3} placeholder="Brief description about the influencer…" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Categories</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" className="w-full justify-between font-normal">
                          {selectedCategories.length ? `${selectedCategories.length} selected` : 'Select categories…'}
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="max-h-64 w-[--radix-dropdown-menu-trigger-width] overflow-y-auto">
                        {availableCategories.map((cat) => (
                          <DropdownMenuCheckboxItem
                            key={cat.id}
                            checked={selectedCategories.includes(cat.name)}
                            onCheckedChange={(c) => toggleCategory(cat.name, c)}
                            onSelect={(e) => e.preventDefault()}
                          >
                            {cat.name}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {selectedCategories.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {selectedCategories.map((c) => (
                          <Badge key={c} variant="secondary" className="gap-1">
                            {c}
                            <button type="button" onClick={() => toggleCategory(c, false)} className="hover:text-foreground"><X className="h-3 w-3" /></button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Location</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Select value={countryId ? String(countryId) : ''} onValueChange={onCountryChange}>
                    <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                    <SelectContent>
                      {countries.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Select value={stateId ? String(stateId) : ''} onValueChange={onStateChange} disabled={!countryId}>
                    <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                    <SelectContent>
                      {states.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Select value={cityId ? String(cityId) : ''} onValueChange={(v) => setCityId(v ? parseInt(v) : '')} disabled={!stateId}>
                    <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                    <SelectContent>
                      {cities.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PLATFORMS */}
          <TabsContent value="platforms" className="space-y-4">
            <p className="text-sm text-muted-foreground">Add handles, follower counts and profile links. Tier is calculated automatically from the highest follower count.</p>
            {PLATFORM_FIELDS.map((p) => (
              <Card key={p.name}>
                <CardHeader className="pb-3"><CardTitle className="text-sm">{p.name}</CardTitle></CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label>{p.handleLabel}</Label>
                    <Input name={p.handle} value={form[p.handle]} onChange={onChange} placeholder="@username" />
                  </div>
                  <div className="space-y-2">
                    <Label>{p.followersLabel}</Label>
                    <Input name={p.followers} type="number" value={form[p.followers]} onChange={onChange} placeholder="0" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Profile URL</Label>
                    <Input name={p.url} type="url" value={form[p.url]} onChange={onChange} placeholder="https://…" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* COMMERCIALS */}
          <TabsContent value="commercials" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Rate card</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div className="w-40 space-y-2">
                  <Label>Currency</Label>
                  <Select value={form.currency} onValueChange={(v) => set('currency', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR (₹)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {RATE_GROUPS.map((g) => (
                  <div key={g.platform}>
                    <div className="mb-2 text-sm font-medium text-foreground">{g.platform}</div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      {g.rates.map(([field, label]) => (
                        <div key={field} className="space-y-2">
                          <Label>Rate per {label} ({currencySymbol})</Label>
                          <Input name={field} type="number" value={form[field]} onChange={onChange} placeholder="0" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Brand history</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="past_brands">Past brands</Label>
                  <Input id="past_brands" name="past_brands" value={form.past_brands} onChange={onChange} placeholder="Nike, Adidas, Puma (comma-separated)" />
                </div>
                <label className="flex w-fit cursor-pointer items-center gap-2">
                  <Checkbox checked={form.worked_with_wrm} onCheckedChange={(c) => set('worked_with_wrm', !!c)} />
                  <span className="text-sm font-medium">Worked with White Rivers Media</span>
                </label>
                {form.worked_with_wrm && (
                  <div className="space-y-2">
                    <Label htmlFor="wrm_notes">WRM notes</Label>
                    <Textarea id="wrm_notes" name="wrm_notes" value={form.wrm_notes} onChange={onChange} rows={3} placeholder="Internal notes about past collaborations…" />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/influencers')} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving || !!success}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving…' : isEditMode ? 'Update influencer' : 'Create influencer'}
          </Button>
        </div>
      </form>
    </>
  )
}

function Skeletonish() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
      <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />
    </div>
  )
}
