# Influencer Master Schema Design

## Requirements Analysis

Based on your needs, we need to capture:
1. ✅ Name
2. ✅ Industries/Categories
3. ✅ Profile links (Instagram, YouTube, TikTok, etc.)
4. ✅ Following/Followers count per platform
5. ✅ Commercials (compensation/rates)
6. ✅ Brands worked with in the past
7. ✅ White Rivers Media relationship history

---

## Proposed Schema

### **1. Influencer (Master Table)**

```python
class Influencer(db.Model):
    """Master table for all influencers"""
    __tablename__ = 'influencer'

    # Primary Information
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120))
    phone = db.Column(db.String(20))

    # Profile & Branding
    profile_pic = db.Column(db.String(500))
    bio = db.Column(db.Text)

    # Categories (can be multiple - stored as JSON array)
    # Examples: ["Fashion", "Lifestyle", "Tech", "Fitness"]
    categories = db.Column(db.JSON, default=list)

    # Location
    city = db.Column(db.String(100))
    state = db.Column(db.String(100))
    country = db.Column(db.String(100), default='India')

    # Platform Handles & Followers
    instagram_handle = db.Column(db.String(100))
    instagram_followers = db.Column(db.Integer, default=0)
    instagram_url = db.Column(db.String(500))

    youtube_handle = db.Column(db.String(100))
    youtube_subscribers = db.Column(db.Integer, default=0)
    youtube_url = db.Column(db.String(500))

    tiktok_handle = db.Column(db.String(100))
    tiktok_followers = db.Column(db.Integer, default=0)
    tiktok_url = db.Column(db.String(500))

    twitter_handle = db.Column(db.String(100))
    twitter_followers = db.Column(db.Integer, default=0)
    twitter_url = db.Column(db.String(500))

    # Influencer Tier (auto-calculated based on max followers)
    # Nano: < 10K, Micro: 10K-100K, Macro: 100K-1M, Mega: > 1M
    tier = db.Column(db.String(50))

    # Commercials - Rate Card
    rate_per_post_instagram = db.Column(db.Float)
    rate_per_reel_instagram = db.Column(db.Float)
    rate_per_story_instagram = db.Column(db.Float)
    rate_per_video_youtube = db.Column(db.Float)
    rate_per_short_youtube = db.Column(db.Float)

    # Currency for rates
    currency = db.Column(db.String(10), default='INR')

    # Past Brand Collaborations (JSON array of brand names)
    # Example: ["Nike", "Adidas", "Puma", "Reebok"]
    past_brands = db.Column(db.JSON, default=list)

    # White Rivers Media Relationship
    worked_with_wrm = db.Column(db.Boolean, default=False)
    wrm_first_collab_date = db.Column(db.DateTime)
    wrm_last_collab_date = db.Column(db.DateTime)
    wrm_total_campaigns = db.Column(db.Integer, default=0)
    wrm_notes = db.Column(db.Text)  # Internal notes about the influencer

    # Status
    status = db.Column(db.String(50), default='active')
    # Options: active, inactive, blacklisted, pending_verification

    # Performance Rating (internal - 1-5 stars)
    performance_rating = db.Column(db.Float)

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey('user.id'))

    # Relationships
    campaign_assignments = db.relationship('CampaignInfluencer',
                                          back_populates='influencer',
                                          cascade='all, delete-orphan')
```

### **2. CampaignInfluencer (Join/Assignment Table)**

