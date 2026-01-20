# Role-Based Access Control (RBAC) Implementation

## Overview
This document outlines the complete RBAC implementation for the Influencer Dashboard, including role definitions, permissions, and access controls.

## Role Definitions

### 1. **Admin**
- **Description**: Full system access
- **Permissions**: `["*"]` (all permissions)
- **Capabilities**:
  - Full access to all campaigns (can view all campaigns regardless of assignment)
  - Create, view, update, and delete campaigns
  - Assign/unassign users to campaigns
  - Manage users (create, update, deactivate, assign roles)
  - Access campaign analytics, influencers, and content
  - Access user management interface

### 2. **Manager**
- **Description**: Campaign management access
- **Permissions**: `["campaigns.read", "campaigns.write", "campaigns.delete"]`
- **Capabilities**:
  - Create new campaigns (auto-assigned as creator)
  - View campaigns they are assigned to
  - Assign other users to campaigns they created
  - Access campaign analytics, influencers, and content for assigned campaigns
  - Cannot access user management

### 3. **Viewer**
- **Description**: Read-only access
- **Permissions**: `["campaigns.read"]`
- **Capabilities**:
  - View campaigns they are assigned to
  - View campaign details, analytics, influencers, and content
  - Cannot create or modify campaigns
  - Cannot assign users to campaigns
  - Cannot access user management

---

## Campaign Access Model

### Campaign Creation
- **Allowed Roles**: Admin, Manager
- **Auto-Assignment**: Campaign creator is automatically assigned to the campaign
- **Additional Assignments**: Creator can assign other users during creation
- **Backend Enforcement**: `@role_required('Admin', 'Manager')` decorator on POST /api/campaigns
- **Frontend Protection**: Route protected with `requiredAnyRole={['Admin', 'Manager']}`

### Campaign Viewing
- **Access Rule**:
  - **Admin**: Can view ALL campaigns
  - **Manager/Viewer**: Can only view campaigns they are assigned to
- **Assignment Enforcement**: Backend checks `campaign.assigned_users` for non-Admin users
- **Endpoints Protected**:
  - GET /api/campaigns
  - GET /api/campaigns/:id
  - GET /api/campaigns/:id/influencers
  - GET /api/campaigns/:id/content
  - GET /api/campaigns/:id/analytics

### Campaign Assignment Management
- **Allowed Users**:
  - Admin (can update any campaign)
  - Campaign Creator (can update their own campaign)
- **Endpoint**: PUT /api/campaigns/:id/assignments
- **Validation**:
  - Only active users can be assigned
  - Non-admins cannot assign inactive users
  - Campaigns must have at least one assigned user

---

## API Endpoint Permissions

### Campaign Endpoints

| Endpoint | Method | Required Role | Additional Checks |
|----------|--------|---------------|-------------------|
| `/api/campaigns` | POST | Admin, Manager | Auto-assigns creator |
| `/api/campaigns` | GET | Any authenticated | Filters by role (Admin sees all, others see assigned) |
| `/api/campaigns/:id` | GET | Any authenticated | Must be assigned (except Admin) |
| `/api/campaigns/:id/assignments` | PUT | Any authenticated | Must be Admin OR campaign creator |
| `/api/campaigns/:id/influencers` | GET | Any authenticated | Must be assigned (except Admin) |
| `/api/campaigns/:id/content` | GET | Any authenticated | Must be assigned (except Admin) |
| `/api/campaigns/:id/analytics` | GET | Any authenticated | Must be assigned (except Admin) |

### User Management Endpoints

| Endpoint | Method | Required Role | Additional Checks |
|----------|--------|---------------|-------------------|
| `/api/users` | POST | Admin | Creates user with auto-generated password |
| `/api/users` | GET | Admin | Returns all users |
| `/api/users/:id` | PUT | Admin | Update user details |
| `/api/users/:id/deactivate` | PUT | Admin | Deactivate user account |
| `/api/users/:id/roles` | PUT | Admin | Assign/remove roles |
| `/api/roles` | GET | Admin | List all available roles |
| `/api/roles` | POST | Admin | Create new role |
| `/api/roles/:id` | DELETE | Admin | Delete role |

---

## Frontend Route Protection

### Protected Routes Configuration

```javascript
// Public Route
/login - No authentication required

// Authenticated Routes
/ - Protected (any authenticated user)
/campaign/:id - Protected (any authenticated user, assignment checked server-side)

// Role-Restricted Routes
/campaigns/new - Protected (Admin OR Manager)
/users - Protected (Admin only)
```

### UI Component Visibility

