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
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu'

export default function BrandForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { isManager } = useAuth()
  const isEditMode = Boolean(id)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState('')
  const [availableCategories, setAvailableCategories] = useState([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([])
  const [form, setForm] = useState({ name: '', description: '', status: 'active' })

  useEffect(() => {
    if (!isManager()) { navigate('/brands'); return }
    axios.get('/categories').then((res) => setAvailableCategories(res.data || [])).catch(() => {})
    if (isEditMode) fetchBrand()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const fetchBrand = async () => {
    try {
      setLoading(true)
      const b = (await axios.get(`/brands/${id}`)).data
      setForm({ name: b.name || '', description: b.description || '', status: b.status || 'active' })
      setSelectedCategoryIds(b.category_ids || [])
      setError(null)
    } catch {
      setError('Failed to load brand data')
    } finally {
      setLoading(false)
    }
  }

  const set = (name, value) => setForm((p) => ({ ...p, [name]: value }))
  const toggleCat = (catId, checked) =>
    setSelectedCategoryIds((prev) => (checked ? [...prev, catId] : prev.filter((x) => x !== catId)))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.name.trim()) { setError('Name is required'); return }
    try {
      setSaving(true)
      const payload = { name: form.name, description: form.description, status: form.status || 'active', category_ids: selectedCategoryIds }
      if (isEditMode) await axios.put(`/brands/${id}`, payload)
      else await axios.post('/brands', payload)
      setSuccess(isEditMode ? 'Brand updated! Redirecting…' : 'Brand created! Redirecting…')
      setTimeout(() => navigate('/brands'), 1200)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save brand')
      setSaving(false)
    }
  }

  if (loading && isEditMode && !form.name) {
    return <div className="space-y-4"><div className="h-8 w-40 animate-pulse rounded bg-muted" /><div className="h-64 w-full animate-pulse rounded-lg bg-muted" /></div>
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground" onClick={() => navigate('/brands')}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <PageHeader
        title={isEditMode ? 'Edit brand' : 'Add brand'}
        description={isEditMode ? 'Update brand information.' : 'Add a new brand to your master list.'}
        breadcrumb={[{ label: 'Brands' }, { label: isEditMode ? 'Edit' : 'New' }]}
      />

      {error && <Alert variant="destructive" className="mb-5"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert variant="success" className="mb-5"><Check className="h-4 w-4" /><AlertDescription>{success}</AlertDescription></Alert>}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader><CardTitle>Brand information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Enter brand name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={form.description} onChange={(e) => set('description', e.target.value)} rows={4} placeholder="Brief description about the brand…" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => set('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Categories</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between font-normal">
                      {selectedCategoryIds.length ? `${selectedCategoryIds.length} selected` : 'Select categories…'}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="max-h-64 w-[--radix-dropdown-menu-trigger-width] overflow-y-auto">
                    {availableCategories.map((cat) => (
                      <DropdownMenuCheckboxItem
                        key={cat.id}
                        checked={selectedCategoryIds.includes(cat.id)}
                        onCheckedChange={(c) => toggleCat(cat.id, c)}
                        onSelect={(e) => e.preventDefault()}
                      >
                        {cat.name}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {selectedCategoryIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedCategoryIds.map((cid) => {
                  const cat = availableCategories.find((c) => c.id === cid)
                  return cat ? (
                    <Badge key={cid} variant="secondary" className="gap-1">
                      {cat.name}
                      <button type="button" onClick={() => toggleCat(cid, false)} className="hover:text-foreground"><X className="h-3 w-3" /></button>
                    </Badge>
                  ) : null
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/brands')} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving || !!success}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving…' : isEditMode ? 'Update brand' : 'Create brand'}
          </Button>
        </div>
      </form>
    </>
  )
}
