import React, { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2, Power, Check, X, ShieldCheck, Lock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { FadeIn } from '@/components/motion'
import { StatusBadge } from '@/components/StatusBadge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DataTable } from '@/components/ui/data-table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'

const PERMISSIONS = [
  { id: 'campaigns.read', label: 'View campaigns', description: 'View campaigns and analytics' },
  { id: 'campaigns.write', label: 'Create / edit campaigns', description: 'Create and modify campaigns' },
  { id: 'campaigns.delete', label: 'Delete campaigns', description: 'Delete campaigns' },
  { id: 'users.read', label: 'View users', description: 'View the user list' },
  { id: 'users.write', label: 'Manage users', description: 'Create and edit users' },
  { id: 'users.delete', label: 'Delete users', description: 'Delete users' },
  { id: 'roles.manage', label: 'Manage roles', description: 'Modify role permissions' },
]
const FULL_ACCESS = { id: '*', label: 'Full access', description: 'Unrestricted system access (Admin only)' }

const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')

const searchUser = (row, _col, value) => {
  const q = String(value).toLowerCase()
  const u = row.original
  return [`${u.first_name || ''} ${u.last_name || ''}`, u.username, u.email, (u.roles || []).join(' ')]
    .some((v) => v && v.toLowerCase().includes(q))
}

const USER_COLUMNS = [
  {
    id: 'name',
    accessorFn: (r) => `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.username,
    header: 'Name',
    cell: ({ row, getValue }) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {(row.original.first_name || row.original.username || 'U').charAt(0).toUpperCase()}
        </div>
        <span className="font-medium text-foreground">{getValue()}</span>
      </div>
    ),
  },
  { accessorKey: 'username', header: 'Username', cell: ({ getValue }) => <span className="text-muted-foreground">{getValue()}</span> },
  { accessorKey: 'email', header: 'Email', cell: ({ getValue }) => <span className="text-muted-foreground">{getValue()}</span> },
  {
    id: 'roles', header: 'Roles', enableSorting: false,
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {(row.original.roles || []).length ? row.original.roles.map((r) => <Badge key={r} variant="secondary">{r}</Badge>) : <span className="text-muted-foreground">No roles</span>}
      </div>
    ),
  },
  { accessorKey: 'is_active', header: 'Status', cell: ({ getValue }) => <StatusBadge status={getValue() ? 'active' : 'inactive'} /> },
  { accessorKey: 'created_at', header: 'Created', cell: ({ getValue }) => <span className="whitespace-nowrap text-muted-foreground">{fmtDate(getValue())}</span> },
  {
    id: 'actions', header: '', enableSorting: false, meta: { cellClassName: 'text-right' },
    cell: ({ row, table }) => {
      const u = row.original
      const m = table.options.meta
      if ((u.roles || []).includes('Admin')) return <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" /> Protected</Badge>
      return (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit roles" onClick={() => m.onEditRoles(u)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title={u.is_active ? 'Deactivate' : 'Activate'} onClick={() => m.onToggleActive(u)}><Power className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete" onClick={() => m.onDelete(u)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      )
    },
  },
]

export default function UsersAndRoles() {
  const navigate = useNavigate()
  const { isAdmin, createUser } = useAuth()
  const confirm = useConfirm()

  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('users')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [createUserOpen, setCreateUserOpen] = useState(false)
  const [userForm, setUserForm] = useState({ username: '', email: '', first_name: '', last_name: '', roles: [], is_active: true })

  const [rolesEditUser, setRolesEditUser] = useState(null)
  const [rolesEditSel, setRolesEditSel] = useState([])

  const [createRoleOpen, setCreateRoleOpen] = useState(false)
  const [roleForm, setRoleForm] = useState({ name: '', description: '', permissions: [] })

  const showError = (m) => { setError(m); setTimeout(() => setError(''), 6000) }
  const showSuccess = (m) => { setSuccess(m); setTimeout(() => setSuccess(''), 5000) }

  const fetchUsers = () => axios.get('/users').then((r) => setUsers(r.data || [])).catch(() => showError('Failed to load users'))
  const fetchRoles = () => axios.get('/roles').then((r) => setRoles(r.data || [])).catch(() => {})

  useEffect(() => {
    if (!isAdmin()) return
    Promise.all([fetchUsers(), fetchRoles()]).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Users ----
  const submitCreateUser = async (e) => {
    e.preventDefault()
    if (!userForm.username || !userForm.email || !userForm.first_name || !userForm.last_name) return showError('All fields are required')
    if (userForm.roles.length === 0) return showError('Assign at least one role')
    const result = await createUser(userForm)
    if (result.success) {
      if (result.email_sent) showSuccess('User created — login credentials emailed to them.')
      else if (result.generated_password) showSuccess(`User created. Email not configured — share these credentials: username "${userForm.username}", password "${result.generated_password}".`)
      else showSuccess('User created successfully.')
      setUserForm({ username: '', email: '', first_name: '', last_name: '', roles: [], is_active: true })
      setCreateUserOpen(false)
      fetchUsers()
    } else {
      showError(result.error)
    }
  }

  const toggleActive = async (u) => {
    try {
      await axios.put(`/users/${u.id}`, { is_active: !u.is_active })
      showSuccess(`User ${!u.is_active ? 'activated' : 'deactivated'}`)
      fetchUsers()
    } catch (err) {
      if (err.response?.data?.orphaned_campaigns) showError('Cannot deactivate — this user is the only assignee on some campaigns. Reassign them first.')
      else showError(err.response?.data?.error || 'Failed to update status')
    }
  }

  const deleteUser = async (u) => {
    if (!(await confirm({ title: 'Delete user?', description: 'This permanently removes the user account. This cannot be undone.', confirmText: 'Delete', destructive: true }))) return
    try {
      await axios.delete(`/users/${u.id}`)
      showSuccess('User deleted')
      fetchUsers()
    } catch (err) {
      if (err.response?.data?.orphaned_campaigns) showError('Cannot delete — this user is the only assignee on some campaigns. Reassign them first.')
      else showError(err.response?.data?.error || 'Failed to delete user')
    }
  }

  const openEditRoles = (u) => { setRolesEditUser(u); setRolesEditSel(u.roles || []) }
  const saveEditRoles = async () => {
    try {
      await axios.put(`/users/${rolesEditUser.id}`, { roles: rolesEditSel })
      showSuccess('User roles updated')
      setRolesEditUser(null)
      fetchUsers()
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to update roles')
    }
  }

  // ---- Roles ----
  const submitCreateRole = async (e) => {
    e.preventDefault()
    if (!roleForm.name) return showError('Role name is required')
    try {
      await axios.post('/roles', roleForm)
      showSuccess('Role created')
      setRoleForm({ name: '', description: '', permissions: [] })
      setCreateRoleOpen(false)
      fetchRoles()
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to create role')
    }
  }
  const deleteRole = async (role) => {
    if (!(await confirm({ title: `Delete "${role.name}" role?`, description: 'This cannot be undone.', confirmText: 'Delete', destructive: true }))) return
    try {
      await axios.delete(`/roles/${role.id}`)
      showSuccess('Role deleted')
      fetchRoles()
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to delete role')
    }
  }
  const updateRolePermissions = async (roleId, permissions) => {
    try {
      await axios.put(`/roles/${roleId}`, { permissions })
      showSuccess('Permissions updated')
      fetchRoles()
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to update permissions')
    }
  }

  const meta = useMemo(() => ({ onEditRoles: openEditRoles, onToggleActive: toggleActive, onDelete: deleteUser }), []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAdmin()) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive"><Lock className="h-6 w-6" /></div>
          <h3 className="text-base font-semibold text-foreground">Access denied</h3>
          <p className="text-sm text-muted-foreground">Admin privileges are required for this page.</p>
          <Button onClick={() => navigate('/')}>Back to dashboard</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground" onClick={() => navigate('/')}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <FadeIn>
        <PageHeader
          title="Users & roles"
          description="Manage user accounts and configure role permissions."
          actions={
            tab === 'users' ? (
              <Button onClick={() => setCreateUserOpen(true)}><Plus className="h-4 w-4" /> Create user</Button>
            ) : (
              <Button onClick={() => setCreateRoleOpen(true)}><Plus className="h-4 w-4" /> Create role</Button>
            )
          }
        />
      </FadeIn>

      {error && <Alert variant="destructive" className="mb-4"><X className="h-4 w-4" /><AlertDescription className="whitespace-pre-line">{error}</AlertDescription></Alert>}
      {success && <Alert variant="success" className="mb-4"><Check className="h-4 w-4" /><AlertDescription className="whitespace-pre-line">{success}</AlertDescription></Alert>}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
          <TabsTrigger value="roles">Roles ({roles.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card className="overflow-hidden">
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading users…</div>
            ) : (
              <DataTable columns={USER_COLUMNS} data={users} meta={meta} globalFilterFn={searchUser} searchPlaceholder="Search users…" emptyMessage="No users found." pageSize={12} />
            )}
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          {roles.map((role) => (
            <RoleCard key={role.id} role={role} onSave={updateRolePermissions} onDelete={deleteRole} />
          ))}
        </TabsContent>
      </Tabs>

      {/* Create user dialog */}
      <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create new user</DialogTitle>
            <DialogDescription>A secure password is generated and emailed to the user.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCreateUser} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>First name *</Label><Input value={userForm.first_name} onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })} placeholder="John" required /></div>
              <div className="space-y-2"><Label>Last name *</Label><Input value={userForm.last_name} onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })} placeholder="Doe" required /></div>
              <div className="space-y-2"><Label>Username *</Label><Input value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} placeholder="johndoe" required /></div>
              <div className="space-y-2"><Label>Email *</Label><Input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} placeholder="john@example.com" required /></div>
            </div>
            <div className="space-y-2">
              <Label>Assign roles *</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {roles.map((role) => {
                  const checked = userForm.roles.includes(role.name)
                  return (
                    <label key={role.id} className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 hover:bg-accent/50">
                      <Checkbox className="mt-0.5" checked={checked} onCheckedChange={(c) => setUserForm((f) => ({ ...f, roles: c ? [...f.roles, role.name] : f.roles.filter((r) => r !== role.name) }))} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">{role.name}</div>
                        {role.description && <div className="text-xs text-muted-foreground">{role.description}</div>}
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
            <label className="flex w-fit cursor-pointer items-center gap-2">
              <Checkbox checked={userForm.is_active} onCheckedChange={(c) => setUserForm((f) => ({ ...f, is_active: !!c }))} />
              <span className="text-sm font-medium">Active account</span>
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateUserOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={userForm.roles.length === 0}>Create user</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit roles dialog */}
      <Dialog open={!!rolesEditUser} onOpenChange={(o) => !o && setRolesEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit roles</DialogTitle>
            <DialogDescription>{rolesEditUser && `Update roles for ${rolesEditUser.first_name || rolesEditUser.username}.`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {roles.map((role) => (
              <label key={role.id} className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 hover:bg-accent/50">
                <Checkbox checked={rolesEditSel.includes(role.name)} onCheckedChange={(c) => setRolesEditSel((sel) => c ? [...sel, role.name] : sel.filter((r) => r !== role.name))} />
                <span className="text-sm font-medium text-foreground">{role.name}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRolesEditUser(null)}>Cancel</Button>
            <Button onClick={saveEditRoles}>Save roles</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create role dialog */}
      <Dialog open={createRoleOpen} onOpenChange={setCreateRoleOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create new role</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitCreateRole} className="space-y-4">
            <div className="space-y-2"><Label>Role name *</Label><Input value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} placeholder="e.g., Content Manager" required /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} rows={2} placeholder="Describe the purpose of this role" /></div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="space-y-1.5">
                {PERMISSIONS.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 hover:bg-accent/50">
                    <Checkbox className="mt-0.5" checked={roleForm.permissions.includes(p.id)} onCheckedChange={(c) => setRoleForm((f) => ({ ...f, permissions: c ? [...f.permissions, p.id] : f.permissions.filter((x) => x !== p.id) }))} />
                    <div><div className="text-sm font-medium text-foreground">{p.label}</div><div className="text-xs text-muted-foreground">{p.description}</div></div>
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateRoleOpen(false)}>Cancel</Button>
              <Button type="submit">Create role</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function RoleCard({ role, onSave, onDelete }) {
  const isAdminRole = role.name === 'Admin'
  const [editing, setEditing] = useState(false)
  const [perms, setPerms] = useState(role.permissions || [])

  const all = [...PERMISSIONS, FULL_ACCESS]
  const toggle = (id) => {
    if (id === '*') return setPerms(['*'])
    setPerms((prev) => {
      const base = prev.filter((p) => p !== '*')
      return base.includes(id) ? base.filter((p) => p !== id) : [...base, id]
    })
  }
  const save = () => { onSave(role.id, perms); setEditing(false) }
  const labelFor = (id) => all.find((p) => p.id === id)?.label || id

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{role.name}</h3>
              {isAdminRole && <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" /> Protected</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{role.description || 'No description'}</p>
          </div>
          {!isAdminRole && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing((e) => !e)}>{editing ? 'Cancel' : 'Edit permissions'}</Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => onDelete(role)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          )}
        </div>

        <div className="mt-4 border-t pt-4">
          {editing ? (
            <div className="space-y-2">
              {all.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 hover:bg-accent/50">
                  <Checkbox className="mt-0.5" checked={perms.includes(p.id)} disabled={p.id === '*' && !isAdminRole} onCheckedChange={() => toggle(p.id)} />
                  <div><div className="text-sm font-medium text-foreground">{p.label}</div><div className="text-xs text-muted-foreground">{p.description}</div></div>
                </label>
              ))}
              <Button size="sm" onClick={save} className="mt-1"><Check className="h-4 w-4" /> Save permissions</Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {(role.permissions || []).length ? (
                role.permissions.map((p) => <Badge key={p} variant="secondary">{p === '*' ? 'Full access' : labelFor(p)}</Badge>)
              ) : (
                <span className="text-sm text-muted-foreground">No permissions assigned</span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