```python
class CampaignInfluencer(db.Model):
    """Links influencers to campaigns with campaign-specific details"""
    __tablename__ = 'campaign_influencer'

    id = db.Column(db.Integer, primary_key=True)
    campaign_id = db.Column(db.Integer, db.ForeignKey('campaign.id'), nullable=False)
    influencer_id = db.Column(db.Integer, db.ForeignKey('influencer.id'), nullable=False)

    # Campaign-specific details
    platform = db.Column(db.String(50), nullable=False)
    # Which platform for THIS campaign: Instagram, YouTube, TikTok, Twitter

    # Deliverables
    deliverables_count = db.Column(db.Integer, default=0)
    # Expected number of posts/videos

    content_type = db.Column(db.String(100))
    # Example: "3 Reels + 2 Stories + 1 Post"

    # Compensation for THIS campaign
    agreed_amount = db.Column(db.Float)
    compensation_type = db.Column(db.String(50))
    # Options: Paid, Barter, Affiliate, Mixed

    compensation_notes = db.Column(db.Text)
    # Example: "50% advance, 50% on completion"

    # Contract Timeline
    contract_start_date = db.Column(db.DateTime)
    contract_end_date = db.Column(db.DateTime)

    # Status of this assignment
    status = db.Column(db.String(50), default='pending')
    # Options: pending, active, in_progress, completed, cancelled, on_hold

    # Content tracking
    content_submitted = db.Column(db.Integer, default=0)
    content_approved = db.Column(db.Integer, default=0)
    content_published = db.Column(db.Integer, default=0)

    # Internal notes for this assignment
    notes = db.Column(db.Text)

    # Assignment metadata
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)
    assigned_by_user_id = db.Column(db.Integer, db.ForeignKey('user.id'))

    # Relationships
    campaign = db.relationship('Campaign', back_populates='campaign_influencers')
    influencer = db.relationship('Influencer', back_populates='campaign_assignments')
    content = db.relationship('Content', backref='assignment', cascade='all, delete-orphan')
```

### **3. Updated Content Model**

```python
class Content(db.Model):
    """Individual content pieces created by influencers"""
    __tablename__ = 'content'

    id = db.Column(db.Integer, primary_key=True)

    # Foreign Keys
    campaign_id = db.Column(db.Integer, db.ForeignKey('campaign.id'), nullable=False)
    influencer_id = db.Column(db.Integer, db.ForeignKey('influencer.id'), nullable=False)
    campaign_influencer_id = db.Column(db.Integer,
                                      db.ForeignKey('campaign_influencer.id'),
                                      nullable=False)

    # Content Details
    platform = db.Column(db.String(50), nullable=False)
    content_type = db.Column(db.String(50), nullable=False)
    # Options: Post, Reel, Story, Video, Short, Tweet

    url = db.Column(db.String(500))
    thumbnail = db.Column(db.String(500))
    caption = db.Column(db.Text)

    # Metrics
    views = db.Column(db.Integer, default=0)
    likes = db.Column(db.Integer, default=0)
    comments = db.Column(db.Integer, default=0)
    shares = db.Column(db.Integer, default=0)
    saves = db.Column(db.Integer, default=0)

    engagement_rate = db.Column(db.Float, default=0.0)
    # Formula: (likes + comments + shares) / followers * 100

    # Content Status
    status = db.Column(db.String(50), default='draft')
    # Options: draft, submitted, approved, published, rejected

    # Timestamps
    published_at = db.Column(db.DateTime)
    submitted_at = db.Column(db.DateTime)
    approved_at = db.Column(db.DateTime)
    last_metrics_update = db.Column(db.DateTime)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

### **4. Updated Campaign Model**

```python
class Campaign(db.Model):
    # ... existing fields remain the same ...

    # Updated Relationships
    campaign_influencers = db.relationship('CampaignInfluencer',
                                          back_populates='campaign',
                                          cascade='all, delete-orphan')

    # Keep direct content relationship for easier querying
    content = db.relationship('Content', backref='campaign', lazy=True)
