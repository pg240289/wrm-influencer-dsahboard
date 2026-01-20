# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **full-stack influencer campaign management dashboard** with comprehensive Role-Based Access Control (RBAC). The application allows organizations to manage influencer marketing campaigns with different permission levels for users.

**Tech Stack:**
- **Backend:** Flask (Python) with SQLAlchemy ORM, JWT authentication
- **Frontend:** React 19 with React Router, Axios, Recharts
- **Database:** SQLite (local file-based)

## Development Commands

### Quick Start (Both Servers)

**Windows:**
```powershell
# PowerShell (Recommended)
powershell -ExecutionPolicy Bypass -File start.ps1

# Or double-click start.bat or start.ps1
```

**Mac/Linux:**
```bash
./start.sh
```

These scripts will:
- Kill any existing processes on ports 5000 and 3000
- Start the Flask backend on http://localhost:5000
- Start the React frontend on http://localhost:3000
- Open separate terminal windows for each server

### Backend (Flask API)
```bash
cd backend
python app.py                 # Run development server on http://localhost:5000
python activate_admin.py      # Activate the admin user if needed
```

**Install Dependencies:**
```bash
cd backend
pip install -r requirements.txt
```

**Database:** Located at `backend/instance/campaigns.db`. The database schema is automatically created on first run.

**Email Configuration (Optional):**
Create a `.env` file in the backend directory to configure email for sending welcome credentials:
```bash
cd backend
cp .env.example .env
# Edit .env with your email settings
```

Email settings in `.env`:
```
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_DEFAULT_SENDER=your-email@gmail.com
```

**Note:** For Gmail, use an App Password (not your regular password). Generate one at: https://myaccount.google.com/apppasswords

If email is not configured, the generated password will be displayed in the API response when creating users.

### Frontend (React)
```bash
cd frontend
npm start                     # Run development server on http://localhost:3000
npm test                      # Run tests in watch mode
npm test -- --testPathPattern="App.test.js"  # Run a single test file
npm run build                 # Build for production
```

**Install Dependencies:**
```bash
cd frontend
npm install
```

## Architecture Overview

### Backend Structure (`backend/app.py`)

**Single-File Flask Application** - All backend code is in one file:

**Database Models:**
- `User` - User accounts with password hashing, roles relationship
- `Role` - Role definitions with JSON-stored permissions
- `Campaign` - Marketing campaigns with user ownership
- `Influencer` - Influencer profiles linked to campaigns
- `Content` - Content items posted by influencers
- Association tables: `user_roles` (many-to-many), `campaign_users` (many-to-many)

**Authentication & Authorization:**
- JWT token-based auth with 24-hour expiration
- `@token_required` decorator - validates JWT token, attaches `current_user` to request
- `@role_required('RoleName')` decorator - checks user has specified role(s)
- Password hashing uses Werkzeug's `generate_password_hash`/`check_password_hash`

**Authorization Patterns:**
- Campaign routes filter by ownership: users see only their campaigns unless Admin
- Admin users (with role 'Admin') can access all resources
- User management endpoints require Admin role
- Self-service allowed: users can update their own profiles

### Frontend Structure

**Entry Point:** `frontend/src/index.js` wraps App with `AuthProvider`

**Main Components:**
- `App.js` - React Router setup with routes
- `CampaignDashboard.js` - Main dashboard view listing campaigns
- `CampaignDetail.js` - Detailed view of single campaign with influencers, content, analytics
- `components/Login.js` - Authentication form
- `components/ProtectedRoute.js` - Route wrapper requiring authentication/roles
- `components/UserManagement.js` - Admin-only UI for managing users and roles
- `components/NewCampaign.js` - Campaign creation form
- `components/InfluencerList.js` - List view of influencers
- `components/InfluencerForm.js` - Add/edit influencer form

**State Management:**
- `contexts/AuthContext.js` - Global auth state with React Context
  - Manages JWT token in localStorage
  - Provides `useAuth()` hook with `user`, `login()`, `logout()`, role helpers
  - Injects token into Axios headers automatically
  - Role helper functions: `isAdmin()`, `isManager()`, `isViewer()`, `hasRole()`, `hasAnyRole()`

**API Communication:**
- All API calls use Axios with base URL `http://localhost:5000/api`
- Token automatically injected via axios defaults in AuthContext

### RBAC System

**Three Default Roles:**

