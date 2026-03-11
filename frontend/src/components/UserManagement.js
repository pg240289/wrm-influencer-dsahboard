import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './UserManagement.css';

function UserManagement() {
  const navigate = useNavigate();
  const { isAdmin, createUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('users'); // 'users' or 'roles'
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showRoleManager, setShowRoleManager] = useState(false);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    roles: [],
    is_active: true
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFormData, setRoleFormData] = useState({
    name: '',
    description: '',
    permissions: []
  });

  useEffect(() => {
    if (isAdmin()) {
      fetchUsers();
      fetchRoles();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/users');
      setUsers(response.data);
      setLoading(false);
    } catch (err) {
      setError('Failed to load users');
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await axios.get('/roles');
      setRoles(response.data);
    } catch (err) {
      console.error('Failed to load roles');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleRoleChange = (roleName) => {
    setFormData({
      ...formData,
      roles: formData.roles.includes(roleName)
        ? formData.roles.filter(r => r !== roleName)
        : [...formData.roles, roleName]
    });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.username || !formData.email || !formData.first_name || !formData.last_name) {
      setError('Username, email, first name, and last name are required');
      return;
    }

    if (formData.roles.length === 0) {
      setError('Please assign at least one role to the user');
      return;
    }

    const result = await createUser(formData);

    if (result.success) {
      // Check if email was sent or if we need to show the password manually
      if (result.email_sent) {
        setSuccess('User created successfully! Login credentials have been sent to their email.');
      } else if (result.generated_password) {
        // Email not configured, show password to admin
        setSuccess(
          `User created successfully!\n\n` +
          `⚠️ Email is not configured. Please provide these credentials to the user:\n\n` +
          `Username: ${formData.username}\n` +
          `Password: ${result.generated_password}\n\n` +
          `Make sure the user changes their password after first login.`
        );
      } else {
        setSuccess('User created successfully!');
      }

      setFormData({
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        roles: [],
        is_active: true
      });
      setShowCreateForm(false);
      fetchUsers();
    } else {
      setError(result.error);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      await axios.delete(`/users/${userId}`);
      setSuccess('User deleted successfully');
      fetchUsers();
    } catch (err) {
      // Check if there are orphaned campaigns
      if (err.response?.data?.orphaned_campaigns) {
        const campaigns = err.response.data.orphaned_campaigns;
        const campaignList = campaigns.map(c => `• ${c.campaign_name}`).join('\n');
        setError(
          `Cannot delete this user. They are the only assignee for the following campaigns:\n\n${campaignList}\n\nPlease reassign these campaigns to another user first.`
        );
      } else {
        setError(err.response?.data?.error || 'Failed to delete user');
      }
    }
  };

  const handleToggleActive = async (userId, currentStatus) => {
    try {
      await axios.put(`/users/${userId}`, { is_active: !currentStatus });
      setSuccess(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      fetchUsers();
    } catch (err) {
      // Check if there are orphaned campaigns
      if (err.response?.data?.orphaned_campaigns) {
        const campaigns = err.response.data.orphaned_campaigns;
        const campaignList = campaigns.map(c => `• ${c.campaign_name}`).join('\n');
        setError(
          `Cannot deactivate this user. They are the only assignee for the following campaigns:\n\n${campaignList}\n\nPlease reassign these campaigns to another user first.`
        );
      } else {
        setError(err.response?.data?.error || 'Failed to update user status');
      }
    }
  };

  const handleUpdateUserRoles = async (userId, newRoles) => {
    try {
      await axios.put(`/users/${userId}`, { roles: newRoles });
      setSuccess('User roles updated successfully');
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update user roles');
    }
  };

  const handleUpdateRolePermissions = async (roleId, permissions) => {
    try {
      await axios.put(`/roles/${roleId}`, { permissions });
      setSuccess('Role permissions updated successfully');
      fetchRoles();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update role permissions');
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!roleFormData.name) {
      setError('Role name is required');
      return;
    }

    try {
      await axios.post('/roles', roleFormData);
      setSuccess('Role created successfully!');
      setRoleFormData({ name: '', description: '', permissions: [] });
      setShowCreateRole(false);
      fetchRoles();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create role');
    }
  };

  const handleDeleteRole = async (roleId, roleName) => {
    if (!window.confirm(`Are you sure you want to delete the "${roleName}" role? This action cannot be undone.`)) {
      return;
    }

    try {
      await axios.delete(`/roles/${roleId}`);
      setSuccess('Role deleted successfully');
      fetchRoles();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete role');
    }
  };

  const handleRoleFormChange = (e) => {
    const { name, value } = e.target;
    setRoleFormData({
      ...roleFormData,
      [name]: value
    });
  };

  const handleRolePermissionChange = (permissionId) => {
    setRoleFormData({
      ...roleFormData,
      permissions: roleFormData.permissions.includes(permissionId)
        ? roleFormData.permissions.filter(p => p !== permissionId)
        : [...roleFormData.permissions, permissionId]
    });
  };

  if (!isAdmin()) {
    return (
      <div className="user-management-container">
        <div className="error-state">
          <div className="error-icon">🔒</div>
          <h3>Access Denied</h3>
          <p>Admin privileges required to access this page.</p>
          <button className="btn-primary-modern" onClick={() => navigate('/')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="user-management-container">
        <div className="loading-state">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="user-management-container">
      {/* Header */}
      <div className="management-header">
        <div className="header-left">
          <h1>User & Role Management</h1>
          <p>Manage users and configure role permissions</p>
        </div>
        <div className="header-actions">
          {activeTab === 'users' && (
            <button 
              className="btn-primary-modern"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M10 3v14m7-7H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              {showCreateForm ? 'Cancel' : 'Create User'}
            </button>
          )}
          {activeTab === 'roles' && (
            <>
              <button
                className="btn-primary-modern"
                onClick={() => setShowCreateRole(!showCreateRole)}
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path d="M10 3v14m7-7H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {showCreateRole ? 'Cancel' : 'Create Role'}
              </button>
              <button
                className="btn-secondary-modern"
                onClick={() => setShowRoleManager(!showRoleManager)}
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path d="M12 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm-1 7H9v2H7v-2H5v-2h2V7h2v2h2v2zm4-5h-2v2h2V6zm0 4h-2v2h2v-2z" fill="currentColor"/>
                </svg>
                {showRoleManager ? 'Hide Permissions' : 'Manage Permissions'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="management-tabs">
        <button 
          className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM17 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 0 0-1.5-4.33A5 5 0 0 1 19 16v1h-6.07zM6 11a5 5 0 0 1 5 5v1H1v-1a5 5 0 0 1 5-5z" fill="currentColor"/>
          </svg>
          Users ({users.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'roles' ? 'active' : ''}`}
          onClick={() => setActiveTab('roles')}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M9 2a1 1 0 0 0 0 2h2a1 1 0 1 0 0-2H9z" fill="currentColor"/>
            <path fillRule="evenodd" d="M4 5a2 2 0 0 1 2-2 3 3 0 0 0 3 3h2a3 3 0 0 0 3-3 2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm3 4a1 1 0 0 0 0 2h.01a1 1 0 1 0 0-2H7zm3 0a1 1 0 0 0-.01 2H10a1 1 0 1 0 .01-2z" fill="currentColor"/>
          </svg>
          Roles ({roles.length})
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="alert-message error-alert">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM8.707 7.293a1 1 0 0 0-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 1 0 1.414 1.414L10 11.414l1.293 1.293a1 1 0 0 0 1.414-1.414L11.414 10l1.293-1.293a1 1 0 0 0-1.414-1.414L10 8.586 8.707 7.293z" fill="currentColor"/>
          </svg>
          {error}
          <button className="alert-close" onClick={() => setError('')}>×</button>
        </div>
      )}
      {success && (
        <div className="alert-message success-alert">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.707-9.293-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4z" fill="currentColor"/>
          </svg>
          {success}
          <button className="alert-close" onClick={() => setSuccess('')}>×</button>
        </div>
      )}

      {/* Create User Form */}
      {activeTab === 'users' && showCreateForm && (
        <div className="create-form-card">
          <div className="form-header">
            <h2>Create New User</h2>
            <button className="close-button" onClick={() => setShowCreateForm(false)}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <form onSubmit={handleCreateUser} className="modern-form">
            <div className="form-row">
              <div className="form-group">
                <label>First Name <span className="required">*</span></label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  required
                  placeholder="John"
                />
              </div>
              <div className="form-group">
                <label>Last Name <span className="required">*</span></label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  required
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Username <span className="required">*</span></label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                  placeholder="johndoe"
                />
              </div>
              <div className="form-group">
                <label>Email <span className="required">*</span></label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  placeholder="john.doe@example.com"
                />
              </div>
            </div>

            <div className="info-box">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm1 15H9v-2h2v2zm0-4H9V5h2v6z" fill="currentColor"/>
              </svg>
              <span>A secure random password will be automatically generated and sent to the user's email address.</span>
            </div>

            <div className="form-group">
              <label>Assign Roles <span className="required">*</span></label>
              <p className="field-help">Select one or more roles for this user. Click on a role to see its permissions.</p>
              <div className="roles-selection-grid">
                {roles.map(role => (
                  <div key={role.id} className={`role-card-selectable ${formData.roles.includes(role.name) ? 'selected' : ''}`}>
                    <label className="role-card-header-selectable">
                      <input
                        type="checkbox"
                        checked={formData.roles.includes(role.name)}
                        onChange={() => handleRoleChange(role.name)}
                      />
                      <div className="role-info">
                        <span className="role-name">{role.name}</span>
                        {role.description && (
                          <span className="role-desc">{role.description}</span>
                        )}
                      </div>
                    </label>
                    <div className="role-permissions-preview">
                      <div className="permissions-label">Permissions:</div>
                      <div className="permissions-tags">
                        {(Array.isArray(role.permissions) ? role.permissions : []).map((perm, idx) => (
                          <span key={idx} className="permission-tag">
                            {perm === '*' ? 'Full Access' : perm.replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {formData.roles.length === 0 && (
                <div className="validation-hint">Please select at least one role</div>
              )}
            </div>

            <div className="form-group">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleInputChange}
                />
                <span className="toggle-slider"></span>
                <span className="toggle-text">Active Account</span>
              </label>
              <p className="field-help-small">Inactive users cannot log in to the system</p>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-cancel" onClick={() => setShowCreateForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-submit" disabled={formData.roles.length === 0}>
                Create User & Send Credentials
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="content-card">
          <div className="table-header-section">
            <h3>All Users</h3>
            <div className="table-actions">
              <input
                type="text"
                placeholder="Search users..."
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="table-wrapper">
            <table className="modern-data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Roles</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(user => {
                  if (!searchQuery) return true;
                  const query = searchQuery.toLowerCase();
                  const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
                  const username = user.username.toLowerCase();
                  const email = user.email.toLowerCase();
                  const userRoles = user.roles.map(r => r.toLowerCase()).join(' ');
                  return fullName.includes(query) ||
                         username.includes(query) ||
                         email.includes(query) ||
                         userRoles.includes(query);
                }).map((user, idx) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    index={idx}
                    roles={roles}
                    onToggleActive={handleToggleActive}
                    onDelete={handleDeleteUser}
                    onUpdateRoles={handleUpdateUserRoles}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Role Form */}
      {activeTab === 'roles' && showCreateRole && (
        <div className="create-form-card">
          <div className="form-header">
            <h2>Create New Role</h2>
            <button className="close-button" onClick={() => setShowCreateRole(false)}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <form onSubmit={handleCreateRole} className="modern-form">
            <div className="form-group">
              <label>Role Name <span className="required">*</span></label>
              <input
                type="text"
                name="name"
                value={roleFormData.name}
                onChange={handleRoleFormChange}
                required
                placeholder="e.g., Content Manager"
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                name="description"
                value={roleFormData.description}
                onChange={handleRoleFormChange}
                placeholder="Describe the purpose of this role"
                rows="3"
              />
            </div>

            <div className="form-group">
              <label>Assign Permissions</label>
              <div className="roles-selection">
                {[
                  { id: 'campaigns.read', label: 'View Campaigns', description: 'Can view campaigns and analytics' },
                  { id: 'campaigns.write', label: 'Create/Edit Campaigns', description: 'Can create and modify campaigns' },
                  { id: 'campaigns.delete', label: 'Delete Campaigns', description: 'Can delete campaigns' },
                  { id: 'users.read', label: 'View Users', description: 'Can view user list' },
                  { id: 'users.write', label: 'Manage Users', description: 'Can create and edit users' },
                  { id: 'users.delete', label: 'Delete Users', description: 'Can delete users' },
                  { id: 'roles.manage', label: 'Manage Roles', description: 'Can modify role permissions' }
                ].map(perm => (
                  <label key={perm.id} className="role-checkbox">
                    <input
                      type="checkbox"
                      checked={roleFormData.permissions.includes(perm.id)}
                      onChange={() => handleRolePermissionChange(perm.id)}
                    />
                    <div className="checkbox-content">
                      <span className="checkbox-label">{perm.label}</span>
                      <span className="checkbox-description">{perm.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-cancel" onClick={() => setShowCreateRole(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-submit">
                Create Role
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Roles Tab */}
      {activeTab === 'roles' && (
        <div className="roles-management">
          {roles.map(role => (
            <RoleCard
              key={role.id}
              role={role}
              showPermissions={showRoleManager}
              onUpdatePermissions={handleUpdateRolePermissions}
              onDelete={handleDeleteRole}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// User Row Component
function UserRow({ user, index, roles, onToggleActive, onDelete, onUpdateRoles }) {
  const [isEditingRoles, setIsEditingRoles] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState(user.roles || []);

  const handleSaveRoles = () => {
    onUpdateRoles(user.id, selectedRoles);
    setIsEditingRoles(false);
  };

  return (
    <tr>
      <td className="row-number">{index + 1}</td>
      <td>
        <div className="user-cell">
          <div className="user-avatar-small">
            {(user.first_name || user.username || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="user-name-cell">
              {user.first_name || user.last_name
                ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                : user.username}
            </div>
          </div>
        </div>
      </td>
      <td className="username-cell">{user.username}</td>
      <td className="email-cell">{user.email}</td>
      <td>
        {isEditingRoles ? (
          <div className="role-editor">
            {roles.map(role => (
              <label key={role.id} className="role-checkbox-small">
                <input
                  type="checkbox"
                  checked={selectedRoles.includes(role.name)}
                  disabled={user.roles.includes('Admin') && role.name === 'Admin'}
                  onChange={(e) => {
                    // Prevent removing Admin role from admin accounts
                    if (user.roles.includes('Admin') && role.name === 'Admin' && !e.target.checked) {
                      return;
                    }
                    if (e.target.checked) {
                      setSelectedRoles([...selectedRoles, role.name]);
                    } else {
                      setSelectedRoles(selectedRoles.filter(r => r !== role.name));
                    }
                  }}
                />
                <span className={user.roles.includes('Admin') && role.name === 'Admin' ? 'role-disabled' : ''}>
                  {role.name}
                </span>
              </label>
            ))}
            <div className="role-editor-actions">
              <button className="btn-save-small" onClick={handleSaveRoles}>Save</button>
              <button className="btn-cancel-small" onClick={() => setIsEditingRoles(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="roles-badges">
            {user.roles && user.roles.length > 0 ? (
              user.roles.map(role => (
                <span key={role} className={`role-badge role-${role.toLowerCase()}`}>
                  {role}
                </span>
              ))
            ) : (
              <span className="no-roles">No roles</span>
            )}
            {!user.roles.includes('Admin') && (
              <button 
                className="edit-roles-btn"
                onClick={() => setIsEditingRoles(true)}
                title="Edit roles"
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                  <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25a1.75 1.75 0 0 1 .445-.758l8.61-8.61zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354L11.427 2.487zM11.19 6.25l-1.44-1.44-6.3 6.3a.25.25 0 0 0-.064.108l-.558 1.953 1.953-.558a.25.25 0 0 0 .108-.064l6.3-6.3z" fill="currentColor"/>
                </svg>
              </button>
            )}
          </div>
        )}
      </td>
      <td>
        <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
          {user.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="date-cell">
        {user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        }) : '-'}
      </td>
      <td>
        <div className="action-buttons">
          {!user.roles.includes('Admin') && (
            <button
              className="action-btn action-toggle"
              onClick={() => onToggleActive(user.id, user.is_active)}
              title={user.is_active ? 'Deactivate User' : 'Activate User'}
            >
              {user.is_active ? (
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16z" fill="currentColor" opacity="0.1"/>
                  <path d="M10 6v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="10" cy="10" r="5" stroke="currentColor" strokeWidth="2" fill="none"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16z" fill="currentColor" opacity="0.1"/>
                  <path d="M10 6v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
                  <circle cx="10" cy="10" r="5" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="2 2" opacity="0.6"/>
                </svg>
              )}
            </button>
          )}
          {!user.roles.includes('Admin') && (
            <button
              className="action-btn action-delete"
              onClick={() => onDelete(user.id)}
              title="Delete user"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/>
              </svg>
            </button>
          )}
          {user.roles.includes('Admin') && (
            <span className="admin-protected-badge" title="Admin accounts are protected and cannot be modified">
              Protected
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

// Role Card Component
function RoleCard({ role, showPermissions, onUpdatePermissions, onDelete }) {
  const [permissions, setPermissions] = useState(role.permissions || []);
  const [isEditing, setIsEditing] = useState(false);
  const isAdminRole = role.name === 'Admin';

  const availablePermissions = [
    { id: 'campaigns.read', label: 'View Campaigns', description: 'Can view campaigns and analytics' },
    { id: 'campaigns.write', label: 'Create/Edit Campaigns', description: 'Can create and modify campaigns' },
    { id: 'campaigns.delete', label: 'Delete Campaigns', description: 'Can delete campaigns' },
    { id: 'users.read', label: 'View Users', description: 'Can view user list' },
    { id: 'users.write', label: 'Manage Users', description: 'Can create and edit users' },
    { id: 'users.delete', label: 'Delete Users', description: 'Can delete users' },
    { id: 'roles.manage', label: 'Manage Roles', description: 'Can modify role permissions' },
    { id: '*', label: 'Full Access', description: 'Unrestricted system access (Admin only)' }
  ];

  const handlePermissionToggle = (permissionId) => {
    if (permissionId === '*') {
      // If selecting full access, clear all others
      setPermissions(['*']);
    } else {
      // Remove full access if selecting specific permissions
      let newPermissions = permissions.filter(p => p !== '*');
      if (newPermissions.includes(permissionId)) {
        newPermissions = newPermissions.filter(p => p !== permissionId);
      } else {
        newPermissions = [...newPermissions, permissionId];
      }
      setPermissions(newPermissions);
    }
  };

  const handleSave = () => {
    onUpdatePermissions(role.id, permissions);
    setIsEditing(false);
  };

  return (
    <div className={`role-card ${isAdminRole ? 'admin-role-card' : ''}`}>
      <div className="role-card-header">
        <div>
          <h3>
            {role.name}
            {isAdminRole && <span className="admin-badge">Protected</span>}
          </h3>
          <p>{role.description || 'No description'}</p>
        </div>
        <div className="role-card-actions">
          {showPermissions && !isAdminRole && (
            <button
              className="btn-edit-role"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? 'Cancel' : 'Edit Permissions'}
            </button>
          )}
          {!isAdminRole && (
            <button
              className="btn-delete-role"
              onClick={() => onDelete(role.id, role.name)}
              title="Delete role"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/>
              </svg>
            </button>
          )}
          {isAdminRole && (
            <span className="admin-protected-info" title="The Admin role cannot be modified or deleted">
              🔒 This role has full system access and cannot be modified
            </span>
          )}
        </div>
      </div>
      
      {showPermissions && (
        <div className="role-permissions">
          {isEditing ? (
            <div className="permissions-editor">
              {availablePermissions.map(perm => (
                <label key={perm.id} className="permission-checkbox">
                  <input
                    type="checkbox"
                    checked={permissions.includes(perm.id)}
                    onChange={() => handlePermissionToggle(perm.id)}
                    disabled={perm.id === '*' && role.name !== 'Admin'}
                  />
                  <div className="permission-info">
                    <span className="permission-label">{perm.label}</span>
                    <span className="permission-desc">{perm.description}</span>
                  </div>
                </label>
              ))}
              <button className="btn-save-permissions" onClick={handleSave}>
                Save Permissions
              </button>
            </div>
          ) : (
            <div className="permissions-display">
              {permissions.length > 0 ? (
                <div className="permissions-list">
                  {permissions.map(permId => {
                    const perm = availablePermissions.find(p => p.id === permId);
                    return perm ? (
                      <span key={permId} className="permission-badge">
                        {perm.label}
                      </span>
                    ) : null;
                  })}
                </div>
              ) : (
                <span className="no-permissions">No permissions assigned</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default UserManagement;