```

---

## Benefits of This Schema

### 1. **Reusability**
- ✅ One influencer record can be assigned to multiple campaigns
- ✅ No data duplication
- ✅ Easy to track influencer history across campaigns

### 2. **Comprehensive Influencer Profile**
- ✅ Multi-platform support (Instagram, YouTube, TikTok, Twitter)
- ✅ Rate card for different content types
- ✅ Past brand collaborations history
- ✅ WRM relationship tracking

### 3. **Flexible Campaign Assignments**
- ✅ Each campaign can specify different platforms for same influencer
- ✅ Campaign-specific compensation and deliverables
- ✅ Track status per assignment
- ✅ Independent content tracking per campaign

### 4. **Powerful Querying**
```python
# Find all influencers who worked with Nike
influencers = Influencer.query.filter(
    Influencer.past_brands.contains(['Nike'])
).all()

# Find influencers never worked with WRM
new_influencers = Influencer.query.filter_by(worked_with_wrm=False).all()

# Find macro influencers in Fashion category
fashion_influencers = Influencer.query.filter(
    Influencer.tier == 'Macro',
    Influencer.categories.contains(['Fashion'])
).all()

# Get all campaigns for specific influencer
campaigns = CampaignInfluencer.query.filter_by(
    influencer_id=1
).all()
```

---

## Sample Data Structure

### Influencer Record Example:
```json
{
  "id": 1,
  "name": "Priya Sharma",
  "email": "priya@example.com",
  "phone": "+91-9876543210",
  "categories": ["Fashion", "Lifestyle", "Beauty"],
  "city": "Mumbai",
  "country": "India",

  "instagram_handle": "@priyasharma",
  "instagram_followers": 250000,
  "instagram_url": "https://instagram.com/priyasharma",

  "youtube_handle": "Priya Sharma Vlogs",
  "youtube_subscribers": 50000,
  "youtube_url": "https://youtube.com/@priyasharmavlogs",

  "tier": "Macro",

  "rate_per_post_instagram": 25000,
  "rate_per_reel_instagram": 35000,
  "rate_per_story_instagram": 10000,
  "currency": "INR",

  "past_brands": ["Nykaa", "Sugar Cosmetics", "Zara", "H&M"],

  "worked_with_wrm": true,
  "wrm_first_collab_date": "2023-06-15",
  "wrm_last_collab_date": "2024-11-20",
  "wrm_total_campaigns": 3,
  "wrm_notes": "Great engagement rates, professional, delivers on time",

  "performance_rating": 4.5,
  "status": "active"
}
```

### Campaign-Influencer Assignment Example:
```json
{
  "id": 1,
  "campaign_id": 5,
  "influencer_id": 1,
  "platform": "Instagram",
  "deliverables_count": 5,
  "content_type": "3 Reels + 2 Posts",
  "agreed_amount": 150000,
  "compensation_type": "Paid",
  "compensation_notes": "50% advance paid, 50% on completion",
  "contract_start_date": "2024-12-01",
  "contract_end_date": "2024-12-31",
  "status": "active",
  "content_submitted": 2,
  "content_approved": 2,
  "content_published": 1
}
```

---

## CSV Import Template for Your Existing Data

You can prepare your data in this format:

```csv
name,email,phone,categories,city,country,instagram_handle,instagram_followers,youtube_handle,youtube_subscribers,tiktok_handle,tiktok_followers,rate_per_post_instagram,rate_per_reel_instagram,past_brands,worked_with_wrm,wrm_notes,status
"Priya Sharma","priya@example.com","+919876543210","Fashion|Lifestyle|Beauty","Mumbai","India","@priyasharma",250000,"Priya Sharma Vlogs",50000,"",0,25000,35000,"Nykaa|Sugar|Zara|H&M",TRUE,"Great engagement",active
```

**Notes:**
- Multiple categories separated by `|`
- Multiple brands separated by `|`
- worked_with_wrm: TRUE/FALSE
- Platform followers as integers
- Rates as decimals (INR)

---

## Implementation Next Steps

1. ✅ Create new models in app.py
2. ✅ Create database migration
3. ✅ Build import script for your CSV data
4. ✅ Create CRUD API endpoints
5. ✅ Build frontend UI

Ready to proceed with implementation!
