# Influencer Management & Metrics Tracking System - Implementation Plan

## 🎯 Executive Summary

This document outlines the comprehensive implementation plan for the **core functionality** of the Influencer Dashboard system:
1. **Influencer Master Management** (CRUD operations)
2. **Campaign-Influencer Assignment** (linking influencers to campaigns)
3. **Content Tracking** (posts/reels/videos by influencers)
4. **Automated Metrics Collection** (daily updates of engagement metrics)

---

## 📊 Current State Analysis

### Existing Database Schema

#### **Influencer Model** (Lines 158-185)
```python
- id (Primary Key)
- campaign_id (Foreign Key) ⚠️ ISSUE: Ties influencer to single campaign
- name
- username
- platform (Instagram, YouTube, TikTok, etc.)
- followers
- profile_pic
- tier (Nano, Micro, Macro, Mega)
```

**CRITICAL ISSUE**: Current schema has `campaign_id` as a direct foreign key, meaning:
- ❌ One influencer can only belong to ONE campaign
- ❌ Cannot reuse influencers across multiple campaigns
- ❌ Creates data duplication if same influencer works on multiple campaigns

#### **Content Model** (Lines 187-219)
```python
- id (Primary Key)
- campaign_id (Foreign Key)
- influencer_id (Foreign Key)
- platform
- content_type (Post, Reel, Video, Story)
- url
- thumbnail
- views, likes, comments, shares
- engagement_rate
- published_at
```

✅ Content model is correctly structured (many-to-many via campaign and influencer)

### Existing API Endpoints
- ✅ GET `/api/campaigns/<id>/influencers` - Lists influencers for a campaign
- ❌ No CRUD endpoints for influencer management
- ❌ No endpoint to add influencers to campaigns
- ❌ No endpoint for content management
- ❌ No automated metrics update system

---

## 🏗️ Architecture Decision: Schema Refactoring

### Problem
Current `Influencer` model has `campaign_id` as direct foreign key, preventing influencer reuse across campaigns.

### Solution: Many-to-Many Relationship

```python
# NEW APPROACH: Influencer Master Table + Join Table

class Influencer(db.Model):
    """Master table of all influencers (independent of campaigns)"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    username = db.Column(db.String(100), nullable=False, unique=True)
    email = db.Column(db.String(120))
    phone = db.Column(db.String(20))

    # Platform-specific accounts (JSON or separate table)
    instagram_handle = db.Column(db.String(100))
    instagram_followers = db.Column(db.Integer, default=0)
    youtube_handle = db.Column(db.String(100))
    youtube_subscribers = db.Column(db.Integer, default=0)
    tiktok_handle = db.Column(db.String(100))
    tiktok_followers = db.Column(db.Integer, default=0)

    profile_pic = db.Column(db.String(500))
    bio = db.Column(db.Text)
    category = db.Column(db.String(100))  # Fashion, Tech, Fitness, etc.
    tier = db.Column(db.String(50))  # Nano, Micro, Macro, Mega
    status = db.Column(db.String(50), default='active')  # active, inactive, blacklisted

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    campaigns = db.relationship('CampaignInfluencer', back_populates='influencer', cascade='all, delete-orphan')

# JOIN TABLE: Campaign-Influencer Assignment
class CampaignInfluencer(db.Model):
    """Links influencers to campaigns with campaign-specific details"""
    id = db.Column(db.Integer, primary_key=True)
    campaign_id = db.Column(db.Integer, db.ForeignKey('campaign.id'), nullable=False)
    influencer_id = db.Column(db.Integer, db.ForeignKey('influencer.id'), nullable=False)

    # Campaign-specific details for this influencer
    platform = db.Column(db.String(50), nullable=False)  # Which platform for THIS campaign
    deliverables = db.Column(db.Integer, default=0)  # Expected number of posts
    completed_deliverables = db.Column(db.Integer, default=0)
    compensation_amount = db.Column(db.Float)
    compensation_type = db.Column(db.String(50))  # Paid, Barter, Affiliate
    contract_start = db.Column(db.DateTime)
    contract_end = db.Column(db.DateTime)
    status = db.Column(db.String(50), default='pending')  # pending, active, completed, cancelled

    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)
    assigned_by_user_id = db.Column(db.Integer, db.ForeignKey('user.id'))

    # Relationships
    campaign = db.relationship('Campaign', back_populates='campaign_influencers')
    influencer = db.relationship('Influencer', back_populates='campaigns')
    content = db.relationship('Content', backref='campaign_influencer', cascade='all, delete-orphan')

# UPDATE Campaign Model
class Campaign(db.Model):
    # ... existing fields ...

    # Relationships (UPDATE)
    campaign_influencers = db.relationship('CampaignInfluencer', back_populates='campaign', cascade='all, delete-orphan')
    # Remove direct influencers relationship

# UPDATE Content Model
class Content(db.Model):
    # ... existing fields ...
    campaign_influencer_id = db.Column(db.Integer, db.ForeignKey('campaign_influencer.id'), nullable=False)
    # Keep campaign_id and influencer_id for easier querying
```

