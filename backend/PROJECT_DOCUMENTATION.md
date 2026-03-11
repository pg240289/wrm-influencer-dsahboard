# WRM Influencer Dashboard - Backend Documentation

Complete technical documentation for the backend API, database models, services, and architecture.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Project Structure](#2-project-structure)
3. [Getting Started](#3-getting-started)
4. [Database Models](#4-database-models)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [RBAC System](#6-rbac-system)
7. [API Endpoints](#7-api-endpoints)
8. [Social Media Integration](#8-social-media-integration)
9. [Cron Job - Metrics Service](#9-cron-job---metrics-service)
10. [Helper Functions](#10-helper-functions)
11. [Environment Configuration](#11-environment-configuration)
12. [Deployment Guide](#12-deployment-guide)

---

## 1. Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Flask (Python) |
| ORM | SQLAlchemy |
| Database | MySQL (via PyMySQL) |
| Auth | JWT (PyJWT) with 24-hour expiry |
| Email | Flask-Mail (SMTP) |
| Scheduler | APScheduler |
| Instagram Scraper | Apify Client |
| Password Hashing | Werkzeug (scrypt) |

---

## 2. Project Structure

```
backend/
├── app.py                      # Main Flask app (all models, routes, helpers)
├── social_metrics_service.py   # Cron job for fetching social media metrics
├── requirements.txt            # Python dependencies
├── .env                        # Environment variables (not committed)
├── .env.example                # Environment template
├── activate_admin.py           # Script to activate admin user
├── migrate_to_mysql.py         # SQLite to MySQL migration script
├── setup_mysql.bat             # Windows MySQL setup
├── setup_mysql.sh              # Linux/Mac MySQL setup
└── social_metrics.log          # Cron job log file
```

---

## 3. Getting Started

### Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### Configure Environment
```bash
cp .env.example .env
# Edit .env with your database credentials, API keys, etc.
```

### Run the Backend
```bash
python app.py                          # Development server on :5000
```

### Run with Gunicorn (Production)
```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Default Login Credentials
| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin123 |
| Campaign Manager | manager | manager123 |

---

## 4. Database Models

### Entity Relationship Overview

```
User ──M:M── Role           (via user_roles)
User ──M:M── Campaign       (via campaign_users)
Campaign ──1:M── CampaignInfluencer ──1:M── Content
Influencer ──1:M── CampaignInfluencer
Influencer ──1:M── SocialAccountToken
Brand ──1:M── Campaign
Brand ──M:M── Category      (via brand_categories)
Country ──1:M── State ──1:M── City
```

### User
Stores user accounts with authentication and role info.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer (PK) | Auto-increment |
| username | String(80), unique | Login username |
| email | String(120), unique | User email |
| password_hash | String(255) | Werkzeug scrypt hash |
| first_name | String(80) | First name |
| last_name | String(80) | Last name |
| is_active | Boolean | Account active status |
| created_at | DateTime | Account creation time |
| last_login | DateTime | Last login timestamp |
| invite_token | String(255) | Invitation token for influencers |
| invite_token_expires | DateTime | Token expiry (7 days) |

**Relationships:** roles (M:M), assigned_campaigns (M:M), influencer_profile (1:1)

### Role
Defines roles with JSON-stored permissions.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer (PK) | Auto-increment |
| name | String(50), unique | Role name |
| description | String(200) | Role description |
| permissions | Text | JSON array of permission strings |

### Campaign
Marketing campaigns linked to brands and influencers.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer (PK) | Auto-increment |
| campaign_name | String(200) | Campaign title |
| objective | String(200) | Campaign goal |
| brand_id | Integer (FK) | Associated brand |
| description | Text | Detailed description |
| status | String(50) | active, completed, paused, etc. |
| start_date | DateTime | Campaign start |
| end_date | DateTime | Campaign end (nullable) |
| created_at | DateTime | Creation timestamp |
| created_by_user_id | Integer (FK) | Creator user |

### Influencer
Master table for influencer profiles (reusable across campaigns).

| Column | Type | Description |
|--------|------|-------------|
| id | Integer (PK) | Auto-increment |
| name | String(200) | Full name |
| email | String(200) | Contact email |
| phone | String(50) | Phone number |
| profile_pic | String(500) | Profile picture URL |
| bio | Text | Bio/description |
| categories | Text (JSON) | Interest categories |
| country_id, state_id, city_id | Integer (FK) | Location |
| instagram_handle | String(200) | IG username |
| instagram_followers | Integer | IG follower count |
| instagram_url | String(500) | IG profile URL |
| youtube_handle | String(200) | YT channel name |
| youtube_subscribers | Integer | YT subscriber count |
| youtube_url | String(500) | YT channel URL |
| facebook_handle | String(200) | FB page name |
| facebook_followers | Integer | FB follower count |
| twitter_handle | String(200) | X/Twitter handle |
| twitter_followers | Integer | X follower count |
| linkedin_handle | String(200) | LinkedIn profile |
| linkedin_followers | Integer | LinkedIn followers |
| rate_per_post_instagram | Float | Rate card: IG post |
| rate_per_reel_instagram | Float | Rate card: IG reel |
| rate_per_story_instagram | Float | Rate card: IG story |
| rate_per_video_youtube | Float | Rate card: YT video |
| rate_per_short_youtube | Float | Rate card: YT short |
| rate_per_post_facebook | Float | Rate card: FB post |
| rate_per_reel_facebook | Float | Rate card: FB reel |
| rate_per_story_facebook | Float | Rate card: FB story |
| rate_per_post_linkedin | Float | Rate card: LinkedIn post |
| currency | String(10) | INR, USD, EUR, GBP |
| tier | String(20) | Auto-calculated: Nano/Micro/Macro/Mega |
| past_brands | Text (JSON) | Previous brand collabs |
| worked_with_wrm | Boolean | Has worked with WRM |
| wrm_notes | Text | Internal notes |
| status | String(50) | active, inactive, blacklisted |
| performance_rating | Float | Rating (0-5) |
| user_id | Integer (FK) | Linked user account |

**Tier Calculation:**
- Nano: < 10,000 followers
- Micro: 10,000 - 100,000
- Macro: 100,000 - 1,000,000
- Mega: > 1,000,000

### CampaignInfluencer
Links influencers to campaigns with campaign-specific details.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer (PK) | Auto-increment |
| campaign_id | Integer (FK) | Campaign reference |
| influencer_id | Integer (FK) | Influencer reference |
| platform | String(50) | Instagram, YouTube, Facebook, etc. |
| link | String(500) | Social media post/video URL |
| deliverables_count | Integer | Number of deliverables |
| content_type | String(100) | Expected content type |
| agreed_amount | Float | Compensation amount |
| compensation_type | String(50) | Payment type |
| status | String(50) | pending/active/in_progress/completed/cancelled |
| assigned_at | DateTime | Assignment timestamp |
| assigned_by_user_id | Integer (FK) | Who assigned |

### Content
Individual content pieces with engagement metrics.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer (PK) | Auto-increment |
| campaign_id | Integer (FK) | Campaign |
| influencer_id | Integer (FK) | Influencer |
| campaign_influencer_id | Integer (FK) | Assignment |
| platform | String(50) | Platform name |
| content_type | String(50) | Post, Reel, Story, Video, Short, Tweet |
| url | String(500) | Content URL |
| thumbnail | String(500) | Thumbnail image URL |
| caption | Text | Post caption |
| views | Integer | View count |
| likes | Integer | Like count |
| comments | Integer | Comment count |
| shares | Integer | Share count |
| saves | Integer | Save count |
| engagement_rate | Float | Calculated engagement % |
| status | String(50) | draft/submitted/approved/published/rejected |
| published_at | DateTime | When published on platform |
| last_metrics_update | DateTime | Last metrics refresh |

### SocialAccountToken
Stores OAuth tokens for influencer social media accounts.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer (PK) | Auto-increment |
| influencer_id | Integer (FK) | Influencer |
| platform | String(50) | instagram, facebook |
| access_token | Text | OAuth access token |
| expires_at | DateTime | Token expiry |
| platform_user_id | String(200) | Platform user ID |
| platform_username | String(200) | Platform username |
| is_active | Boolean | Active status |

### Location Models (Country, State, City)
Hierarchical master data. Pre-seeded with India (20 states, 100+ cities).

### Category
Master categories for influencers and brands. 24 default categories seeded on init.

### Brand
Brand profiles linked to campaigns and categories.

---

## 5. Authentication & Authorization

### JWT Token Flow

```
1. User sends POST /api/auth/login with username & password
2. Backend validates credentials, generates JWT (24-hour expiry)
3. JWT payload: { user_id, username, roles[], exp, iat }
4. Frontend stores token in localStorage
5. All subsequent requests include: Authorization: Bearer <token>
6. Backend validates token via @token_required decorator
```

### Decorators

**@token_required**
- Extracts JWT from `Authorization: Bearer <token>` header
- Validates token, checks user is active
- Injects `current_user` as first argument to route handler

**@role_required('Admin', 'Campaign Manager', ...)**
- Includes @token_required behavior
- Additionally checks if user has any of the specified roles
- Returns 403 if role check fails

### Influencer Invitation Flow

```
1. Admin/Manager creates influencer with email
2. System auto-creates User account with Influencer role
3. Invite email sent with set-password link (7-day expiry)
4. Influencer clicks link → verifies token → sets password
5. Influencer can now login and access self-service endpoints
```

---

## 6. RBAC System

### Default Roles

| Role | Permissions | Description |
|------|------------|-------------|
| **Admin** | `["*"]` | Full system access. Cannot be modified or deleted. |
| **Campaign Manager** | `["campaigns.read", "campaigns.write", "campaigns.delete", "influencers.read", "influencers.write"]` | Create/manage campaigns and influencers |
| **Campaign Executor** | `["campaigns.read", "influencers.read", "influencers.assign", "influencers.links"]` | View campaigns, assign influencers, manage links |
| **Influencer** | `["influencer.self.read", "influencer.self.write", "campaigns.self.read"]` | Self-service: view own campaigns, update profile, manage own content |

### Access Control Matrix

| Action | Admin | Campaign Manager | Campaign Executor | Influencer |
|--------|-------|-----------------|-------------------|------------|
| View all campaigns | Yes | Assigned only | Assigned only | Own only |
| Create campaign | Yes | Yes | No | No |
| Delete campaign | Yes | Yes | No | No |
| Manage users | Yes | No | No | No |
| Manage roles | Yes | No | No | No |
| Create influencer | Yes | Yes | No | No |
| Assign influencer to campaign | Yes | Yes | Yes | No |
| Add content links | Yes | Yes | Yes | Own only |
| View analytics | Yes | Yes | Yes | Own only |
| Update own profile | Yes | Yes | Yes | Yes |

---

## 7. API Endpoints

### Authentication (Public)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | No | Login with username/password, returns JWT |
| GET | `/api/auth/me` | Token | Get current user info |
| POST | `/api/auth/refresh` | Token | Refresh JWT token |
| GET | `/api/auth/verify-invite` | No | Verify invitation token (query: `token`) |
| POST | `/api/auth/set-password` | No | Set password via invite token |

### User Management (Admin)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/users` | Admin | Create user (auto-generates password, sends email) |
| GET | `/api/users` | Admin | List all users |
| GET | `/api/users/active` | Token | List active users (for campaign assignment) |
| GET | `/api/users/<id>` | Token | Get user (self or admin) |
| PUT | `/api/users/<id>` | Token | Update user (self or admin) |
| DELETE | `/api/users/<id>` | Admin | Delete user |

### Role Management (Admin)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/roles` | Admin | List all roles |
| POST | `/api/roles` | Admin | Create new role |
| PUT | `/api/roles/<id>` | Admin | Update role (Admin role protected) |
| DELETE | `/api/roles/<id>` | Admin | Delete role (must have no users) |

### Campaign Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/campaigns` | Admin, Campaign Manager | Create campaign |
| GET | `/api/campaigns` | Token | List campaigns (filtered by role/assignment) |
| GET | `/api/campaigns/<id>` | Token | Get campaign detail with influencers & content |
| PUT | `/api/campaigns/<id>/assignments` | Token | Update campaign user assignments |
| GET | `/api/campaigns/<id>/influencers` | Token | List campaign influencers |
| POST | `/api/campaigns/<id>/influencers` | Admin, CM, CE | Assign influencer to campaign |
| PUT | `/api/campaigns/<id>/influencers/<aid>/link` | Admin, CM, CE | Update influencer link |
| DELETE | `/api/campaigns/<id>/influencers/<aid>` | Admin, CM | Remove influencer from campaign |

### Content Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/campaigns/<id>/influencers/<aid>/content` | Admin, CM, CE | Add content link |
| GET | `/api/campaigns/<id>/content` | Token | List campaign content |
| PUT | `/api/campaigns/<id>/content/<cid>` | Admin, CM, CE | Update content |
| DELETE | `/api/campaigns/<id>/content/<cid>` | Admin, CM, CE | Delete content |
| GET | `/api/campaigns/<id>/analytics` | Token | Campaign analytics (daily metrics, top performers) |

### Influencer Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/influencers` | Token | List influencers (with filters: search, tier, category, status, platforms, min/max followers) |
| GET | `/api/influencers/<id>` | Token | Get influencer detail |
| POST | `/api/influencers` | Admin, CM | Create influencer (auto-sends invite if email provided) |
| PUT | `/api/influencers/<id>` | Admin, CM | Update influencer |
| DELETE | `/api/influencers/<id>` | Admin | Soft delete (set inactive) |
| POST | `/api/influencers/<id>/invite` | Admin, CM | Send/resend invitation |
| POST | `/api/influencers/<id>/resend-invite` | Admin, CM | Resend invitation with new token |

### Influencer Self-Service

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/influencer/me` | Token | Get own profile |
| PUT | `/api/influencer/me` | Token | Update own profile (limited fields) |
| GET | `/api/influencer/me/campaigns` | Token | List assigned campaigns |
| GET | `/api/influencer/me/campaign/<id>` | Token | Get campaign detail with own assignments |
| GET | `/api/influencer/me/campaign/<id>/analytics` | Token | Own analytics in campaign |
| PUT | `/api/influencer/me/campaigns/<id>/links` | Token | Update own link in campaign |
| GET | `/api/influencer/me/assignments/<aid>` | Token | Get single assignment detail |
| POST | `/api/influencer/me/assignments/<aid>/content` | Token | Add content to assignment |
| PUT | `/api/influencer/me/content/<cid>` | Token | Update own content |
| DELETE | `/api/influencer/me/content/<cid>` | Token | Delete own content |

### Social Media OAuth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/instagram/connect` | Token | Get Instagram OAuth URL |
| POST | `/api/auth/facebook/connect` | Token | Get Facebook OAuth URL |
| GET | `/api/auth/instagram/callback` | Public | Instagram OAuth callback |
| GET | `/api/auth/facebook/callback` | Public | Facebook OAuth callback |
| GET | `/api/influencer/me/social-accounts` | Token | List connected social accounts |
| DELETE | `/api/influencer/me/social-accounts/<id>` | Token | Disconnect social account |
| POST | `/api/influencer/me/refresh-instagram-stats` | Token | Refresh IG followers/stats |
| POST | `/api/influencer/me/refresh-facebook-stats` | Token | Refresh FB followers/stats |
| POST | `/api/content/<cid>/refresh-metrics` | Token | Refresh content metrics from platform |

### Master Data

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET/POST/PUT/DELETE | `/api/countries` | Token / Admin,CM | Country CRUD |
| GET/POST/PUT/DELETE | `/api/states` | Token / Admin,CM | State CRUD (filter: `country_id`) |
| GET/POST/PUT/DELETE | `/api/cities` | Token / Admin,CM | City CRUD (filter: `state_id`) |
| GET/POST/PUT/DELETE | `/api/categories` | Token / Admin,CM | Category CRUD |
| GET/POST | `/api/brands` | Token / Admin,CM | Brand list & create |
| GET/PUT/DELETE | `/api/brands/<id>` | Token / Admin,CM / Admin | Brand detail, update, delete |

---

## 8. Social Media Integration

### Platform Support

| Platform | Method | Auth Required | Metrics Fetched |
|----------|--------|---------------|-----------------|
| **YouTube** | YouTube Data API v3 | API Key (`YOUTUBE_API_KEY`) | views, likes, comments |
| **Instagram** | Apify Post Scraper | API Token (`APIFY_API_TOKEN`) | views, likes, comments, saves, caption, thumbnail |
| **Facebook** | Graph API | OAuth Token (per influencer) | views, likes, comments, shares |
| **Twitter/X** | Twitter API v2 | Bearer Token (`TWITTER_BEARER_TOKEN`) | views, likes, comments, shares, saves |
| **LinkedIn** | LinkedIn API v2 | OAuth Token | likes, comments |

### Instagram via Apify (No OAuth Needed)

Instagram metrics are fetched using Apify's Instagram Post Scraper actor (`shu8hvrXbJbY3Eb9W`). This means:

- No influencer account authorization required
- Works with any public Instagram post/reel URL
- Only needs your `APIFY_API_TOKEN` from your Apify account
- Fetches: likes, comments, video play count, caption, thumbnail, content type

**Supported URL patterns:**
- `instagram.com/p/{shortcode}` (Posts)
- `instagram.com/reel/{shortcode}` (Reels)
- `instagram.com/tv/{shortcode}` (IGTV)

### Facebook/Instagram OAuth Flow

For features that require OAuth (Facebook metrics, Instagram account stats):

```
1. Influencer calls POST /api/auth/{platform}/connect
2. Backend creates OAuthState token (10-min expiry) for CSRF protection
3. Returns OAuth authorization URL
4. Influencer logs into platform and grants permissions
5. Platform redirects to GET /api/auth/{platform}/callback?code=...&state=...
6. Backend validates state token, exchanges code for access token
7. Stores token in SocialAccountToken table
8. Updates influencer followers/handle from API
9. Redirects to frontend with success/error parameter
```

---

## 9. Cron Job - Metrics Service

### File: `social_metrics_service.py`

A standalone service that periodically fetches engagement metrics for all content in active campaigns.

### How It Works

```
                    Runs twice daily (8 AM & 8 PM)
                              |
                              v
              ┌─────────────────────────────┐
              │  Get Active Campaigns        │
              │  (start_date <= now AND       │
              │   end_date >= now or null)    │
              └──────────────┬──────────────┘
                              │
                 ┌────────────┴────────────┐
                 v                         v
    ┌────────────────────┐    ┌────────────────────┐
    │ CampaignInfluencer │    │ Content Table       │
    │ records with links │    │ records with URLs   │
    └────────┬───────────┘    └────────┬───────────┘
             │                         │
             v                         v
    ┌────────────────────────────────────────┐
    │ Detect platform from URL               │
    │ Call appropriate fetcher:               │
    │  - YouTube  → YouTube Data API v3      │
    │  - Instagram → Apify Scraper           │
    │  - Facebook  → Graph API               │
    │  - Twitter   → Twitter API v2          │
    │  - LinkedIn  → LinkedIn API            │
    └────────────────┬───────────────────────┘
                     │
                     v
    ┌────────────────────────────────────────┐
    │ Update Content record with metrics:    │
    │  views, likes, comments, shares, saves │
    │  engagement_rate, last_metrics_update   │
    └────────────────────────────────────────┘
```

### Schedule

- **Frequency:** Twice daily at **8:00 AM** and **8:00 PM** (server time)
- **Initial Run:** Also runs immediately on service startup
- **Configurable:** Change `hour='8,20'` in `create_scheduler()` function

### Running the Service

```bash
# Test mode (run once)
python social_metrics_service.py --once

# Production mode (starts scheduler)
python social_metrics_service.py
```

### Systemd Service (Ubuntu)

Create `/etc/systemd/system/wrm-metrics-cron.service`:

```ini
[Unit]
Description=WRM Social Media Metrics Cron Service
After=network.target wrm-dashboard.service

[Service]
User=youruser
Group=youruser
WorkingDirectory=/var/www/html/wrm-influencer-dashboard/backend
ExecStart=/var/www/html/wrm-influencer-dashboard/backend/venv/bin/python social_metrics_service.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable wrm-metrics-cron
sudo systemctl start wrm-metrics-cron
sudo journalctl -u wrm-metrics-cron -f   # View logs
```

### Logging

- Log file: `backend/social_metrics.log`
- Also outputs to console (stdout)
- Logs each fetch attempt with success/failure status
- All attempts recorded in `metrics_fetch_log` database table

---

## 10. Helper Functions

### Authentication Helpers

| Function | Description |
|----------|-------------|
| `generate_token(user)` | Creates JWT with 24-hour expiry |
| `verify_token(token)` | Validates JWT, returns user if active |
| `get_current_user()` | Extracts user from Authorization header |
| `generate_random_password(length=12)` | Secure password with uppercase, lowercase, digit, special char |

### Email Helpers

| Function | Description |
|----------|-------------|
| `send_welcome_email(email, username, password)` | Sends credentials to new users |
| `send_invite_email(email, name, invite_token)` | Sends invitation link to influencers |

### OAuth Helpers

| Function | Description |
|----------|-------------|
| `generate_oauth_state(influencer_id, platform)` | Creates CSRF state token (10-min expiry) |
| `verify_oauth_state(state_token, platform)` | Validates and consumes state token |
| `exchange_code_for_token(code, redirect_uri)` | Exchanges FB auth code for long-lived token |
| `get_facebook_pages(access_token)` | Retrieves user's Facebook pages |
| `get_instagram_business_account(access_token)` | Finds IG Business Account from FB pages |

### Social Media Helpers

| Function | Description |
|----------|-------------|
| `detect_platform_from_url(url)` | Returns platform name from URL |
| `extract_youtube_video_id(url)` | Extracts video ID from various YT URL formats |
| `extract_tweet_id(url)` | Extracts tweet ID from twitter.com/x.com URLs |
| `extract_instagram_shortcode(url)` | Extracts shortcode from IG URLs |
| `fetch_youtube_video_metrics(url)` | Fetches YT metrics via API key |
| `fetch_instagram_post_metrics(url)` | Fetches IG metrics via Apify |
| `fetch_facebook_post_metrics(url, token)` | Fetches FB metrics via Graph API |
| `fetch_twitter_post_metrics(url)` | Fetches X metrics via API v2 |

### Database Initialization

| Function | Description |
|----------|-------------|
| `init_db()` | Creates tables, seeds roles, categories, locations, default users |
| `migrate_roles()` | Migrates old role names (Manager -> Campaign Manager, etc.) |

---

## 11. Environment Configuration

### Required Variables

```env
# Flask
SECRET_KEY=your-secret-key          # MUST change in production

# Database (MySQL)
DB_HOST=localhost
DB_PORT=3306
DB_NAME=wrm_influencer_dashboard
DB_USER=root
DB_PASSWORD=your-password

# Application URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000
ALLOWED_ORIGINS=http://localhost:3000
```

### Optional - Email (for sending invitations)

```env
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password       # Gmail App Password
MAIL_DEFAULT_SENDER=your-email@gmail.com
```

### Optional - Social Media API Keys

```env
# YouTube (API Key - no OAuth)
YOUTUBE_API_KEY=your-youtube-api-key

# Instagram via Apify (no OAuth needed)
APIFY_API_TOKEN=your-apify-token

# Facebook OAuth
FACEBOOK_APP_ID=your-app-id
FACEBOOK_APP_SECRET=your-app-secret
FACEBOOK_ACCESS_TOKEN=your-token
FACEBOOK_GRAPH_API_VERSION=v21.0
FACEBOOK_OAUTH_REDIRECT_URI=http://localhost:5000/api/auth/facebook/callback
INSTAGRAM_OAUTH_REDIRECT_URI=http://localhost:5000/api/auth/instagram/callback

# Twitter/X
TWITTER_BEARER_TOKEN=your-bearer-token

# LinkedIn
LINKEDIN_ACCESS_TOKEN=your-token

# Legacy (no longer needed for Instagram metrics)
INSTAGRAM_ACCESS_TOKEN=
INSTAGRAM_BUSINESS_ACCOUNT_ID=
```

---

## 12. Deployment Guide

### Ubuntu Server Setup

**1. Backend API Service**

```bash
cd /var/www/html/wrm-influencer-dashboard/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create `/etc/systemd/system/wrm-dashboard.service`:

```ini
[Unit]
Description=WRM Influencer Dashboard Backend
After=network.target

[Service]
User=youruser
Group=youruser
WorkingDirectory=/var/www/html/wrm-influencer-dashboard/backend
ExecStart=/var/www/html/wrm-influencer-dashboard/backend/venv/bin/gunicorn -w 4 -b 0.0.0.0:5000 app:app
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

**2. Metrics Cron Service**

Create `/etc/systemd/system/wrm-metrics-cron.service`:

```ini
[Unit]
Description=WRM Social Media Metrics Cron Service
After=network.target wrm-dashboard.service

[Service]
User=youruser
Group=youruser
WorkingDirectory=/var/www/html/wrm-influencer-dashboard/backend
ExecStart=/var/www/html/wrm-influencer-dashboard/backend/venv/bin/python social_metrics_service.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**3. Enable & Start Both Services**

```bash
sudo systemctl daemon-reload
sudo systemctl enable wrm-dashboard wrm-metrics-cron
sudo systemctl start wrm-dashboard wrm-metrics-cron
```

**4. Useful Commands**

```bash
# Check status
sudo systemctl status wrm-dashboard
sudo systemctl status wrm-metrics-cron

# Restart after code changes
sudo systemctl restart wrm-dashboard
sudo systemctl restart wrm-metrics-cron

# View logs
sudo journalctl -u wrm-dashboard -f
sudo journalctl -u wrm-metrics-cron -f
tail -f /var/www/html/wrm-influencer-dashboard/backend/social_metrics.log
```

---

## Error Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request (validation error, missing fields) |
| 401 | Unauthorized (missing/invalid/expired token) |
| 403 | Forbidden (insufficient role/permissions) |
| 404 | Resource not found |
| 500 | Server error |

All error responses return JSON: `{"error": "description"}`

---

*Last updated: March 2026*
