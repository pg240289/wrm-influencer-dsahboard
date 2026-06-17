import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Plus, Building2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { FadeIn } from '@/components/motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTable } from '@/components/ui/data-table'

const COLUMNS = [
  {
    accessorKey: 'name',
    header: 'Brand',
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
          {(row.original.name || '?').charAt(0).toUpperCase()}
        </div>
        <span className="font-medium text-foreground">{row.original.name}</span>
      </div>
    ),
  },
  {
    accessorKey: 'description',
    header: 'Description',
    enableSorting: false,
    cell: ({ getValue }) => <span className="line-clamp-1 text-muted-foreground">{getValue() || 'No description'}</span>,
  },
  {
    id: 'categories',
    header: 'Categories',
    enableSorting: false,
    cell: ({ row }) => {
      const cats = row.original.categories || []
      if (!cats.length) return <span className="text-muted-foreground">—</span>
      return (
        <div className="flex flex-wrap gap-1">
          {cats.slice(0, 3).map((c) => <Badge key={c.id} variant="secondary">{c.name}</Badge>)}
          {cats.length > 3 && <Badge variant="secondary">+{cats.length - 3}</Badge>}
        </div>
      )
    },
  },
  { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge status={getValue() || 'active'} /> },
]

export default function Brands() {
  const navigate = useNavigate()
  const { isManager } = useAuth()
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    axios
      .get('/brands')
      .then((res) => active && (setBrands(res.data || []), setLoading(false)))
      .catch(() => active && (setError('Failed to load brands'), setLoading(false)))
    return () => { active = false }
  }, [])

  return (
    <>
      <FadeIn>
        <PageHeader
          title="Brands"
          description="Manage the brands behind your campaigns."
          actions={isManager() && (
            <Button onClick={() => navigate('/brands/new')}>
              <Plus className="h-4 w-4" />
              Add brand
            </Button>
          )}
        />
      </FadeIn>

      <FadeIn delay={0.05}>
        <Card className="overflow-hidden">
          {loading ? (
            <div className="space-y-2 p-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : error ? (
            <div className="py-10 text-center text-sm text-destructive">{error}</div>
          ) : (
            <DataTable
              columns={COLUMNS}
              data={brands}
              searchPlaceholder="Search brands…"
              onRowClick={isManager() ? (b) => navigate(`/brands/${b.id}/edit`) : undefined}
              emptyMessage="No brands found."
            />
          )}
        </Card>
      </FadeIn>
    </>
  )
}