### Migration Strategy
1. Create new `Influencer` table (without campaign_id)
2. Create `CampaignInfluencer` join table
3. Migrate existing data from old schema to new schema
4. Update Content foreign keys
5. Drop old influencer table relationships

---

## 📋 Implementation Phases

### **Phase 1: Database Schema Refactoring** [CRITICAL - DO FIRST]

**Tasks:**
1. ✅ Create migration script to preserve existing data
2. ✅ Implement new Influencer model (master table)
3. ✅ Implement CampaignInfluencer join table
4. ✅ Update Campaign model relationships
5. ✅ Update Content model with campaign_influencer_id
6. ✅ Test migration with existing data
7. ✅ Update all to_dict() methods for API serialization

**Priority:** 🔴 CRITICAL - Must be done before any frontend work

---

### **Phase 2: Backend API - Influencer Master Management**

**Endpoints to Create:**

#### A. Influencer CRUD Operations

```
POST /api/influencers
- Create new influencer in master table
- Required role: Admin, Manager
- Body: name, username, email, instagram_handle, tier, etc.

GET /api/influencers
- List all influencers (with pagination & filters)
- Filter by: tier, category, platform, status, search term
- Required role: Any authenticated user
- Query params: ?search=, &tier=, &platform=, &status=, &page=, &limit=

GET /api/influencers/<id>
- Get single influencer details
- Include: list of campaigns they're part of, total content, aggregate metrics
- Required role: Any authenticated user

PUT /api/influencers/<id>
- Update influencer details
- Required role: Admin, Manager

DELETE /api/influencers/<id>
- Soft delete (set status to 'inactive')
- Required role: Admin only
- Validation: Cannot delete if active in any campaign
```

#### B. Campaign-Influencer Assignment

```
POST /api/campaigns/<campaign_id>/influencers
- Assign influencer(s) to campaign
- Required role: Admin, Manager, or campaign creator
- Body: [
    {
      influencer_id: 1,
      platform: 'Instagram',
      deliverables: 5,
      compensation_amount: 50000,
      compensation_type: 'Paid'
    }
  ]

GET /api/campaigns/<campaign_id>/influencers
- List all influencers assigned to campaign (ALREADY EXISTS - UPDATE)
- Include campaign-specific details from join table

PUT /api/campaigns/<campaign_id>/influencers/<influencer_id>
- Update campaign-influencer assignment details
- Update deliverables, status, compensation, etc.

DELETE /api/campaigns/<campaign_id>/influencers/<influencer_id>
- Remove influencer from campaign
- Validation: Check if content exists, handle appropriately
```

#### C. Influencer Search & Discovery

```
GET /api/influencers/search
- Advanced search with filters
- Filters: tier, category, min_followers, max_followers, platform, availability
- Return: influencers NOT currently assigned to specified campaign

GET /api/influencers/available
- Get influencers available for assignment
- Filter out those already in the campaign
```

**Priority:** 🟡 HIGH - Required before frontend can function

---

### **Phase 3: Backend API - Content Management**

**Endpoints to Create:**

```
POST /api/campaigns/<campaign_id>/influencers/<influencer_id>/content
- Add content for specific influencer in campaign
- Required role: Admin, Manager
- Body: platform, content_type, url, published_at

GET /api/content/<id>
- Get single content item details

PUT /api/content/<id>
- Update content metrics (views, likes, comments, etc.)
- Can be called by automated script or manually
- Calculate and update engagement_rate

DELETE /api/content/<id>
- Remove content item
- Required role: Admin, Manager

GET /api/campaigns/<campaign_id>/content
- List all content for campaign (ALREADY EXISTS - may need update)

GET /api/influencers/<id>/content
- List all content created by influencer (across all campaigns)
```

**Priority:** 🟡 HIGH - Required for metrics tracking

---

### **Phase 4: Automated Metrics Collection System**

**Architecture:**

```
Option 1: Scheduled Background Job (Recommended)
- Use APScheduler or Celery
- Run daily at specified time (e.g., 2 AM)
- Fetch latest metrics from platform APIs
- Update Content table

Option 2: Manual Trigger Endpoint
- POST /api/metrics/update
- Admin-only endpoint
- Trigger metrics update on-demand

Option 3: Webhook-based (Advanced)
- Receive real-time updates from platform webhooks
```

**Implementation Plan:**

1. **Platform API Integration**
   - Instagram Graph API (requires Business account)
   - YouTube Data API
   - TikTok API
   - Fallback: Web scraping (less reliable, use cautiously)

