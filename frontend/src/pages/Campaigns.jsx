import React, { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { Plus, Megaphone, Activity, Users, Layers } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/StatCard'
import { StatusBadge } from '@/components/StatusBadge'
import { FadeIn, Stagger, StaggerItem } from '@/components/motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTable } from '@/components/ui/data-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const COLUMNS = [
  {
    accessorKey: 'campaign_name',
    header: 'Campaign',
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
          {(row.original.campaign_name || '?').charAt(0).toUpperCase()}
        </div>
        <span className="font-medium text-foreground">{row.original.campaign_name}</span>
      </div>
    ),
  },
  { accessorKey: 'brand_name', header: 'Brand', cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() || '—'}</span> },
  { accessorKey: 'objective', header: 'Objective', cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() || '—'}</span> },
  {
    accessorKey: 'num_influencers', header: 'Influencers',
    meta: { headClassName: 'text-center', cellClassName: 'text-center tabular-nums' },
    cell: ({ getValue }) => getValue() || 0,
  },
  {
    accessorKey: 'total_content', header: 'Content',
    meta: { headClassName: 'text-center', cellClassName: 'text-center tabular-nums' },
    cell: ({ getValue }) => getValue() || 0,
  },
  { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge status={getValue()} /> },
  { accessorKey: 'start_date', header: 'Start', cell: ({ getValue }) => <span className="whitespace-nowrap text-muted-foreground">{getValue() || '—'}</span> },
  { accessorKey: 'end_date', header: 'End', cell: ({ getValue }) => <span className="whitespace-nowrap text-muted-foreground">{getValue() || '—'}</span> },
]

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const navigate = useNavigate()
  const { isManager } = useAuth()

  useEffect(() => {
    let active = true
    axios
      .get('/campaigns')
      .then((res) => active && (setCampaigns(res.data || []), setLoading(false)))
      .catch(() => active && (setError('Failed to fetch campaigns'), setLoading(false)))
    return () => {
      active = false
    }
  }, [])

  const statusOptions = useMemo(() => ['all', ...new Set(campaigns.map((c) => c.status).filter(Boolean))], [campaigns])
  const filtered = useMemo(
    () => (statusFilter === 'all' ? campaigns : campaigns.filter((c) => c.status === statusFilter)),
    [campaigns, statusFilter]
  )

  const stats = [
    { label: 'Total campaigns', value: campaigns.length, icon: Megaphone, tone: 'primary' },
    { label: 'Active', value: campaigns.filter((c) => c.status === 'active').length, icon: Activity, tone: 'success' },
    { label: 'Influencers', value: campaigns.reduce((s, c) => s + (c.num_influencers || 0), 0), icon: Users, tone: 'info' },
    { label: 'Content pieces', value: campaigns.reduce((s, c) => s + (c.total_content || 0), 0), icon: Layers, tone: 'warning' },
  ]

  return (
    <>
      <FadeIn>
        <PageHeader
          title="Campaigns"
          description="Plan, track and measure your influencer campaigns."
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

      {error ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : (
        <>
          {loading ? (
            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[116px] rounded-lg" />)}
            </div>
          ) : (
            <Stagger className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((s) => (
                <StaggerItem key={s.label}><StatCard {...s} /></StaggerItem>
              ))}
            </Stagger>
          )}

          <FadeIn delay={0.05}>
            <Card className="overflow-hidden">
              {loading ? (
                <div className="space-y-2 p-6">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                <DataTable
                  columns={COLUMNS}
                  data={filtered}
                  searchPlaceholder="Search campaigns or brands…"
                  onRowClick={(c) => navigate(`/campaign/${c.id}`)}
                  emptyMessage="No campaigns found."
                  toolbar={
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">
                            {s === 'all' ? 'All statuses' : s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  }
                />
              )}
            </Card>
          </FadeIn>
        </>
      )}
    </>
  )
}