| Component | Visibility Rule |
|-----------|----------------|
| "New Campaign" Button | `isManager()` - Shows for Admin and Manager |
| "Manage Users" Button | `isAdmin()` - Shows for Admin only |
| Campaign Assignment Section | Shows for Admin and Managers creating campaigns |

---

## Authorization Helpers (Frontend)

### AuthContext Functions

```javascript
hasRole(roleName)
// Returns true if user has the specific role
// Example: hasRole('Admin')

hasAnyRole(roleNames)
// Returns true if user has any of the specified roles
// Example: hasAnyRole(['Admin', 'Manager'])

isAdmin()
// Returns true if user has Admin role

isManager()
// Returns true if user has Manager OR Admin role (hierarchical)

isViewer()
// Returns true if user has Viewer, Manager, OR Admin role (hierarchical)
```

---

## Security Implementation Details

### Backend Decorators

#### `@token_required`
- Validates JWT token from Authorization header
- Extracts and verifies user from token
- Ensures user account is active
- Returns 401 if authentication fails

#### `@role_required('Role1', 'Role2', ...)`
- Extends `@token_required`
- Checks if authenticated user has any of the specified roles
- Returns 403 if user lacks required role

### Campaign Assignment Enforcement

All campaign-related endpoints check assignment:

```python
if not user.has_role('Admin'):
    assigned_user_ids = [u.id for u in campaign.assigned_users]
    if user.id not in assigned_user_ids:
        return jsonify({'error': 'Insufficient permissions'}), 403
```

### Auto-Assignment on Campaign Creation

When creating a campaign (app.py:762):
```python
campaign.assigned_users.append(user)  # Creator automatically assigned
```

---

## Permission Matrix Summary

| Action | Admin | Manager | Viewer |
|--------|-------|---------|--------|
| Create Campaign | ✅ | ✅ | ❌ |
| View All Campaigns | ✅ | ❌ | ❌ |
| View Assigned Campaigns | ✅ | ✅ | ✅ |
| Assign Users to Own Campaign | ✅ | ✅ | ❌ |
| Assign Users to Any Campaign | ✅ | ❌ | ❌ |
| View Campaign Analytics | ✅ (all) | ✅ (assigned) | ✅ (assigned) |
| Manage Users | ✅ | ❌ | ❌ |
| Manage Roles | ✅ | ❌ | ❌ |

---

## Testing RBAC

### Test Scenarios

1. **Campaign Creation**
   - ✅ Admin can create campaigns
   - ✅ Manager can create campaigns
   - ❌ Viewer cannot create campaigns (403 Forbidden)

2. **Campaign Viewing**
   - ✅ Admin sees all campaigns
   - ✅ Manager sees only assigned campaigns
   - ✅ Viewer sees only assigned campaigns
   - ❌ Non-assigned users get 403 when accessing campaign details

3. **Campaign Assignment**
   - ✅ Admin can assign users to any campaign
   - ✅ Campaign creator can assign users to their campaign
   - ❌ Non-creator Manager cannot assign users to others' campaigns
   - ❌ Viewer cannot assign users to any campaign

4. **User Management**
   - ✅ Admin can access /users route
   - ❌ Manager redirected from /users route
   - ❌ Viewer redirected from /users route

---

## Future Enhancements

### Potential Improvements
1. **Granular Permissions**: Split campaign permissions into create, read, update, delete
2. **Campaign Updates**: Add PUT/PATCH endpoints for campaign editing with permission checks
3. **Campaign Deletion**: Add DELETE endpoint with Admin-only or creator-based permissions
4. **Audit Logging**: Track all permission-based actions for compliance
5. **Team-based Access**: Add organizational units or teams for campaign grouping
6. **Custom Roles**: Allow Admins to create custom roles with specific permission sets

---

## Implementation Files

### Backend
- `backend/app.py:391-402` - RBAC decorator implementations
- `backend/app.py:730-779` - Campaign creation with auto-assignment
- `backend/app.py:781-821` - Campaign assignment management
- `backend/app.py:823-834` - Role-filtered campaign listing
- `backend/app.py:836-875` - Assignment-checked campaign endpoints

### Frontend
- `frontend/src/contexts/AuthContext.js` - Authentication and role helpers
- `frontend/src/components/ProtectedRoute.js` - Route-level role enforcement
- `frontend/src/App.js` - Route configuration with role requirements
- `frontend/src/CampaignDashboard.js` - Role-based UI component visibility
- `frontend/src/components/NewCampaign.js` - Campaign creation form

---

*Last Updated: 2025-12-02*