2. **Metrics Update Service**
   ```python
   class MetricsUpdateService:
       def update_all_content_metrics(self):
           # Get all content published in last 30 days
           # For each content item:
           #   - Fetch latest metrics from platform API
           #   - Update views, likes, comments, shares
           #   - Calculate engagement_rate
           #   - Log update timestamp

       def update_content_metrics(self, content_id):
           # Update single content item

       def update_campaign_metrics(self, campaign_id):
           # Update all content in campaign
   ```

3. **Scheduler Setup**
   ```python
   from apscheduler.schedulers.background import BackgroundScheduler

   scheduler = BackgroundScheduler()
   scheduler.add_job(
       func=MetricsUpdateService.update_all_content_metrics,
       trigger='cron',
       hour=2,  # Run at 2 AM daily
       id='daily_metrics_update'
   )
   scheduler.start()
   ```

4. **Error Handling & Logging**
   - Log all API calls and responses
   - Handle rate limits gracefully
   - Retry failed updates
   - Alert on persistent failures

**Priority:** 🟢 MEDIUM - Can be implemented after core CRUD is working

---

### **Phase 5: Frontend - Influencer Master Management UI**

**Components to Build:**

#### A. Influencer List Page (`/influencers`)
```
Route: /influencers
Component: InfluencerList
Features:
- Table view with columns: Avatar, Name, Username, Tier, Platforms, Followers, Status, Actions
- Search bar (by name/username)
- Filters: Tier, Category, Platform, Status
- Sort by: Followers, Name, Date Added
- Pagination
- Actions: View, Edit, Delete
- "Add New Influencer" button (Admin/Manager only)
```

#### B. Add/Edit Influencer Form
```
Component: InfluencerForm
Features:
- Personal Info: Name, Email, Phone
- Platform Handles: Instagram, YouTube, TikTok (with follower counts)
- Profile: Bio, Category, Tier, Profile Picture Upload
- Status: Active/Inactive
- Validation: Required fields, unique username
- Success/Error notifications
```

#### C. Influencer Detail Page (`/influencers/:id`)
```
Component: InfluencerDetail
Features:
- Header: Avatar, Name, Username, Tier, Status
- Platform Stats: Instagram/YouTube/TikTok followers
- Bio & Category
- Campaigns Section: List of campaigns they're part of
- Content Section: All content created by this influencer
- Performance Metrics: Total views, likes, engagement across campaigns
- Edit button (Admin/Manager only)
```

**Priority:** 🟡 HIGH - Core UI for influencer management

---

### **Phase 6: Frontend - Campaign-Influencer Assignment**

**Updates to Existing Campaign Flow:**

#### A. Update NewCampaign Component
```
Add New Section: "Assign Influencers"
- Search/filter influencers from master list
- Multi-select influencer cards
- For each selected influencer, specify:
  * Platform (if they're on multiple)
  * Deliverables (expected posts)
  * Compensation details
- Preview of selected influencers before campaign creation
```

#### B. Campaign Detail Page Updates
```
Add/Update Section: "Influencers & Performance"
- Table of assigned influencers with:
  * Avatar, Name, Platform
  * Deliverables (e.g., "3/5 completed")
  * Total engagement (views, likes)
  * Status badge
  * Actions: View content, Edit assignment, Remove
- "Add Influencer" button to assign more influencers
- Modal/drawer for adding influencers to existing campaign
```

#### C. Influencer Assignment Modal
```
Component: AssignInfluencerModal
Features:
- Search available influencers
- Filter: Show only those not already in campaign
- Select influencer
- Form: Platform, Deliverables, Compensation
- Submit to assign
```

**Priority:** 🟡 HIGH - Integrates influencers into campaign workflow

---

### **Phase 7: Frontend - Content Tracking UI**

**Components to Build:**

#### A. Add Content Form (in Campaign Detail)
```
Component: AddContentForm
Features:
- Select Influencer (from campaign's assigned influencers)
- Platform (auto-filled from assignment)
- Content Type (Post, Reel, Video, Story)
- URL to content
- Published Date
- Initial metrics (optional - can be auto-fetched)
```

#### B. Content List View
```
Display in Campaign Detail Page:
- Table/Grid of all content
- Columns: Thumbnail, Influencer, Platform, Type, Published, Views, Likes, Comments, Engagement Rate
- Sort by metrics
- Filter by influencer, platform, date range
- Click to view full content details
```

#### C. Content Detail Modal
```
Component: ContentDetailModal
Features:
- Display thumbnail/preview
- Show all metrics with trend indicators
- Link to original content URL
- Edit metrics button (Admin/Manager)
- Delete button (Admin/Manager)
```

**Priority:** 🟡 HIGH - Essential for tracking campaign performance

---

### **Phase 8: Frontend - Analytics & Reporting**