1. **Admin** - Permissions: `["*"]` (full access)
   - Can view/edit all campaigns regardless of ownership
   - Can manage users (create, edit roles, delete)
   - Can manage role permissions

2. **Manager** - Permissions: `["campaigns.read", "campaigns.write", "campaigns.delete"]`
   - Can view/edit/delete own campaigns only
   - Cannot manage users or view others' campaigns

3. **Viewer** - Permissions: `["campaigns.read"]`
   - Read-only access to own campaigns
   - Cannot create/edit/delete campaigns

**Default Credentials:**
- Admin: `admin` / `admin123`
- Manager: `manager` / `manager123`

**Permission Enforcement:**
- Backend: Decorators and ownership checks in route handlers
- Frontend: Conditional rendering based on `isAdmin()`, `isManager()`, role checks
- Protected routes use `<ProtectedRoute requiredRole="Admin">` for role-specific access

## Key Implementation Patterns

### Adding Protected Routes

**Backend:**
```python
@app.route('/api/resource', methods=['GET'])
@token_required  # Requires valid JWT
@role_required('Admin')  # Requires Admin role
def get_resource(current_user):
    # current_user is injected by @token_required
    # Check ownership if needed:
    if not current_user.has_role('Admin') and resource.user_id != current_user.id:
        return jsonify({'error': 'Forbidden'}), 403
```

**Frontend:**
```jsx
<ProtectedRoute path="/admin-only" requiredRole="Admin">
  <AdminComponent />
</ProtectedRoute>
```

### Campaign Ownership Pattern

Campaigns are filtered by ownership in the backend:
- Non-admin users: `Campaign.query.filter_by(user_id=current_user.id)`
- Admin users: `Campaign.query.all()` (sees everything)

### Role Permission Checking

**Backend:** Roles store permissions as JSON array strings. Use `user.has_role('RoleName')` or check admin with `user.has_role('Admin')`.

**Frontend:** Use `useAuth()` hook functions: `isAdmin()`, `hasRole('Manager')`, `hasAnyRole(['Admin', 'Manager'])`.

## Database Schema Notes

- SQLite database auto-created on first run
- No migrations system - schema changes require manual DB updates or rebuild
- User passwords never stored in plaintext (Werkzeug hashing)
- Many-to-many relationships use association tables
- Campaigns link to users as "owner" (user_id) and can have multiple assigned users

## Common Gotchas

- **CORS:** Backend enables CORS for all origins - tighten in production
- **SECRET_KEY:** Currently uses fallback value - must set in production via env variable
- **Token Storage:** Frontend stores JWT in localStorage (consider security implications)
- **No Backend Tests:** Test infrastructure exists on frontend only
- **Single File Backend:** All backend logic in `app.py` - consider splitting for larger features
- **SQLite Limitations:** Not suitable for production with concurrent writes

## Frontend Styling

- CSS files co-located with components (e.g., `CampaignDashboard.css`)
- Custom CSS styling (no UI framework like Material-UI or Tailwind)
- Recharts library used for analytics visualizations

## API Endpoint Summary

**Authentication (Public):**
- `POST /api/auth/login` - Login with username/password
- `GET /api/auth/me` - Get current user info (requires token)
- `POST /api/auth/refresh` - Refresh token (requires token)

**User Management (Admin only except GET own user):**
- `POST /api/users` - Create user
- `GET /api/users` - List all users
- `GET /api/users/<id>` - Get single user (self or admin)
- `PUT /api/users/<id>` - Update user (self or admin)
- `DELETE /api/users/<id>` - Delete user

**Role Management (Admin only):**
- `GET /api/roles` - List all roles
- `PUT /api/roles/<id>` - Update role permissions

**Campaign Management (Authenticated, ownership-filtered):**
- `GET /api/campaigns` - List campaigns (filtered by ownership)
- `POST /api/campaigns` - Create campaign
- `GET /api/campaigns/<id>` - Get campaign details
- `GET /api/campaigns/<id>/influencers` - Get campaign influencers
- `GET /api/campaigns/<id>/content` - Get campaign content
- `GET /api/campaigns/<id>/analytics` - Get campaign analytics
- `PUT /api/campaigns/<id>/assignments` - Update campaign user assignments

## Working with This Codebase

- Start both servers (backend on :5000, frontend on :3000) for development
- Backend changes require server restart (no hot reload)
- Frontend has hot reload enabled via Create React App
- Check `RBAC_IMPLEMENTATION_SUMMARY.md` for detailed RBAC documentation
- Authentication token expires after 24 hours
