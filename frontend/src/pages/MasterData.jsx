import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { FadeIn } from '@/components/motion'
import { StatusBadge } from '@/components/StatusBadge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

function StatusSelect({ value, onChange }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="active">Active</SelectItem>
        <SelectItem value="inactive">Inactive</SelectItem>
      </SelectContent>
    </Select>
  )
}

function MasterTable({ columns, rows, canEdit, onEdit, onDelete, emptyText }) {
  const colSpan = columns.length + 1 + (canEdit ? 1 : 0)
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-12">#</TableHead>
          {columns.map((c) => <TableHead key={c.header}>{c.header}</TableHead>)}
          {canEdit && <TableHead className="text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow className="hover:bg-transparent"><TableCell colSpan={colSpan} className="h-24 text-center text-sm text-muted-foreground">{emptyText}</TableCell></TableRow>
        ) : (
          rows.map((r, i) => (
            <TableRow key={r.id}>
              <TableCell className="text-muted-foreground">{i + 1}</TableCell>
              {columns.map((c) => <TableCell key={c.header}>{c.render(r)}</TableCell>)}
              {canEdit && (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

export default function MasterData() {
  const navigate = useNavigate()
  const { isManager } = useAuth()
  const confirm = useConfirm()
  const canEdit = isManager()

  const [tab, setTab] = useState('categories')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [categories, setCategories] = useState([])
  const [catForm, setCatForm] = useState({ name: '', description: '', status: 'active' })
  const [editingCatId, setEditingCatId] = useState(null)

  const [countries, setCountries] = useState([])
  const [countryForm, setCountryForm] = useState({ name: '', code: '', status: 'active' })
  const [editingCountryId, setEditingCountryId] = useState(null)

  const [states, setStates] = useState([])
  const [stateForm, setStateForm] = useState({ name: '', country_id: '', status: 'active' })
  const [editingStateId, setEditingStateId] = useState(null)
  const [stateCountryFilter, setStateCountryFilter] = useState('all')

  const [cities, setCities] = useState([])
  const [cityForm, setCityForm] = useState({ name: '', state_id: '', status: 'active' })
  const [editingCityId, setEditingCityId] = useState(null)
  const [cityCountryFilter, setCityCountryFilter] = useState('all')
  const [cityStateFilter, setCityStateFilter] = useState('all')
  const [cityStates, setCityStates] = useState([])

  const showSuccess = (m) => { setSuccess(m); setTimeout(() => setSuccess(''), 3000) }
  const showError = (m) => { setError(m); setTimeout(() => setError(''), 5000) }

  const fetchCategories = () => axios.get('/categories').then((r) => setCategories(r.data || [])).catch(() => {})
  const fetchCountries = () => axios.get('/countries').then((r) => setCountries(r.data || [])).catch(() => {})
  const fetchStates = () => {
    const q = stateCountryFilter !== 'all' ? `?country_id=${stateCountryFilter}` : ''
    return axios.get(`/states${q}`).then((r) => setStates(r.data || [])).catch(() => {})
  }
  const fetchCities = () => {
    const q = cityStateFilter !== 'all' ? `?state_id=${cityStateFilter}` : ''
    return axios.get(`/cities${q}`).then((r) => setCities(r.data || [])).catch(() => {})
  }

  useEffect(() => { fetchCountries(); fetchCategories() }, [])
  useEffect(() => {
    if (tab === 'states') fetchStates()
    if (tab === 'cities') fetchCities()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, stateCountryFilter, cityStateFilter])
  useEffect(() => {
    if (cityCountryFilter !== 'all') axios.get(`/states?country_id=${cityCountryFilter}`).then((r) => setCityStates(r.data || [])).catch(() => setCityStates([]))
    else setCityStates([])
    setCityStateFilter('all')
  }, [cityCountryFilter])

  // Generic save/delete
  const save = async (kind) => {
    const map = {
      category: { form: catForm, id: editingCatId, url: '/categories', required: catForm.name, reset: () => { setCatForm({ name: '', description: '', status: 'active' }); setEditingCatId(null) }, refetch: fetchCategories, label: 'Category' },
      country: { form: countryForm, id: editingCountryId, url: '/countries', required: countryForm.name, reset: () => { setCountryForm({ name: '', code: '', status: 'active' }); setEditingCountryId(null) }, refetch: fetchCountries, label: 'Country' },
      state: { form: stateForm, id: editingStateId, url: '/states', required: stateForm.name && stateForm.country_id, reset: () => { setStateForm({ name: '', country_id: '', status: 'active' }); setEditingStateId(null) }, refetch: fetchStates, label: 'State' },
      city: { form: cityForm, id: editingCityId, url: '/cities', required: cityForm.name && cityForm.state_id, reset: () => { setCityForm({ name: '', state_id: '', status: 'active' }); setEditingCityId(null) }, refetch: fetchCities, label: 'City' },
    }[kind]
    if (!String(map.required || '').toString().trim()) { showError(`${map.label} requires all fields`); return }
    try {
      setLoading(true)
      if (map.id) await axios.put(`${map.url}/${map.id}`, map.form)
      else await axios.post(map.url, map.form)
      showSuccess(`${map.label} ${map.id ? 'updated' : 'created'}`)
      map.reset()
      map.refetch()
    } catch (err) {
      showError(err.response?.data?.error || `Failed to save ${map.label.toLowerCase()}`)
    } finally { setLoading(false) }
  }

  const del = async (kind, row) => {
    const map = {
      category: { url: '/categories', refetch: fetchCategories, desc: 'Delete this category?' },
      country: { url: '/countries', refetch: fetchCountries, desc: 'Delete this country? This fails if states exist under it.' },
      state: { url: '/states', refetch: fetchStates, desc: 'Delete this state? This fails if cities exist under it.' },
      city: { url: '/cities', refetch: fetchCities, desc: 'Delete this city?' },
    }[kind]
    if (!(await confirm({ title: 'Delete entry?', description: map.desc, confirmText: 'Delete', destructive: true }))) return
    try {
      await axios.delete(`${map.url}/${row.id}`)
      showSuccess('Deleted')
      map.refetch()
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to delete')
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground" onClick={() => navigate('/')}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <FadeIn>
        <PageHeader title="Master data" description="Manage categories, countries, states and cities." />
      </FadeIn>

      {error && <Alert variant="destructive" className="mb-4"><X className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert variant="success" className="mb-4"><Check className="h-4 w-4" /><AlertDescription>{success}</AlertDescription></Alert>}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="countries">Countries</TabsTrigger>
          <TabsTrigger value="states">States</TabsTrigger>
          <TabsTrigger value="cities">Cities</TabsTrigger>
        </TabsList>

        {/* Categories */}
        <TabsContent value="categories">
          <Card className="overflow-hidden">
            {canEdit && (
              <div className="flex flex-wrap items-center gap-2 border-b p-4">
                <Input placeholder="Category name" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} className="w-48" />
                <Input placeholder="Description (optional)" value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} className="flex-1 min-w-[180px]" />
                <StatusSelect value={catForm.status} onChange={(v) => setCatForm({ ...catForm, status: v })} />
                <Button onClick={() => save('category')} disabled={loading}>{editingCatId ? 'Update' : <><Plus className="h-4 w-4" /> Add</>}</Button>
                {editingCatId && <Button variant="ghost" onClick={() => { setEditingCatId(null); setCatForm({ name: '', description: '', status: 'active' }) }}>Cancel</Button>}
              </div>
            )}
            <MasterTable canEdit={canEdit} rows={categories} emptyText="No categories found"
              columns={[
                { header: 'Name', render: (r) => <span className="font-medium text-foreground">{r.name}</span> },
                { header: 'Description', render: (r) => <span className="text-muted-foreground">{r.description || '—'}</span> },
                { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              ]}
              onEdit={(r) => { setEditingCatId(r.id); setCatForm({ name: r.name, description: r.description || '', status: r.status || 'active' }) }}
              onDelete={(r) => del('category', r)}
            />
          </Card>
        </TabsContent>

        {/* Countries */}
        <TabsContent value="countries">
          <Card className="overflow-hidden">
            {canEdit && (
              <div className="flex flex-wrap items-center gap-2 border-b p-4">
                <Input placeholder="Country name" value={countryForm.name} onChange={(e) => setCountryForm({ ...countryForm, name: e.target.value })} className="flex-1 min-w-[180px]" />
                <Input placeholder="Code (e.g. IN)" value={countryForm.code} onChange={(e) => setCountryForm({ ...countryForm, code: e.target.value })} className="w-32" />
                <StatusSelect value={countryForm.status} onChange={(v) => setCountryForm({ ...countryForm, status: v })} />
                <Button onClick={() => save('country')} disabled={loading}>{editingCountryId ? 'Update' : <><Plus className="h-4 w-4" /> Add</>}</Button>
                {editingCountryId && <Button variant="ghost" onClick={() => { setEditingCountryId(null); setCountryForm({ name: '', code: '', status: 'active' }) }}>Cancel</Button>}
              </div>
            )}
            <MasterTable canEdit={canEdit} rows={countries} emptyText="No countries found"
              columns={[
                { header: 'Name', render: (r) => <span className="font-medium text-foreground">{r.name}</span> },
                { header: 'Code', render: (r) => <span className="text-muted-foreground">{r.code || '—'}</span> },
                { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              ]}
              onEdit={(r) => { setEditingCountryId(r.id); setCountryForm({ name: r.name, code: r.code || '', status: r.status || 'active' }) }}
              onDelete={(r) => del('country', r)}
            />
          </Card>
        </TabsContent>

        {/* States */}
        <TabsContent value="states" className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filter by country</span>
            <Select value={stateCountryFilter} onValueChange={setStateCountryFilter}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All countries</SelectItem>
                {countries.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Card className="overflow-hidden">
            {canEdit && (
              <div className="flex flex-wrap items-center gap-2 border-b p-4">
                <Input placeholder="State name" value={stateForm.name} onChange={(e) => setStateForm({ ...stateForm, name: e.target.value })} className="flex-1 min-w-[160px]" />
                <Select value={stateForm.country_id ? String(stateForm.country_id) : ''} onValueChange={(v) => setStateForm({ ...stateForm, country_id: parseInt(v) })}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent>{countries.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
                <StatusSelect value={stateForm.status} onChange={(v) => setStateForm({ ...stateForm, status: v })} />
                <Button onClick={() => save('state')} disabled={loading}>{editingStateId ? 'Update' : <><Plus className="h-4 w-4" /> Add</>}</Button>
                {editingStateId && <Button variant="ghost" onClick={() => { setEditingStateId(null); setStateForm({ name: '', country_id: '', status: 'active' }) }}>Cancel</Button>}
              </div>
            )}
            <MasterTable canEdit={canEdit} rows={states} emptyText="No states found"
              columns={[
                { header: 'Name', render: (r) => <span className="font-medium text-foreground">{r.name}</span> },
                { header: 'Country', render: (r) => <span className="text-muted-foreground">{r.country_name || '—'}</span> },
                { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              ]}
              onEdit={(r) => { setEditingStateId(r.id); setStateForm({ name: r.name, country_id: r.country_id, status: r.status || 'active' }) }}
              onDelete={(r) => del('state', r)}
            />
          </Card>
        </TabsContent>

        {/* Cities */}
        <TabsContent value="cities" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Filter</span>
            <Select value={cityCountryFilter} onValueChange={setCityCountryFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Country" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All countries</SelectItem>
                {countries.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={cityStateFilter} onValueChange={setCityStateFilter} disabled={cityCountryFilter === 'all'}>
              <SelectTrigger className="w-44"><SelectValue placeholder="State" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All states</SelectItem>
                {cityStates.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Card className="overflow-hidden">
            {canEdit && (
              <div className="flex flex-wrap items-center gap-2 border-b p-4">
                <Input placeholder="City name" value={cityForm.name} onChange={(e) => setCityForm({ ...cityForm, name: e.target.value })} className="flex-1 min-w-[160px]" />
                <Select value={cityForm.state_id ? String(cityForm.state_id) : ''} onValueChange={(v) => setCityForm({ ...cityForm, state_id: parseInt(v) })}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="Select state" /></SelectTrigger>
                  <SelectContent>{(cityCountryFilter !== 'all' ? cityStates : states).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
                <StatusSelect value={cityForm.status} onChange={(v) => setCityForm({ ...cityForm, status: v })} />
                <Button onClick={() => save('city')} disabled={loading}>{editingCityId ? 'Update' : <><Plus className="h-4 w-4" /> Add</>}</Button>
                {editingCityId && <Button variant="ghost" onClick={() => { setEditingCityId(null); setCityForm({ name: '', state_id: '', status: 'active' }) }}>Cancel</Button>}
              </div>
            )}
            <MasterTable canEdit={canEdit} rows={cities} emptyText="No cities found"
              columns={[
                { header: 'Name', render: (r) => <span className="font-medium text-foreground">{r.name}</span> },
                { header: 'State', render: (r) => <span className="text-muted-foreground">{r.state_name || '—'}</span> },
                { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              ]}
              onEdit={(r) => { setEditingCityId(r.id); setCityForm({ name: r.name, state_id: r.state_id, status: r.status || 'active' }) }}
              onDelete={(r) => del('city', r)}
            />
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}
