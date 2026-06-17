import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Plus, X, MapPin } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { FadeIn } from '@/components/motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DataTable } from '@/components/ui/data-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const TIER_VARIANT = { Mega: 'default', Macro: 'info', Micro: 'success', Nano: 'secondary' }
const TIERS = [
  { value: 'Mega', label: 'Mega (1M+)' },
  { value: 'Macro', label: 'Macro (100K–1M)' },
  { value: 'Micro', label: 'Micro (10K–100K)' },
  { value: 'Nano', label: 'Nano (<10K)' },
]
const SOCIALS = [
  { key: 'instagram_followers', label: 'IG', color: '#E4405F' },
  { key: 'youtube_subscribers', label: 'YT', color: '#FF0000' },
  { key: 'facebook_followers', label: 'FB', color: '#1877F2' },
  { key: 'twitter_followers', label: 'X', color: '#0F172A' },
  { key: 'linkedin_followers', label: 'IN', color: '#0A66C2' },
]

const formatNumber = (num) => {
  if (!num) return '0'
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return String(num)
}

const searchInfluencer = (row, _columnId, value) => {
  const q = String(value).toLowerCase()
  const i = row.original
  return [i.name, i.email, i.instagram_handle, i.youtube_handle].some((v) => v && v.toLowerCase().includes(q))
}

const COLUMNS = [
  {
    accessorKey: 'name',
    header: 'Influencer',
    cell: ({ row }) => {
      const i = row.original
      return (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {i.profile_pic ? <img src={i.profile_pic} alt="" className="h-full w-full object-cover" /> : (i.name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">{i.name}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {i.city || i.country || 'India'}
            </div>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: 'tier',
    header: 'Tier',
    cell: ({ getValue }) => (getValue() ? <Badge variant={TIER_VARIANT[getValue()] || 'secondary'}>{getValue()}</Badge> : <span className="text-muted-foreground">—</span>),
  },
  {
    accessorKey: 'max_followers',
    header: 'Reach',
    meta: { headClassName: 'text-right', cellClassName: 'text-right tabular-nums font-medium' },
    cell: ({ getValue }) => formatNumber(getValue() || 0),
  },
  {
    id: 'platforms',
    header: 'Platforms',
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {SOCIALS.filter((s) => (row.original[s.key] || 0) > 0).map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs">
            <span className="font-semibold" style={{ color: s.color }}>{s.label}</span>
            <span className="tabular-nums text-muted-foreground">{formatNumber(row.original[s.key])}</span>
          </span>
        ))}
      </div>
    ),
  },
  {
    accessorKey: 'worked_with_wrm',
    header: 'WRM',
    cell: ({ getValue }) => (getValue() ? <Badge variant="success">WRM</Badge> : <span className="text-muted-foreground">—</span>),
  },
  {
    id: 'invite',
    header: '',
    enableSorting: false,
    meta: { cellClassName: 'text-right' },
    cell: ({ row, table }) => {
      const i = row.original
      const m = table.options.meta
      if (!m?.canManage || !i.email) return null
      if (i.invite_status === 'accepted') return <Badge variant="success">Joined</Badge>
      const resend = i.invite_status === 'invited'
      return (
        <Button variant="outline" size="sm" className="h-7" onClick={(e) => { e.stopPropagation(); m.onInvite(i.id, resend) }}>
          {resend ? 'Resend' : 'Invite'}
        </Button>
      )
    },
  },
]

export default function Influencers() {
  const navigate = useNavigate()
  const { isManager, isCampaignManager } = useAuth()

  const [influencers, setInfluencers] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [inviteMsg, setInviteMsg] = useState(null)

  const [tier, setTier] = useState('all')
  const [category, setCategory] = useState('all')
  const [wrm, setWrm] = useState('all')

  useEffect(() => {
    axios.get('/categories').then((res) => setCategories((res.data || []).map((c) => c.name))).catch(() => {})
  }, [])

  const fetchInfluencers = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (tier !== 'all') params.append('tier', tier)
      if (category !== 'all') params.append('category', category)
      if (wrm !== 'all') params.append('worked_with_wrm', wrm)
      params.append('status', '')
      const res = await axios.get(`/influencers?${params.toString()}`)
      setInfluencers((res.data || []).sort((a, b) => (b.max_followers || 0) - (a.max_followers || 0)))
      setError(null)
    } catch {
      setError('Failed to load influencers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInfluencers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, category, wrm])

  const activeFilters = [tier, category, wrm].filter((v) => v !== 'all').length
  const clearFilters = () => { setTier('all'); setCategory('all'); setWrm('all') }

  const handleInvite = async (influencerId, isResend) => {
    try {
      const endpoint = isResend ? `/influencers/${influencerId}/resend-invite` : `/influencers/${influencerId}/invite`
      const res = await axios.post(endpoint)
      setInviteMsg({ type: 'success', text: res.data.email_sent ? res.data.message : `${res.data.warning} Link: ${res.data.invite_link}` })
      fetchInfluencers()
    } catch (err) {
      const d = err.response?.data
      if (d?.already_invited) {
        try {
          const res = await axios.post(`/influencers/${influencerId}/resend-invite`)
          setInviteMsg({ type: 'success', text: res.data.email_sent ? 'Invitation resent successfully' : `${res.data.warning} Link: ${res.data.invite_link}` })
        } catch (e2) {
          setInviteMsg({ type: 'error', text: e2.response?.data?.error || 'Failed to resend invite' })
        }
      } else {
        setInviteMsg({ type: 'error', text: d?.error || 'Failed to send invite' })
      }
    }
    setTimeout(() => setInviteMsg(null), 8000)
  }

  const canManage = isCampaignManager()
  const tableMeta = useMemo(() => ({ canManage, onInvite: handleInvite }), [canManage]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <FadeIn>
        <PageHeader
          title="Influencers"
          description="Browse, filter and manage your influencer master."
          actions={isManager() && (
            <Button onClick={() => navigate('/influencers/new')}>
              <Plus className="h-4 w-4" />
              Add influencer
            </Button>
          )}
        />
      </FadeIn>

      {inviteMsg && (
        <Alert variant={inviteMsg.type === 'success' ? 'success' : 'destructive'} className="mb-4">
          <AlertDescription className="break-all">{inviteMsg.text}</AlertDescription>
        </Alert>
      )}

      <FadeIn delay={0.05}>
        <Card className="overflow-hidden">
          {loading ? (
            <div className="space-y-2 p-6">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : error ? (
            <div className="py-10 text-center text-sm text-destructive">{error}</div>
          ) : (
            <DataTable
              columns={COLUMNS}
              data={influencers}
              meta={tableMeta}
              globalFilterFn={searchInfluencer}
              searchPlaceholder="Search name, email or handle…"
              onRowClick={canManage ? (i) => navigate(`/influencers/${i.id}/edit`) : undefined}
              emptyMessage="No influencers found."
              pageSize={12}
              toolbar={
                <>
                  <Select value={tier} onValueChange={setTier}>
                    <SelectTrigger className="w-36"><SelectValue placeholder="Tier" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All tiers</SelectItem>
                      {TIERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={wrm} onValueChange={setWrm}>
                    <SelectTrigger className="w-36"><SelectValue placeholder="History" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All history</SelectItem>
                      <SelectItem value="true">Worked with us</SelectItem>
                      <SelectItem value="false">New</SelectItem>
                    </SelectContent>
                  </Select>
                  {activeFilters > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}><X className="h-4 w-4" /> Clear</Button>
                  )}
                </>
              }
            />
          )}
        </Card>
      </FadeIn>
    </>
  )
}