**Enhanced Analytics Dashboard:**

```
Campaign Analytics Updates:
- Influencer Comparison Chart: Compare performance across influencers
- Platform Breakdown: Performance by platform
- Content Type Analysis: Which content types perform best
- Timeline View: Engagement over time
- Top Performers: Best performing influencers and content
- Deliverables Progress: Completion rate per influencer
```

**Priority:** 🟢 MEDIUM - Adds value but not blocking

---

### **Phase 9: Automated Metrics Update - Admin UI**

**Admin Control Panel:**

```
Component: MetricsManagement (/admin/metrics)
Features:
- View last update timestamp
- "Update Now" button to trigger manual update
- Update logs table: Date, Duration, Success/Failures
- Schedule configuration (if using scheduler)
- Platform API status indicators
- Failed updates list with retry option
```

**Priority:** 🔵 LOW - Can be added after automation works

---

## 🔄 Data Flow Diagrams

### Campaign Creation with Influencers
```
1. User creates campaign (basic details)
   ↓
2. Campaign saved to database
   ↓
3. User searches/selects influencers from master list
   ↓
4. For each influencer, user specifies campaign-specific details
   ↓
5. CampaignInfluencer records created (join table)
   ↓
6. Campaign now has assigned influencers
   ↓
7. Content can be added for each campaign-influencer pair
```

### Content Tracking & Metrics Update
```
1. Content created (manually via UI or bulk import)
   ↓
2. Content saved with initial metrics (or 0)
   ↓
3. Daily scheduler runs at 2 AM
   ↓
4. For each content item:
   - Fetch latest metrics from platform API
   - Update database record
   - Calculate new engagement rate
   ↓
5. Updated metrics visible in dashboard
```

---

## 🎯 Recommended Implementation Order

### Week 1: Foundation
1. **Day 1-2**: Schema refactoring + migration
2. **Day 3-4**: Influencer CRUD API endpoints
3. **Day 5**: Campaign-Influencer assignment API

### Week 2: Core Features
1. **Day 1-2**: Content management API
2. **Day 3**: Influencer List UI
3. **Day 4**: Add/Edit Influencer Form
4. **Day 5**: Update NewCampaign with influencer assignment

### Week 3: Integration & Automation
1. **Day 1-2**: Update Campaign Detail with influencers section
2. **Day 3**: Content tracking UI
3. **Day 4-5**: Automated metrics collection system

### Week 4: Polish & Testing
1. **Day 1-2**: Analytics enhancements
2. **Day 3**: Admin metrics management UI
3. **Day 4-5**: Testing, bug fixes, documentation

---

## 🚨 Critical Decisions Needed

### 1. **Schema Migration**
**Question**: Do you have existing influencer data that needs migration?
- If YES: We'll create careful migration script
- If NO: We can do clean schema replacement

### 2. **Platform API Access**
**Question**: Do you have API access/credentials for:
- Instagram Graph API?
- YouTube Data API?
- TikTok API?
- If NO: Should we build manual entry system first, add API integration later?

### 3. **Metrics Update Frequency**
**Question**: How often should metrics update?
- Daily (recommended for most use cases)
- Multiple times per day (for active campaigns)
- On-demand only (manual trigger)

### 4. **Influencer Discovery**
**Question**: How will influencers be added to the system?
- Manual entry by admins
- Bulk CSV import
- API integration with influencer discovery platforms
- Self-service (influencers can apply/register)

---

## 📝 Next Steps

**Immediate Action Required:**
1. ✅ Review this implementation plan
2. ✅ Approve schema refactoring approach
3. ✅ Answer critical decisions above
4. ✅ Begin Phase 1: Database Schema Refactoring

**Once Approved:**
- I will start with schema refactoring and migration
- Create all backend API endpoints in Phase 2
- Build frontend components incrementally

---

## 📊 Success Metrics

### Phase 1 Complete:
- ✅ New schema deployed without data loss
- ✅ All relationships working correctly
- ✅ Existing campaign data preserved

### Phase 2-3 Complete:
- ✅ Can create/edit/delete influencers via API
- ✅ Can assign influencers to campaigns
- ✅ Can add content for campaign-influencer pairs

### Phase 4 Complete:
- ✅ Automated metrics update running daily
- ✅ Metrics successfully fetched from platform APIs
- ✅ Error handling and logging in place

### Phase 5-7 Complete:
- ✅ Full UI for influencer management
- ✅ Campaign creation includes influencer assignment
- ✅ Content tracking visible in dashboard

### Phase 8-9 Complete:
- ✅ Enhanced analytics showing influencer performance
- ✅ Admin can monitor and control metrics updates

---

*This is the core system that will make your Influencer Dashboard fully functional. Let me know your approval and answers to critical decisions, and we'll begin implementation immediately.*
