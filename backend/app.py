from flask import Flask, jsonify, request, redirect as flask_redirect
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail, Message
from datetime import datetime, timedelta
from functools import wraps
import random
import string
import jwt
import json
import uuid
from werkzeug.security import generate_password_hash, check_password_hash
import os
import re
import requests as http_requests
from dotenv import load_dotenv

load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app, supports_credentials=True)

# Configure MySQL database using environment variables
db_host = os.getenv('DB_HOST', 'localhost')
db_port = os.getenv('DB_PORT', '3306')
db_user = os.getenv('DB_USER', 'root')
db_password = os.getenv('DB_PASSWORD', '')
db_name = os.getenv('DB_NAME', 'wrm_influencer_dashboard')

# Application URLs
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:5000')

app.config['SQLALCHEMY_DATABASE_URI'] = f'mysql+pymysql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-change-in-production')
app.config['JWT_EXPIRATION_DELTA'] = timedelta(hours=24)

# Configure email settings
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'True') == 'True'
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME', '')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD', '')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER', os.getenv('MAIL_USERNAME', ''))

# Initialize database and mail
db = SQLAlchemy(app)
mail = Mail(app)

# ==================== DATABASE MODELS ====================

# Association table for many-to-many relationship between User and Role
user_roles = db.Table('user_roles',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('role_id', db.Integer, db.ForeignKey('role.id'), primary_key=True)
)

# Association table for many-to-many relationship between User and Campaign
campaign_users = db.Table('campaign_users',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('campaign_id', db.Integer, db.ForeignKey('campaign.id'), primary_key=True)
)

class Role(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.String(200))
    permissions = db.Column(db.Text)  # JSON string of permissions
    
    def to_dict(self):
        try:
            permissions_list = json.loads(self.permissions) if self.permissions else []
        except:
            permissions_list = []
        
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'permissions': permissions_list
        }

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(100))
    last_name = db.Column(db.String(100))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    invite_token = db.Column(db.String(255), unique=True, nullable=True)
    invite_token_expires = db.Column(db.DateTime, nullable=True)
    invited_at = db.Column(db.DateTime, nullable=True)

    # Relationships
    roles = db.relationship('Role', secondary=user_roles, lazy='subquery', backref=db.backref('users', lazy=True))
    assigned_campaigns = db.relationship('Campaign', secondary=campaign_users, lazy='subquery', backref=db.backref('assigned_users', lazy=True))
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def has_role(self, role_name):
        return any(role.name == role_name for role in self.roles)
    
    def has_permission(self, permission):
        for role in self.roles:
            if role.permissions and permission in role.permissions:
                return True
        return False
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'is_active': self.is_active,
            'roles': [role.name for role in self.roles],
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'last_login': self.last_login.strftime('%Y-%m-%d %H:%M:%S') if self.last_login else None,
            'influencer_profile_id': self.influencer_profile.id if self.influencer_profile else None
        }

class Campaign(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    campaign_name = db.Column(db.String(200), nullable=False)
    objective = db.Column(db.String(200), nullable=False)
    brand_id = db.Column(db.Integer, db.ForeignKey('brand.id'), nullable=False)
    description = db.Column(db.Text)
    status = db.Column(db.String(50), nullable=False)
    start_date = db.Column(db.DateTime, nullable=False)
    end_date = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)  # Campaign creator

    # Relationships
    brand = db.relationship('Brand', backref='campaigns')
    campaign_influencers = db.relationship('CampaignInfluencer', back_populates='campaign', cascade='all, delete-orphan')
    content = db.relationship('Content', backref='campaign', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'campaign_name': self.campaign_name,
            'objective': self.objective,
            'brand_id': self.brand_id,
            'brand_name': self.brand.name if self.brand else None,
            'description': self.description,
            'status': self.status,
            'start_date': self.start_date.strftime('%Y-%m-%d'),
            'end_date': self.end_date.strftime('%Y-%m-%d') if self.end_date else None,
            'created_at': self.created_at.strftime('%Y-%m-%d'),
            'created_by_user_id': self.created_by_user_id,
            'assigned_user_ids': [user.id for user in self.assigned_users],
            'num_influencers': len(self.campaign_influencers),
            'total_content': len(self.content),
            'total_views': sum([c.views for c in self.content]),
            'total_likes': sum([c.likes for c in self.content]),
            'total_comments': sum([c.comments for c in self.content]),
        }

    def to_dict_detailed(self):
        influencers_data = []
        for ci in self.campaign_influencers:
            inf = ci.influencer
            if not inf:
                continue
            inf_data = inf.to_dict()
            # Compute platform-specific followers
            platform_lower = (ci.platform or '').lower()
            followers_map = {
                'instagram': inf.instagram_followers,
                'youtube': inf.youtube_subscribers,
                'facebook': inf.facebook_followers,
                'twitter': inf.twitter_followers,
                'x (twitter)': inf.twitter_followers,
                'linkedin': inf.linkedin_followers,
            }
            followers = followers_map.get(platform_lower, 0) or 0
            # Compute totals from content
            total_views = sum(c.views or 0 for c in ci.content)
            total_likes = sum(c.likes or 0 for c in ci.content)
            total_comments = sum(c.comments or 0 for c in ci.content)
            inf_data.update({
                'assignment_id': ci.id,
                'platform': ci.platform,
                'link': ci.link,
                'deliverables_count': ci.deliverables_count,
                'status': ci.status,
                'agreed_amount': ci.agreed_amount,
                'content_links': [c.to_dict() for c in ci.content],
                'followers': followers,
                'total_views': total_views,
                'total_likes': total_likes,
                'total_comments': total_comments,
            })
            influencers_data.append(inf_data)

        return {
            **self.to_dict(),
            'influencers': influencers_data,
            'content': [c.to_dict() for c in self.content],
        }

class Influencer(db.Model):
    """Master table for all influencers - reusable across campaigns"""
    __tablename__ = 'influencer'

    # Primary Information
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120))
    phone = db.Column(db.String(20))

    # Profile & Branding
    profile_pic = db.Column(db.String(500))
    bio = db.Column(db.Text)
    categories = db.Column(db.JSON, default=list)  # ["Fashion", "Lifestyle", "Tech"]

    # Location master FKs
    country_id = db.Column(db.Integer, db.ForeignKey('country.id'), nullable=True)
    state_id = db.Column(db.Integer, db.ForeignKey('state.id'), nullable=True)
    city_id = db.Column(db.Integer, db.ForeignKey('city.id'), nullable=True)

    country_ref = db.relationship('Country', foreign_keys=[country_id])
    state_ref = db.relationship('State', foreign_keys=[state_id])
    city_ref = db.relationship('City', foreign_keys=[city_id])

    # Platform Handles & Followers
    instagram_handle = db.Column(db.String(100))
    instagram_followers = db.Column(db.Integer, default=0)
    instagram_url = db.Column(db.String(500))

    youtube_handle = db.Column(db.String(100))
    youtube_subscribers = db.Column(db.Integer, default=0)
    youtube_url = db.Column(db.String(500))

    facebook_handle = db.Column(db.String(100))
    facebook_followers = db.Column(db.Integer, default=0)
    facebook_url = db.Column(db.String(500))

    twitter_handle = db.Column(db.String(100))
    twitter_followers = db.Column(db.Integer, default=0)
    twitter_url = db.Column(db.String(500))

    linkedin_handle = db.Column(db.String(100))
    linkedin_followers = db.Column(db.Integer, default=0)
    linkedin_url = db.Column(db.String(500))
    rate_per_post_linkedin = db.Column(db.Float)

    # Influencer Tier (Nano < 10K, Micro 10K-100K, Macro 100K-1M, Mega > 1M)
    tier = db.Column(db.String(50))

    # Rate Card
    rate_per_post_instagram = db.Column(db.Float)
    rate_per_reel_instagram = db.Column(db.Float)
    rate_per_story_instagram = db.Column(db.Float)
    rate_per_video_youtube = db.Column(db.Float)
    rate_per_short_youtube = db.Column(db.Float)
    rate_per_post_facebook = db.Column(db.Float)
    rate_per_reel_facebook = db.Column(db.Float)
    rate_per_story_facebook = db.Column(db.Float)
    currency = db.Column(db.String(10), default='INR')

    # Past Collaborations
    past_brands = db.Column(db.JSON, default=list)  # ["Nike", "Adidas"]

    # White Rivers Media Relationship
    worked_with_wrm = db.Column(db.Boolean, default=False)
    wrm_first_collab_date = db.Column(db.DateTime)
    wrm_last_collab_date = db.Column(db.DateTime)
    wrm_total_campaigns = db.Column(db.Integer, default=0)
    wrm_notes = db.Column(db.Text)

    # Status & Rating
    status = db.Column(db.String(50), default='active')  # active, inactive, blacklisted
    performance_rating = db.Column(db.Float)

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True, unique=True)

    # Relationships
    campaign_assignments = db.relationship('CampaignInfluencer', back_populates='influencer', cascade='all, delete-orphan')
    user = db.relationship('User', foreign_keys=[user_id], backref=db.backref('influencer_profile', uselist=False))

    def get_max_followers(self):
        """Get maximum followers across all platforms"""
        return max(
            self.instagram_followers or 0,
            self.youtube_subscribers or 0,
            self.facebook_followers or 0,
            self.twitter_followers or 0,
            self.linkedin_followers or 0
        )

    def calculate_tier(self):
        """Auto-calculate tier based on max followers"""
        max_followers = self.get_max_followers()
        if max_followers >= 1000000:
            return 'Mega'
        elif max_followers >= 100000:
            return 'Macro'
        elif max_followers >= 10000:
            return 'Micro'
        else:
            return 'Nano'

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'profile_pic': self.profile_pic,
            'bio': self.bio,
            'categories': self.categories or [],
            'city': self.city_ref.name if self.city_ref else None,
            'state': self.state_ref.name if self.state_ref else None,
            'country': self.country_ref.name if self.country_ref else None,
            'country_id': self.country_id,
            'state_id': self.state_id,
            'city_id': self.city_id,
            'instagram_handle': self.instagram_handle,
            'instagram_followers': self.instagram_followers,
            'instagram_url': self.instagram_url,
            'youtube_handle': self.youtube_handle,
            'youtube_subscribers': self.youtube_subscribers,
            'youtube_url': self.youtube_url,
            'facebook_handle': self.facebook_handle,
            'facebook_followers': self.facebook_followers,
            'facebook_url': self.facebook_url,
            'twitter_handle': self.twitter_handle,
            'twitter_followers': self.twitter_followers,
            'twitter_url': self.twitter_url,
            'linkedin_handle': self.linkedin_handle,
            'linkedin_followers': self.linkedin_followers,
            'linkedin_url': self.linkedin_url,
            'rate_per_post_linkedin': self.rate_per_post_linkedin,
            'tier': self.tier,
            'max_followers': self.get_max_followers(),
            'rate_per_post_instagram': self.rate_per_post_instagram,
            'rate_per_reel_instagram': self.rate_per_reel_instagram,
            'rate_per_story_instagram': self.rate_per_story_instagram,
            'rate_per_video_youtube': self.rate_per_video_youtube,
            'rate_per_short_youtube': self.rate_per_short_youtube,
            'rate_per_post_facebook': self.rate_per_post_facebook,
            'rate_per_reel_facebook': self.rate_per_reel_facebook,
            'rate_per_story_facebook': self.rate_per_story_facebook,
            'currency': self.currency,
            'past_brands': self.past_brands or [],
            'worked_with_wrm': self.worked_with_wrm,
            'wrm_first_collab_date': self.wrm_first_collab_date.strftime('%Y-%m-%d') if self.wrm_first_collab_date else None,
            'wrm_last_collab_date': self.wrm_last_collab_date.strftime('%Y-%m-%d') if self.wrm_last_collab_date else None,
            'wrm_total_campaigns': self.wrm_total_campaigns,
            'wrm_notes': self.wrm_notes,
            'status': self.status,
            'performance_rating': self.performance_rating,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'total_campaigns': len(self.campaign_assignments),
            'user_id': self.user_id,
            'invite_status': 'accepted' if (self.user_id and self.user and self.user.is_active) else ('invited' if self.user_id else None)
        }

class Country(db.Model):
    """Master table for countries"""
    __tablename__ = 'country'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    code = db.Column(db.String(10))  # ISO code e.g. IN, US
    status = db.Column(db.String(50), default='active')

    states = db.relationship('State', backref='country', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'status': self.status
        }

class State(db.Model):
    """Master table for states/provinces"""
    __tablename__ = 'state'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    country_id = db.Column(db.Integer, db.ForeignKey('country.id'), nullable=False)
    status = db.Column(db.String(50), default='active')

    cities = db.relationship('City', backref='state', lazy=True, cascade='all, delete-orphan')

    __table_args__ = (db.UniqueConstraint('name', 'country_id', name='uq_state_country'),)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'country_id': self.country_id,
            'country_name': self.country.name if self.country else None,
            'status': self.status
        }

class City(db.Model):
    """Master table for cities"""
    __tablename__ = 'city'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    state_id = db.Column(db.Integer, db.ForeignKey('state.id'), nullable=False)
    status = db.Column(db.String(50), default='active')

    __table_args__ = (db.UniqueConstraint('name', 'state_id', name='uq_city_state'),)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'state_id': self.state_id,
            'state_name': self.state.name if self.state else None,
            'country_id': self.state.country_id if self.state else None,
            'country_name': self.state.country.name if self.state and self.state.country else None,
            'status': self.status
        }

class Category(db.Model):
    """Master table for categories used across influencers and brands"""
    __tablename__ = 'category'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.String(255))
    icon = db.Column(db.String(10))  # emoji icon
    status = db.Column(db.String(50), default='active')  # active, inactive
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'icon': self.icon,
            'status': self.status,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        }

# Association table for Brand <-> Category (many-to-many)
brand_categories = db.Table('brand_categories',
    db.Column('brand_id', db.Integer, db.ForeignKey('brand.id'), primary_key=True),
    db.Column('category_id', db.Integer, db.ForeignKey('category.id'), primary_key=True)
)

class Brand(db.Model):
    """Master table for all brands"""
    __tablename__ = 'brand'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    status = db.Column(db.String(50), default='active')  # active, inactive
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey('user.id'))

    # Relationships
    categories = db.relationship('Category', secondary=brand_categories, lazy='subquery',
                                 backref=db.backref('brands', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'status': self.status or 'active',
            'categories': [cat.to_dict() for cat in self.categories],
            'category_ids': [cat.id for cat in self.categories],
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else None,
            'created_by_user_id': self.created_by_user_id
        }


class CampaignInfluencer(db.Model):
    """Links influencers to campaigns with campaign-specific details"""
    __tablename__ = 'campaign_influencer'

    id = db.Column(db.Integer, primary_key=True)
    campaign_id = db.Column(db.Integer, db.ForeignKey('campaign.id'), nullable=False)
    influencer_id = db.Column(db.Integer, db.ForeignKey('influencer.id'), nullable=False)

    # Campaign-specific details
    platform = db.Column(db.String(50), nullable=False)  # Instagram, YouTube, TikTok, Twitter
    link = db.Column(db.String(500))  # Platform-specific link/URL for this influencer
    deliverables_count = db.Column(db.Integer, default=0)
    content_type = db.Column(db.String(100))  # "3 Reels + 2 Stories + 1 Post"

    # Compensation
    agreed_amount = db.Column(db.Float)
    compensation_type = db.Column(db.String(50))  # Paid, Barter, Affiliate, Mixed
    compensation_notes = db.Column(db.Text)

    # Timeline
    contract_start_date = db.Column(db.DateTime)
    contract_end_date = db.Column(db.DateTime)

    # Status
    status = db.Column(db.String(50), default='pending')  # pending, active, in_progress, completed, cancelled

    # Content Tracking
    content_submitted = db.Column(db.Integer, default=0)
    content_approved = db.Column(db.Integer, default=0)
    content_published = db.Column(db.Integer, default=0)

    # Notes
    notes = db.Column(db.Text)

    # Metadata
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)
    assigned_by_user_id = db.Column(db.Integer, db.ForeignKey('user.id'))

    # Relationships
    campaign = db.relationship('Campaign', back_populates='campaign_influencers')
    influencer = db.relationship('Influencer', back_populates='campaign_assignments')
    content = db.relationship('Content', backref='assignment', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'campaign_id': self.campaign_id,
            'influencer_id': self.influencer_id,
            'platform': self.platform,
            'link': self.link,
            'deliverables_count': self.deliverables_count,
            'content_type': self.content_type,
            'agreed_amount': self.agreed_amount,
            'compensation_type': self.compensation_type,
            'compensation_notes': self.compensation_notes,
            'contract_start_date': self.contract_start_date.strftime('%Y-%m-%d') if self.contract_start_date else None,
            'contract_end_date': self.contract_end_date.strftime('%Y-%m-%d') if self.contract_end_date else None,
            'status': self.status,
            'content_submitted': self.content_submitted,
            'content_approved': self.content_approved,
            'content_published': self.content_published,
            'notes': self.notes,
            'assigned_at': self.assigned_at.strftime('%Y-%m-%d %H:%M:%S') if self.assigned_at else None
        }

class Content(db.Model):
    """Individual content pieces created by influencers"""
    __tablename__ = 'content'

    id = db.Column(db.Integer, primary_key=True)
    campaign_id = db.Column(db.Integer, db.ForeignKey('campaign.id'), nullable=False)
    influencer_id = db.Column(db.Integer, db.ForeignKey('influencer.id'), nullable=False)
    campaign_influencer_id = db.Column(db.Integer, db.ForeignKey('campaign_influencer.id'), nullable=False)

    # Content Details
    platform = db.Column(db.String(50), nullable=False)
    content_type = db.Column(db.String(50), nullable=False)  # Post, Reel, Story, Video, Short, Tweet
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

    # Status
    status = db.Column(db.String(50), default='draft')  # draft, submitted, approved, published, rejected

    # Timestamps
    published_at = db.Column(db.DateTime)
    submitted_at = db.Column(db.DateTime)
    approved_at = db.Column(db.DateTime)
    last_metrics_update = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def calculate_engagement_rate(self, followers):
        """Calculate engagement rate based on followers"""
        if followers > 0:
            engagement = (self.likes + self.comments + (self.shares or 0))
            self.engagement_rate = round((engagement / followers) * 100, 2)
        return self.engagement_rate

    def to_dict(self):
        # Get influencer details
        influencer = Influencer.query.get(self.influencer_id)

        return {
            'id': self.id,
            'campaign_id': self.campaign_id,
            'influencer_id': self.influencer_id,
            'influencer_name': influencer.name if influencer else 'Unknown',
            'campaign_influencer_id': self.campaign_influencer_id,
            'platform': self.platform,
            'content_type': self.content_type,
            'url': self.url,
            'thumbnail': self.thumbnail,
            'caption': self.caption,
            'views': self.views,
            'likes': self.likes,
            'comments': self.comments,
            'shares': self.shares,
            'saves': self.saves,
            'engagement_rate': self.engagement_rate,
            'status': self.status,
            'published_at': self.published_at.strftime('%Y-%m-%d') if self.published_at else None,
            'submitted_at': self.submitted_at.strftime('%Y-%m-%d') if self.submitted_at else None,
            'approved_at': self.approved_at.strftime('%Y-%m-%d') if self.approved_at else None,
            'last_metrics_update': self.last_metrics_update.strftime('%Y-%m-%d %H:%M:%S') if self.last_metrics_update else None,
            'created_at': self.created_at.strftime('%Y-%m-%d') if self.created_at else None
        }

class SocialAccountToken(db.Model):
    """Stores OAuth tokens for influencer social media accounts"""
    __tablename__ = 'social_account_token'

    id = db.Column(db.Integer, primary_key=True)
    influencer_id = db.Column(db.Integer, db.ForeignKey('influencer.id'), nullable=False)
    platform = db.Column(db.String(50), nullable=False)  # 'instagram' or 'facebook'
    access_token = db.Column(db.Text, nullable=False)
    expires_at = db.Column(db.DateTime)
    platform_user_id = db.Column(db.String(200))
    platform_username = db.Column(db.String(200))
    platform_name = db.Column(db.String(200))
    granted_permissions = db.Column(db.JSON, default=list)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    influencer = db.relationship('Influencer', backref=db.backref('social_tokens', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'influencer_id': self.influencer_id,
            'platform': self.platform,
            'platform_user_id': self.platform_user_id,
            'platform_username': self.platform_username,
            'platform_name': self.platform_name,
            'is_active': self.is_active,
            'expires_at': self.expires_at.strftime('%Y-%m-%d %H:%M:%S') if self.expires_at else None,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        }


class OAuthState(db.Model):
    """CSRF protection for OAuth flow"""
    __tablename__ = 'oauth_state'

    id = db.Column(db.Integer, primary_key=True)
    state_token = db.Column(db.String(200), unique=True, nullable=False)
    influencer_id = db.Column(db.Integer, db.ForeignKey('influencer.id'), nullable=False)
    platform = db.Column(db.String(50), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


# ==================== AUTHENTICATION UTILITIES ====================

def generate_token(user):
    """Generate JWT token for user"""
    payload = {
        'user_id': user.id,
        'username': user.username,
        'roles': [role.name for role in user.roles],
        'exp': datetime.utcnow() + app.config['JWT_EXPIRATION_DELTA'],
        'iat': datetime.utcnow()
    }
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')
    # PyJWT 2.x returns string, but handle both cases
    if isinstance(token, bytes):
        return token.decode('utf-8')
    return token

def verify_token(token):
    """Verify JWT token and return user"""
    if not token:
        return None
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        user = User.query.get(payload.get('user_id'))
        if user and user.is_active:
            return user
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
    except Exception:
        return None
    return None

def get_current_user():
    """Get current user from request token"""
    token = None
    auth_header = request.headers.get('Authorization')
    if auth_header:
        try:
            parts = auth_header.split(' ')
            if len(parts) == 2 and parts[0].lower() == 'bearer':
                token = parts[1]
        except (IndexError, AttributeError):
            pass
    if not token:
        return None
    return verify_token(token)

# ==================== HELPER FUNCTIONS ====================

def generate_random_password(length=12):
    """Generate a secure random password"""
    # Ensure password has at least one character from each category
    lowercase = string.ascii_lowercase
    uppercase = string.ascii_uppercase
    digits = string.digits
    special_chars = '!@#$%^&*'

    # Pick at least one from each category
    password = [
        random.choice(lowercase),
        random.choice(uppercase),
        random.choice(digits),
        random.choice(special_chars)
    ]

    # Fill the rest with random characters from all categories
    all_chars = lowercase + uppercase + digits + special_chars
    password.extend(random.choice(all_chars) for _ in range(length - 4))

    # Shuffle the password to make it more random
    random.shuffle(password)

    return ''.join(password)

def send_welcome_email(user_email, username, password):
    """Send welcome email with credentials to new user"""
    try:
        # Check if email is configured
        if not app.config['MAIL_USERNAME']:
            print(f'[EMAIL NOT CONFIGURED] Would send email to {user_email}')
            print(f'[EMAIL NOT CONFIGURED] Username: {username}, Password: {password}')
            return False

        msg = Message(
            subject='Welcome to Influencer Dashboard - Your Account Credentials',
            recipients=[user_email],
            sender=app.config['MAIL_DEFAULT_SENDER']
        )

        msg.html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                          color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
                .credentials {{ background: white; padding: 20px; border-radius: 8px;
                               border-left: 4px solid #667eea; margin: 20px 0; }}
                .credential-item {{ margin: 10px 0; }}
                .label {{ font-weight: bold; color: #667eea; }}
                .value {{ font-family: monospace; background: #f3f4f6; padding: 5px 10px;
                         border-radius: 4px; display: inline-block; }}
                .warning {{ background: #fef3c7; border: 1px solid #fbbf24; padding: 15px;
                           border-radius: 8px; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Welcome to Influencer Dashboard!</h1>
                </div>
                <div class="content">
                    <p>Hello,</p>
                    <p>Your account has been created successfully. Below are your login credentials:</p>

                    <div class="credentials">
                        <div class="credential-item">
                            <span class="label">Username:</span>
                            <span class="value">{username}</span>
                        </div>
                        <div class="credential-item">
                            <span class="label">Password:</span>
                            <span class="value">{password}</span>
                        </div>
                    </div>

                    <div class="warning">
                        <strong>⚠ Important Security Notice</strong>
                        <p>For your security, please change your password after your first login.
                           You can do this from your profile settings.</p>
                    </div>

                    <p>You can access the dashboard at: <a href="{FRONTEND_URL}">{FRONTEND_URL}</a></p>

                    <p>If you have any questions or need assistance, please contact your administrator.</p>

                    <div class="footer">
                        <p>This is an automated message. Please do not reply to this email.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """

        mail.send(msg)
        print(f'[EMAIL SENT] Welcome email sent to {user_email}')
        return True
    except Exception as e:
        print(f'[EMAIL ERROR] Failed to send email to {user_email}: {str(e)}')
        return False

def send_invite_email(email, name, invite_token):
    """Send invitation email to influencer with set-password link"""
    try:
        if not app.config['MAIL_USERNAME']:
            print(f'[EMAIL NOT CONFIGURED] Would send invite to {email}')
            print(f'[EMAIL NOT CONFIGURED] Invite link: {FRONTEND_URL}/set-password?token={invite_token}')
            return False

        invite_link = f"{FRONTEND_URL}/set-password?token={invite_token}"

        msg = Message(
            subject='You are invited to join Influencer Dashboard',
            recipients=[email],
            sender=app.config['MAIL_DEFAULT_SENDER']
        )

        msg.html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                          color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
                .btn {{ display: inline-block; background: #667eea; color: white; padding: 14px 28px;
                       text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>You're Invited!</h1>
                </div>
                <div class="content">
                    <p>Hello {name},</p>
                    <p>You have been invited to join the <strong>Influencer Dashboard</strong> platform.
                       Set up your account by clicking the button below:</p>

                    <div style="text-align: center;">
                        <a href="{invite_link}" class="btn">Set Your Password</a>
                    </div>

                    <p>Or copy and paste this link in your browser:</p>
                    <p style="word-break: break-all; background: #e5e7eb; padding: 10px; border-radius: 4px;">
                        {invite_link}
                    </p>

                    <p style="color: #ef4444;"><strong>This link expires in 7 days.</strong></p>

                    <div class="footer">
                        <p>This is an automated message. Please do not reply to this email.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """

        mail.send(msg)
        print(f'[EMAIL SENT] Invite email sent to {email}')
        return True
    except Exception as e:
        print(f'[EMAIL ERROR] Failed to send invite to {email}: {str(e)}')
        return False

# ==================== AUTHORIZATION DECORATORS ====================

def token_required(f):
    """Decorator to require authentication"""
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        return f(user, *args, **kwargs)
    return decorated

def role_required(*required_roles):
    """Decorator to require specific roles"""
    def decorator(f):
        @wraps(f)
        @token_required
        def decorated(user, *args, **kwargs):
            user_roles = [role.name for role in user.roles]
            if not any(role in user_roles for role in required_roles):
                return jsonify({'error': 'Insufficient permissions'}), 403
            return f(user, *args, **kwargs)
        return decorated
    return decorator

# ==================== AUTHENTICATION ROUTES ====================

@app.route('/api/users', methods=['POST'])
@role_required('Admin')
def create_user(user):
    """Admin-only endpoint to create new users with auto-generated password"""
    data = request.get_json()

    # Validate required fields
    if not data or not data.get('username') or not data.get('email') or not data.get('first_name') or not data.get('last_name'):
        return jsonify({'error': 'Username, email, first name, and last name are required'}), 400

    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400

    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already exists'}), 400

    # Generate random password if not provided
    password = data.get('password') or generate_random_password()

    new_user = User(
        username=data['username'],
        email=data['email'],
        first_name=data['first_name'],
        last_name=data['last_name'],
        is_active=data.get('is_active', True)
    )
    new_user.set_password(password)

    # Assign roles if specified
    if data.get('roles'):
        roles = Role.query.filter(Role.name.in_(data['roles'])).all()
        new_user.roles = roles
    else:
        # Default to Campaign Manager role if not specified
        default_role = Role.query.filter_by(name='Campaign Manager').first()
        if default_role:
            new_user.roles.append(default_role)
        else:
            # If Campaign Manager role doesn't exist, try Campaign Executor role
            executor_role = Role.query.filter_by(name='Campaign Executor').first()
            if executor_role:
                new_user.roles.append(executor_role)

    try:
        db.session.add(new_user)
        db.session.commit()

        # Send welcome email with credentials
        email_sent = send_welcome_email(new_user.email, new_user.username, password)

        response_data = {
            'message': 'User created successfully',
            'user': new_user.to_dict(),
            'email_sent': email_sent
        }

        # If email wasn't sent (not configured), include password in response for admin to see
        if not email_sent:
            response_data['generated_password'] = password
            response_data['warning'] = 'Email not configured. Please provide this password to the user manually.'

        return jsonify(response_data), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create user', 'details': str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Please enter both username and password.'}), 400
    
    user = User.query.filter_by(username=data['username']).first()

    if not user or not user.check_password(data['password']):
        return jsonify({'error': 'Incorrect username or password. Please try again.'}), 401
    
    if not user.is_active:
        return jsonify({'error': 'Your account has been deactivated. Please contact your administrator.'}), 403
    
    try:
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        token = generate_token(user)
        return jsonify({
            'token': token,
            'user': user.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'An error occurred while logging in. Please try again.'}), 500

@app.route('/api/auth/me', methods=['GET'])
@token_required
def get_current_user_info(user):
    return jsonify(user.to_dict()), 200

@app.route('/api/auth/refresh', methods=['POST'])
@token_required
def refresh_token(user):
    token = generate_token(user)
    return jsonify({
        'token': token,
        'user': user.to_dict()
    }), 200

@app.route('/api/auth/verify-invite', methods=['GET'])
def verify_invite():
    """Public endpoint to verify an invite token"""
    token = request.args.get('token', '').strip()
    if not token:
        return jsonify({'valid': False, 'error': 'Token is required'}), 400

    user = User.query.filter_by(invite_token=token).first()
    if not user:
        return jsonify({'valid': False, 'error': 'Invalid or expired invitation link'}), 400

    if user.invite_token_expires and user.invite_token_expires < datetime.utcnow():
        return jsonify({'valid': False, 'error': 'This invitation link has expired. Please contact your administrator.'}), 400

    # Get linked influencer name
    influencer = Influencer.query.filter_by(user_id=user.id).first()
    return jsonify({
        'valid': True,
        'name': influencer.name if influencer else user.first_name,
        'email': user.email
    }), 200

@app.route('/api/auth/set-password', methods=['POST'])
def set_password():
    """Public endpoint for influencers to set their password via invite token"""
    data = request.get_json()
    token = data.get('token', '').strip() if data else ''
    password = data.get('password', '').strip() if data else ''

    if not token or not password:
        return jsonify({'error': 'Token and password are required'}), 400

    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    user = User.query.filter_by(invite_token=token).first()
    if not user:
        return jsonify({'error': 'Invalid or expired invitation link'}), 400

    if user.invite_token_expires and user.invite_token_expires < datetime.utcnow():
        return jsonify({'error': 'This invitation link has expired. Please contact your administrator.'}), 400

    try:
        user.set_password(password)
        user.is_active = True
        user.invite_token = None
        user.invite_token_expires = None
        db.session.commit()

        # Auto-login: return JWT token
        jwt_token = generate_token(user)
        return jsonify({
            'message': 'Password set successfully. Welcome!',
            'token': jwt_token,
            'user': user.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to set password'}), 500

# ==================== USER MANAGEMENT ROUTES ====================

@app.route('/api/users', methods=['GET'])
@role_required('Admin')
def get_users(user):
    users = User.query.all()
    return jsonify([u.to_dict() for u in users]), 200

@app.route('/api/users/active', methods=['GET'])
@token_required
def get_active_users(user):
    """Get list of active users for campaign assignment (available to all authenticated users)"""
    active_users = User.query.filter_by(is_active=True).all()
    return jsonify([{
        'id': u.id,
        'username': u.username,
        'email': u.email,
        'first_name': u.first_name,
        'last_name': u.last_name,
        'roles': [role.name for role in u.roles]
    } for u in active_users]), 200

@app.route('/api/users/<int:user_id>', methods=['GET'])
@token_required
def get_user(user, user_id):
    target_user = User.query.get_or_404(user_id)
    # Users can view their own profile, admins can view anyone
    if user.id != user_id and not user.has_role('Admin'):
        return jsonify({'error': 'Insufficient permissions'}), 403
    return jsonify(target_user.to_dict()), 200

@app.route('/api/users/<int:user_id>', methods=['PUT'])
@token_required
def update_user(user, user_id):
    target_user = User.query.get_or_404(user_id)
    # Users can update their own profile, admins can update anyone
    if user.id != user_id and not user.has_role('Admin'):
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    data = request.get_json()
    if 'email' in data:
        # Check if email is already taken by another user
        existing = User.query.filter_by(email=data['email']).first()
        if existing and existing.id != user_id:
            return jsonify({'error': 'Email already exists'}), 400
        target_user.email = data['email']
    if 'first_name' in data:
        target_user.first_name = data['first_name']
    if 'last_name' in data:
        target_user.last_name = data['last_name']
    if 'password' in data and data['password']:
        target_user.set_password(data['password'])
    if 'is_active' in data and user.has_role('Admin'):
        # Prevent deactivating admin accounts
        if target_user.has_role('Admin') and not data['is_active']:
            return jsonify({'error': 'Cannot deactivate admin accounts'}), 400
        
        # Check for campaigns where this user is the only assignee before deactivating
        if not data['is_active']:
            orphaned_campaigns = []
            for campaign in Campaign.query.all():
                assigned_user_ids = [u.id for u in campaign.assigned_users]
                if target_user.id in assigned_user_ids and len(assigned_user_ids) == 1:
                    orphaned_campaigns.append({
                        'id': campaign.id,
                        'campaign_name': campaign.campaign_name
                    })
            
            if orphaned_campaigns:
                return jsonify({
                    'error': 'Cannot deactivate user. This user is the only assignee for the following campaigns. Please reassign them first.',
                    'orphaned_campaigns': orphaned_campaigns
                }), 400
        
        target_user.is_active = data['is_active']
    if 'roles' in data and user.has_role('Admin'):
        # Prevent removing Admin role from admin accounts
        if target_user.has_role('Admin') and 'Admin' not in data['roles']:
            return jsonify({'error': 'Cannot remove Admin role from admin accounts'}), 400
        # Update roles
        new_roles = Role.query.filter(Role.name.in_(data['roles'])).all()
        target_user.roles = new_roles
    
    db.session.commit()
    return jsonify(target_user.to_dict()), 200

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@role_required('Admin')
def delete_user(user, user_id):
    target_user = User.query.get_or_404(user_id)
    if target_user.id == user.id:
        return jsonify({'error': 'Cannot delete your own account'}), 400
    # Prevent deleting admin accounts
    if target_user.has_role('Admin'):
        return jsonify({'error': 'Cannot delete admin accounts'}), 400
    
    # Check for campaigns where this user is the only assignee
    orphaned_campaigns = []
    for campaign in Campaign.query.all():
        assigned_user_ids = [u.id for u in campaign.assigned_users]
        if target_user.id in assigned_user_ids and len(assigned_user_ids) == 1:
            orphaned_campaigns.append({
                'id': campaign.id,
                'campaign_name': campaign.campaign_name
            })
    
    if orphaned_campaigns:
        return jsonify({
            'error': 'Cannot delete user. This user is the only assignee for the following campaigns. Please reassign them first.',
            'orphaned_campaigns': orphaned_campaigns
        }), 400
    
    # Remove user from campaign assignments
    for campaign in Campaign.query.all():
        if target_user in campaign.assigned_users:
            campaign.assigned_users.remove(target_user)
    
    db.session.delete(target_user)
    db.session.commit()
    return jsonify({'message': 'User deleted successfully'}), 200

@app.route('/api/roles', methods=['GET'])
@role_required('Admin')
def get_roles(user):
    roles = Role.query.all()
    return jsonify([r.to_dict() for r in roles]), 200

@app.route('/api/roles', methods=['POST'])
@role_required('Admin')
def create_role(user):
    """Admin-only endpoint to create new roles"""
    data = request.get_json()

    if not data or not data.get('name'):
        return jsonify({'error': 'Role name is required'}), 400

    # Check if role already exists
    if Role.query.filter_by(name=data['name']).first():
        return jsonify({'error': 'Role name already exists'}), 400

    new_role = Role(
        name=data['name'],
        description=data.get('description', ''),
        permissions=json.dumps(data.get('permissions', []))
    )

    try:
        db.session.add(new_role)
        db.session.commit()
        return jsonify({
            'message': 'Role created successfully',
            'role': new_role.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create role'}), 500

@app.route('/api/roles/<int:role_id>', methods=['PUT'])
@role_required('Admin')
def update_role(user, role_id):
    """Update role permissions (Admin role cannot be modified)"""
    role = Role.query.get_or_404(role_id)
    data = request.get_json()

    # Protect Admin role from any modifications
    if role.name == 'Admin':
        return jsonify({'error': 'The Admin role cannot be modified. It maintains full system access.'}), 403

    if 'name' in data:
        # Check if name is already taken by another role
        existing = Role.query.filter_by(name=data['name']).first()
        if existing and existing.id != role_id:
            return jsonify({'error': 'Role name already exists'}), 400
        # Prevent renaming to 'Admin'
        if data['name'] == 'Admin':
            return jsonify({'error': 'Cannot rename a role to "Admin"'}), 400
        role.name = data['name']

    if 'description' in data:
        role.description = data['description']

    if 'permissions' in data:
        # Store permissions as JSON string
        role.permissions = json.dumps(data['permissions']) if isinstance(data['permissions'], list) else data['permissions']

    try:
        db.session.commit()
        return jsonify(role.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update role'}), 500

@app.route('/api/roles/<int:role_id>', methods=['DELETE'])
@role_required('Admin')
def delete_role(user, role_id):
    """Delete a role (Admin role cannot be deleted)"""
    role = Role.query.get_or_404(role_id)

    # Protect Admin role from deletion
    if role.name == 'Admin':
        return jsonify({'error': 'The Admin role cannot be deleted'}), 403

    # Check if any users have this role
    if role.users:
        return jsonify({'error': f'Cannot delete role. {len(role.users)} user(s) are assigned this role'}), 400

    try:
        db.session.delete(role)
        db.session.commit()
        return jsonify({'message': 'Role deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete role'}), 500

# ==================== API ROUTES ====================

@app.route('/api/campaigns', methods=['POST'])
@role_required('Admin', 'Campaign Manager')
def create_campaign(user):
    """Create a new campaign and auto-assign to creator (Admin/Manager only)"""
    data = request.get_json()
    
    # Validate required fields
    required_fields = ['campaign_name', 'objective', 'brand_id', 'status', 'start_date']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400

    # Validate brand exists
    brand_obj = Brand.query.get(data['brand_id'])
    if not brand_obj:
        return jsonify({'error': 'Invalid brand_id'}), 400

    try:
        # Parse dates
        start_date = datetime.strptime(data['start_date'], '%Y-%m-%d')
        end_date = None
        if data.get('end_date'):
            end_date = datetime.strptime(data['end_date'], '%Y-%m-%d')

        # Create campaign
        campaign = Campaign(
            campaign_name=data['campaign_name'],
            objective=data['objective'],
            brand_id=data['brand_id'],
            description=data.get('description', ''),
            status=data['status'],
            start_date=start_date,
            end_date=end_date,
            created_by_user_id=user.id
        )
        
        # Auto-assign to creator
        campaign.assigned_users.append(user)
        
        # If additional users are specified, assign them too
        if 'assigned_user_ids' in data and isinstance(data['assigned_user_ids'], list):
            additional_users = User.query.filter(User.id.in_(data['assigned_user_ids'])).all()
            for additional_user in additional_users:
                if additional_user not in campaign.assigned_users:
                    campaign.assigned_users.append(additional_user)

        db.session.add(campaign)
        db.session.flush()  # Flush to get campaign.id for influencer assignments

        # If influencer assignments are provided, create CampaignInfluencer records
        if 'influencer_assignments' in data and isinstance(data['influencer_assignments'], list):
            for assignment in data['influencer_assignments']:
                if 'influencer_id' not in assignment or 'platform' not in assignment:
                    continue  # Skip invalid assignments

                # Verify influencer exists and is active
                influencer = Influencer.query.get(assignment['influencer_id'])
                if not influencer or influencer.status != 'active':
                    continue  # Skip inactive or non-existent influencers

                # Create CampaignInfluencer record with minimal data
                campaign_influencer = CampaignInfluencer(
                    campaign_id=campaign.id,
                    influencer_id=assignment['influencer_id'],
                    platform=assignment['platform'],
                    link=assignment.get('link'),
                    status='pending',
                    assigned_by_user_id=user.id,
                    assigned_at=datetime.utcnow()
                )
                db.session.add(campaign_influencer)
                db.session.flush()

                # Create content links if provided
                content_links = assignment.get('content_links', [])
                for cl in content_links:
                    if cl.get('url', '').strip():
                        content = Content(
                            campaign_id=campaign.id,
                            influencer_id=assignment['influencer_id'],
                            campaign_influencer_id=campaign_influencer.id,
                            platform=assignment['platform'],
                            content_type=cl.get('content_type', 'Post'),
                            url=cl['url'].strip(),
                            status='published',
                            published_at=datetime.utcnow(),
                            created_at=datetime.utcnow()
                        )
                        db.session.add(content)

        db.session.commit()

        return jsonify(campaign.to_dict()), 201
    except ValueError as e:
        return jsonify({'error': f'Invalid date format: {str(e)}'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create campaign', 'details': str(e)}), 500

@app.route('/api/campaigns/<int:campaign_id>/assignments', methods=['PUT'])
@token_required
def update_campaign_assignments(user, campaign_id):
    """Update campaign user assignments (Admin, Campaign Manager, or Campaign Executor)"""
    campaign = Campaign.query.get_or_404(campaign_id)

    # Admin, Campaign Manager (creator), or Campaign Executor can update assignments
    if not user.has_role('Admin') and not user.has_role('Campaign Executor') and campaign.created_by_user_id != user.id:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    data = request.get_json()
    if 'assigned_user_ids' not in data or not isinstance(data['assigned_user_ids'], list):
        return jsonify({'error': 'assigned_user_ids must be a list'}), 400
    
    try:
        # Get users to assign
        new_users = User.query.filter(User.id.in_(data['assigned_user_ids'])).all()
        
        # Check if any assigned users are inactive
        inactive_users = [u for u in new_users if not u.is_active]
        if inactive_users and not user.has_role('Admin'):
            return jsonify({'error': 'Cannot assign inactive users'}), 400
        
        # Replace assignments
        campaign.assigned_users = new_users
        
        # If no users assigned and creator is deactivated/deleted, admin must reassign
        if len(campaign.assigned_users) == 0:
            creator = User.query.get(campaign.created_by_user_id) if campaign.created_by_user_id else None
            if not creator or not creator.is_active:
                if not user.has_role('Admin'):
                    return jsonify({'error': 'Campaign must have at least one assigned user. Please contact admin to reassign.'}), 400
        
        db.session.commit()
        return jsonify({
            'message': 'Campaign assignments updated successfully',
            'campaign': campaign.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update campaign assignments', 'details': str(e)}), 500

@app.route('/api/campaigns', methods=['GET'])
@token_required
def get_campaigns(user):
    # Filter campaigns based on user role
    if user.has_role('Admin'):
        campaigns = Campaign.query.all()
    elif user.has_role('Influencer') and user.influencer_profile:
        # Influencers see campaigns they are assigned to as influencers
        campaign_ids = [ca.campaign_id for ca in user.influencer_profile.campaign_assignments]
        campaigns = Campaign.query.filter(Campaign.id.in_(campaign_ids)).all() if campaign_ids else []
    else:
        # Users see campaigns they are assigned to
        campaigns = Campaign.query.join(campaign_users).filter(
            campaign_users.c.user_id == user.id
        ).all()
    return jsonify([campaign.to_dict() for campaign in campaigns])

@app.route('/api/campaigns/<int:campaign_id>', methods=['GET'])
@token_required
def get_campaign(user, campaign_id):
    campaign = Campaign.query.get_or_404(campaign_id)
    # Admins can view all campaigns, others can only view campaigns they are assigned to
    if not user.has_role('Admin'):
        assigned_user_ids = [u.id for u in campaign.assigned_users]
        if user.id not in assigned_user_ids:
            return jsonify({'error': 'Insufficient permissions'}), 403
    return jsonify(campaign.to_dict_detailed())

@app.route('/api/campaigns/<int:campaign_id>/influencers', methods=['GET'])
@token_required
def get_campaign_influencers(user, campaign_id):
    campaign = Campaign.query.get_or_404(campaign_id)
    if not user.has_role('Admin'):
        assigned_user_ids = [u.id for u in campaign.assigned_users]
        if user.id not in assigned_user_ids:
            return jsonify({'error': 'Insufficient permissions'}), 403
    return jsonify([inf.to_dict() for inf in campaign.influencers])

@app.route('/api/campaigns/<int:campaign_id>/influencers', methods=['POST'])
@role_required('Admin', 'Campaign Manager', 'Campaign Executor')
def add_campaign_influencer(user, campaign_id):
    """Add an influencer to a campaign (Admin, Campaign Manager, or Campaign Executor)"""
    campaign = Campaign.query.get_or_404(campaign_id)

    # Check permission: Admin can always, others must be assigned to the campaign
    if not user.has_role('Admin'):
        assigned_user_ids = [u.id for u in campaign.assigned_users]
        if user.id not in assigned_user_ids:
            return jsonify({'error': 'Insufficient permissions'}), 403

    data = request.get_json()
    if not data.get('influencer_id') or not data.get('platform'):
        return jsonify({'error': 'influencer_id and platform are required'}), 400

    influencer = Influencer.query.get(data['influencer_id'])
    if not influencer or influencer.status != 'active':
        return jsonify({'error': 'Influencer not found or inactive'}), 400

    # Check if already assigned with same platform
    existing = CampaignInfluencer.query.filter_by(
        campaign_id=campaign_id,
        influencer_id=data['influencer_id'],
        platform=data['platform']
    ).first()
    if existing:
        return jsonify({'error': 'Influencer already assigned to this campaign with this platform'}), 400

    try:
        ci = CampaignInfluencer(
            campaign_id=campaign_id,
            influencer_id=data['influencer_id'],
            platform=data['platform'],
            link=data.get('link'),
            status='pending',
            assigned_by_user_id=user.id,
            assigned_at=datetime.utcnow()
        )
        db.session.add(ci)
        db.session.commit()
        return jsonify(ci.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to add influencer to campaign'}), 500

@app.route('/api/campaigns/<int:campaign_id>/influencers/<int:assignment_id>/link', methods=['PUT'])
@role_required('Admin', 'Campaign Manager', 'Campaign Executor')
def update_campaign_influencer_link(user, campaign_id, assignment_id):
    """Update the link for a campaign influencer assignment"""
    campaign = Campaign.query.get_or_404(campaign_id)

    if not user.has_role('Admin'):
        assigned_user_ids = [u.id for u in campaign.assigned_users]
        if user.id not in assigned_user_ids:
            return jsonify({'error': 'Insufficient permissions'}), 403

    ci = CampaignInfluencer.query.filter_by(id=assignment_id, campaign_id=campaign_id).first()
    if not ci:
        return jsonify({'error': 'Assignment not found'}), 404

    data = request.get_json()
    try:
        ci.link = data.get('link', '').strip()
        db.session.commit()
        return jsonify({'message': 'Link updated', 'assignment': ci.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update link'}), 500

@app.route('/api/campaigns/<int:campaign_id>/influencers/<int:assignment_id>', methods=['DELETE'])
@role_required('Admin', 'Campaign Manager')
def remove_campaign_influencer(user, campaign_id, assignment_id):
    """Remove an influencer from a campaign (Admin/Campaign Manager only)"""
    campaign = Campaign.query.get_or_404(campaign_id)

    if not user.has_role('Admin') and campaign.created_by_user_id != user.id:
        assigned_user_ids = [u.id for u in campaign.assigned_users]
        if user.id not in assigned_user_ids:
            return jsonify({'error': 'Insufficient permissions'}), 403

    ci = CampaignInfluencer.query.filter_by(id=assignment_id, campaign_id=campaign_id).first()
    if not ci:
        return jsonify({'error': 'Assignment not found'}), 404

    try:
        db.session.delete(ci)
        db.session.commit()
        return jsonify({'message': 'Influencer removed from campaign'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to remove influencer'}), 500

@app.route('/api/campaigns/<int:campaign_id>/influencers/<int:assignment_id>/content', methods=['POST'])
@role_required('Admin', 'Campaign Manager', 'Campaign Executor')
def add_assignment_content(user, campaign_id, assignment_id):
    """Add a content link to a campaign influencer assignment"""
    campaign = Campaign.query.get_or_404(campaign_id)
    if not user.has_role('Admin'):
        assigned_user_ids = [u.id for u in campaign.assigned_users]
        if user.id not in assigned_user_ids:
            return jsonify({'error': 'Insufficient permissions'}), 403

    ci = CampaignInfluencer.query.filter_by(id=assignment_id, campaign_id=campaign_id).first()
    if not ci:
        return jsonify({'error': 'Assignment not found'}), 404

    data = request.get_json()
    if not data.get('url'):
        return jsonify({'error': 'URL is required'}), 400

    try:
        content = Content(
            campaign_id=campaign_id,
            influencer_id=ci.influencer_id,
            campaign_influencer_id=ci.id,
            platform=ci.platform,
            content_type=data.get('content_type', 'Post'),
            url=data['url'].strip(),
            caption=data.get('caption', ''),
            status='published',
            published_at=datetime.utcnow(),
            created_at=datetime.utcnow()
        )
        db.session.add(content)
        db.session.commit()
        return jsonify(content.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to add content'}), 500

@app.route('/api/campaigns/<int:campaign_id>/content/<int:content_id>', methods=['PUT'])
@role_required('Admin', 'Campaign Manager', 'Campaign Executor')
def update_content(user, campaign_id, content_id):
    """Update a content link"""
    campaign = Campaign.query.get_or_404(campaign_id)
    if not user.has_role('Admin'):
        assigned_user_ids = [u.id for u in campaign.assigned_users]
        if user.id not in assigned_user_ids:
            return jsonify({'error': 'Insufficient permissions'}), 403

    content = Content.query.filter_by(id=content_id, campaign_id=campaign_id).first()
    if not content:
        return jsonify({'error': 'Content not found'}), 404

    data = request.get_json()
    try:
        if 'url' in data:
            content.url = data['url'].strip()
        if 'content_type' in data:
            content.content_type = data['content_type']
        if 'caption' in data:
            content.caption = data['caption']
        db.session.commit()
        return jsonify(content.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update content'}), 500

@app.route('/api/campaigns/<int:campaign_id>/content/<int:content_id>', methods=['DELETE'])
@role_required('Admin', 'Campaign Manager', 'Campaign Executor')
def delete_content(user, campaign_id, content_id):
    """Delete a content link"""
    campaign = Campaign.query.get_or_404(campaign_id)
    if not user.has_role('Admin'):
        assigned_user_ids = [u.id for u in campaign.assigned_users]
        if user.id not in assigned_user_ids:
            return jsonify({'error': 'Insufficient permissions'}), 403

    content = Content.query.filter_by(id=content_id, campaign_id=campaign_id).first()
    if not content:
        return jsonify({'error': 'Content not found'}), 404

    try:
        db.session.delete(content)
        db.session.commit()
        return jsonify({'message': 'Content deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete content'}), 500

@app.route('/api/campaigns/<int:campaign_id>/content', methods=['GET'])
@token_required
def get_campaign_content(user, campaign_id):
    campaign = Campaign.query.get_or_404(campaign_id)
    if not user.has_role('Admin'):
        assigned_user_ids = [u.id for u in campaign.assigned_users]
        if user.id not in assigned_user_ids:
            return jsonify({'error': 'Insufficient permissions'}), 403
    return jsonify([c.to_dict() for c in campaign.content])

@app.route('/api/campaigns/<int:campaign_id>/analytics', methods=['GET'])
@token_required
def get_campaign_analytics(user, campaign_id):
    campaign = Campaign.query.get_or_404(campaign_id)
    if not user.has_role('Admin'):
        assigned_user_ids = [u.id for u in campaign.assigned_users]
        if user.id not in assigned_user_ids:
            return jsonify({'error': 'Insufficient permissions'}), 403

    # Parse optional date filters
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    start_dt = None
    end_dt = None
    if start_date_str:
        try:
            start_dt = datetime.strptime(start_date_str, '%Y-%m-%d')
        except ValueError:
            pass
    if end_date_str:
        try:
            end_dt = datetime.strptime(end_date_str, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
        except ValueError:
            pass

    # Filter content by date range, using published_at with created_at as fallback
    content_list = []
    for c in campaign.content:
        content_date = c.published_at or c.created_at
        if not content_date:
            continue
        if start_dt and content_date < start_dt:
            continue
        if end_dt and content_date > end_dt:
            continue
        content_list.append(c)

    # Calculate daily metrics
    content_by_date = {}
    for content in content_list:
        content_date = content.published_at or content.created_at
        date_key = content_date.strftime('%Y-%m-%d')
        if date_key not in content_by_date:
            content_by_date[date_key] = {
                'date': date_key,
                'views': 0,
                'likes': 0,
                'comments': 0,
                'content_count': 0
            }
        content_by_date[date_key]['views'] += content.views or 0
        content_by_date[date_key]['likes'] += content.likes or 0
        content_by_date[date_key]['comments'] += content.comments or 0
        content_by_date[date_key]['content_count'] += 1
    daily_metrics = sorted(content_by_date.values(), key=lambda x: x['date'])

    # Calculate platform breakdown
    platform_stats = {}
    for content in content_list:
        plat = content.platform or 'Unknown'
        if plat not in platform_stats:
            platform_stats[plat] = {
                'platform': plat,
                'content_count': 0,
                'views': 0,
                'likes': 0,
                'comments': 0
            }
        platform_stats[plat]['content_count'] += 1
        platform_stats[plat]['views'] += content.views or 0
        platform_stats[plat]['likes'] += content.likes or 0
        platform_stats[plat]['comments'] += content.comments or 0

    return jsonify({
        'daily_metrics': daily_metrics,
        'platform_stats': list(platform_stats.values()),
        'top_performers': sorted(
            [c.to_dict() for c in content_list],
            key=lambda x: x['views'] or 0,
            reverse=True
        )[:10]
    })

# ==================== INFLUENCER API ROUTES ====================

@app.route('/api/influencers', methods=['GET'])
@token_required
def get_influencers(user):
    """Get all influencers with optional filters"""
    # Get query parameters for filtering
    search = request.args.get('search', '').strip()
    tier = request.args.get('tier', '').strip()
    category = request.args.get('category', '').strip()
    status = request.args.get('status', 'active')
    worked_with_wrm = request.args.get('worked_with_wrm', '')
    min_followers = request.args.get('min_followers', type=int)
    max_followers = request.args.get('max_followers', type=int)
    for_campaign = request.args.get('for_campaign', '').lower() in ['true', '1', 'yes']

    # Start with base query
    query = Influencer.query

    # Apply filters
    if status:
        query = query.filter(Influencer.status == status)

    # For campaign assignment: only show influencers who accepted invite or have no user account (legacy)
    if for_campaign:
        query = query.outerjoin(User, Influencer.user_id == User.id).filter(
            db.or_(
                Influencer.user_id.is_(None),  # No user account (legacy/no email)
                User.is_active == True  # Accepted invitation
            )
        )

    if tier:
        tier_list = [t.strip() for t in tier.split(',') if t.strip()]
        if len(tier_list) == 1:
            query = query.filter(Influencer.tier == tier_list[0])
        else:
            query = query.filter(Influencer.tier.in_(tier_list))

    if category:
        query = query.filter(Influencer.categories.contains([category]))

    if search:
        search_filter = f'%{search}%'
        query = query.filter(
            db.or_(
                Influencer.name.ilike(search_filter),
                Influencer.email.ilike(search_filter),
                Influencer.instagram_handle.ilike(search_filter),
                Influencer.youtube_handle.ilike(search_filter)
            )
        )

    # Platform filter: only influencers who have followers > 0 on at least one selected platform
    platforms_param = request.args.get('platforms', '').strip()
    if platforms_param:
        platform_list = [p.strip() for p in platforms_param.split(',') if p.strip()]
        platform_conditions = []
        platform_map = {
            'Instagram': Influencer.instagram_followers,
            'YouTube': Influencer.youtube_subscribers,
            'Facebook': Influencer.facebook_followers,
            'X (Twitter)': Influencer.twitter_followers,
            'Twitter': Influencer.twitter_followers,
            'LinkedIn': Influencer.linkedin_followers,
        }
        for plat in platform_list:
            col = platform_map.get(plat)
            if col is not None:
                platform_conditions.append(col > 0)
        if platform_conditions:
            query = query.filter(db.or_(*platform_conditions))

    if worked_with_wrm:
        wrm_bool = worked_with_wrm.lower() in ['true', '1', 'yes']
        query = query.filter_by(worked_with_wrm=wrm_bool)

    # Get all influencers for follower filtering
    influencers = query.all()

    # Apply follower count filters (since it's across multiple platforms)
    if min_followers is not None or max_followers is not None:
        filtered_influencers = []
        for inf in influencers:
            max_follower_count = inf.get_max_followers()
            if min_followers is not None and max_follower_count < min_followers:
                continue
            if max_followers is not None and max_follower_count > max_followers:
                continue
            filtered_influencers.append(inf)
        influencers = filtered_influencers

    return jsonify([inf.to_dict() for inf in influencers])

@app.route('/api/influencers/<int:influencer_id>', methods=['GET'])
@token_required
def get_influencer(user, influencer_id):
    """Get single influencer details"""
    influencer = Influencer.query.get_or_404(influencer_id)
    return jsonify(influencer.to_dict())

@app.route('/api/influencers', methods=['POST'])
@role_required('Admin', 'Campaign Manager')
def create_influencer(user):
    """Create a new influencer"""
    data = request.get_json()

    # Validate required fields
    if not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400

    try:
        # Create influencer
        influencer = Influencer(
            name=data['name'],
            email=data.get('email'),
            phone=data.get('phone'),
            profile_pic=data.get('profile_pic'),
            bio=data.get('bio'),
            categories=data.get('categories', []),
            country_id=data.get('country_id'),
            state_id=data.get('state_id'),
            city_id=data.get('city_id'),

            instagram_handle=data.get('instagram_handle'),
            instagram_followers=data.get('instagram_followers', 0),
            instagram_url=data.get('instagram_url'),

            youtube_handle=data.get('youtube_handle'),
            youtube_subscribers=data.get('youtube_subscribers', 0),
            youtube_url=data.get('youtube_url'),

            facebook_handle=data.get('facebook_handle'),
            facebook_followers=data.get('facebook_followers', 0),
            facebook_url=data.get('facebook_url'),

            twitter_handle=data.get('twitter_handle'),
            twitter_followers=data.get('twitter_followers', 0),
            twitter_url=data.get('twitter_url'),

            linkedin_handle=data.get('linkedin_handle'),
            linkedin_followers=data.get('linkedin_followers', 0),
            linkedin_url=data.get('linkedin_url'),
            rate_per_post_linkedin=data.get('rate_per_post_linkedin'),

            rate_per_post_instagram=data.get('rate_per_post_instagram'),
            rate_per_reel_instagram=data.get('rate_per_reel_instagram'),
            rate_per_story_instagram=data.get('rate_per_story_instagram'),
            rate_per_video_youtube=data.get('rate_per_video_youtube'),
            rate_per_short_youtube=data.get('rate_per_short_youtube'),
            rate_per_post_facebook=data.get('rate_per_post_facebook'),
            rate_per_reel_facebook=data.get('rate_per_reel_facebook'),
            rate_per_story_facebook=data.get('rate_per_story_facebook'),
            currency=data.get('currency', 'INR'),

            past_brands=data.get('past_brands', []),

            worked_with_wrm=data.get('worked_with_wrm', False),
            wrm_notes=data.get('wrm_notes'),

            status=data.get('status', 'active'),
            performance_rating=data.get('performance_rating'),

            created_by_user_id=user.id
        )

        # Auto-calculate tier
        influencer.tier = influencer.calculate_tier()

        db.session.add(influencer)
        db.session.commit()

        response_data = influencer.to_dict()
        response_data['email_invited'] = False
        response_data['invite_message'] = None

        # Auto-send invite if email is provided
        if influencer.email:
            try:
                invite_token = str(uuid.uuid4())
                # Create user account for the influencer
                existing_user = User.query.filter_by(username=influencer.email).first()
                if not existing_user:
                    influencer_role = Role.query.filter_by(name='Influencer').first()
                    new_user = User(
                        username=influencer.email,
                        email=influencer.email,
                        password_hash='INVITE_PENDING',
                        is_active=False,
                        invite_token=invite_token,
                        invite_token_expires=datetime.utcnow() + timedelta(days=7),
                        invited_at=datetime.utcnow()
                    )
                    if influencer_role:
                        new_user.roles.append(influencer_role)
                    db.session.add(new_user)
                    db.session.flush()

                    influencer.user_id = new_user.id
                    db.session.commit()

                    email_sent = send_invite_email(influencer.email, influencer.name, invite_token)
                    response_data['email_invited'] = True
                    response_data['email_sent'] = email_sent
                    if email_sent:
                        response_data['invite_message'] = 'Invitation email sent successfully'
                    else:
                        response_data['invite_message'] = 'Influencer created. Email not configured.'
                        response_data['invite_link'] = f'{FRONTEND_URL}/set-password?token={invite_token}'
            except Exception as invite_err:
                # Don't fail the whole creation if invite fails
                print(f'[INVITE ERROR] {str(invite_err)}')
                response_data['invite_message'] = 'Influencer created but invitation failed to send'

        return jsonify(response_data), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create influencer', 'details': str(e)}), 500

@app.route('/api/influencers/<int:influencer_id>', methods=['PUT'])
@role_required('Admin', 'Campaign Manager')
def update_influencer(user, influencer_id):
    """Update influencer details"""
    influencer = Influencer.query.get_or_404(influencer_id)
    data = request.get_json()

    try:
        # Update fields
        if 'name' in data:
            influencer.name = data['name']
        if 'email' in data:
            influencer.email = data['email']
        if 'phone' in data:
            influencer.phone = data['phone']
        if 'profile_pic' in data:
            influencer.profile_pic = data['profile_pic']
        if 'bio' in data:
            influencer.bio = data['bio']
        if 'categories' in data:
            influencer.categories = data['categories']
        if 'country_id' in data:
            influencer.country_id = data['country_id']
        if 'state_id' in data:
            influencer.state_id = data['state_id']
        if 'city_id' in data:
            influencer.city_id = data['city_id']

        # Platform details
        if 'instagram_handle' in data:
            influencer.instagram_handle = data['instagram_handle']
        if 'instagram_followers' in data:
            influencer.instagram_followers = data['instagram_followers']
        if 'instagram_url' in data:
            influencer.instagram_url = data['instagram_url']

        if 'youtube_handle' in data:
            influencer.youtube_handle = data['youtube_handle']
        if 'youtube_subscribers' in data:
            influencer.youtube_subscribers = data['youtube_subscribers']
        if 'youtube_url' in data:
            influencer.youtube_url = data['youtube_url']

        if 'facebook_handle' in data:
            influencer.facebook_handle = data['facebook_handle']
        if 'facebook_followers' in data:
            influencer.facebook_followers = data['facebook_followers']
        if 'facebook_url' in data:
            influencer.facebook_url = data['facebook_url']

        if 'twitter_handle' in data:
            influencer.twitter_handle = data['twitter_handle']
        if 'twitter_followers' in data:
            influencer.twitter_followers = data['twitter_followers']
        if 'twitter_url' in data:
            influencer.twitter_url = data['twitter_url']

        if 'linkedin_handle' in data:
            influencer.linkedin_handle = data['linkedin_handle']
        if 'linkedin_followers' in data:
            influencer.linkedin_followers = data['linkedin_followers']
        if 'linkedin_url' in data:
            influencer.linkedin_url = data['linkedin_url']
        if 'rate_per_post_linkedin' in data:
            influencer.rate_per_post_linkedin = data['rate_per_post_linkedin']

        # Rate card
        if 'rate_per_post_instagram' in data:
            influencer.rate_per_post_instagram = data['rate_per_post_instagram']
        if 'rate_per_reel_instagram' in data:
            influencer.rate_per_reel_instagram = data['rate_per_reel_instagram']
        if 'rate_per_story_instagram' in data:
            influencer.rate_per_story_instagram = data['rate_per_story_instagram']
        if 'rate_per_video_youtube' in data:
            influencer.rate_per_video_youtube = data['rate_per_video_youtube']
        if 'rate_per_short_youtube' in data:
            influencer.rate_per_short_youtube = data['rate_per_short_youtube']
        if 'rate_per_post_facebook' in data:
            influencer.rate_per_post_facebook = data['rate_per_post_facebook']
        if 'rate_per_reel_facebook' in data:
            influencer.rate_per_reel_facebook = data['rate_per_reel_facebook']
        if 'rate_per_story_facebook' in data:
            influencer.rate_per_story_facebook = data['rate_per_story_facebook']
        if 'currency' in data:
            influencer.currency = data['currency']

        # Other details
        if 'past_brands' in data:
            influencer.past_brands = data['past_brands']
        if 'worked_with_wrm' in data:
            influencer.worked_with_wrm = data['worked_with_wrm']
        if 'wrm_notes' in data:
            influencer.wrm_notes = data['wrm_notes']
        if 'status' in data:
            influencer.status = data['status']
        if 'performance_rating' in data:
            influencer.performance_rating = data['performance_rating']

        # Recalculate tier based on updated followers
        influencer.tier = influencer.calculate_tier()
        influencer.updated_at = datetime.utcnow()

        db.session.commit()

        return jsonify(influencer.to_dict())

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update influencer', 'details': str(e)}), 500

@app.route('/api/influencers/<int:influencer_id>', methods=['DELETE'])
@role_required('Admin')
def delete_influencer(user, influencer_id):
    """Delete influencer (soft delete by setting status to inactive)"""
    influencer = Influencer.query.get_or_404(influencer_id)

    # Check if influencer is assigned to any active campaigns
    active_campaigns = [ca for ca in influencer.campaign_assignments if ca.status in ['pending', 'active', 'in_progress']]

    if active_campaigns:
        return jsonify({
            'error': f'Cannot delete influencer. They are assigned to {len(active_campaigns)} active campaign(s).'
        }), 400

    try:
        # Soft delete by setting status to inactive
        influencer.status = 'inactive'
        influencer.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({'message': 'Influencer deactivated successfully'})

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete influencer', 'details': str(e)}), 500

@app.route('/api/influencers/<int:influencer_id>/invite', methods=['POST'])
@role_required('Admin', 'Campaign Manager')
def invite_influencer(user, influencer_id):
    """Send invitation email to influencer to join the platform"""
    influencer = Influencer.query.get_or_404(influencer_id)

    if not influencer.email:
        return jsonify({'error': 'Influencer does not have an email address. Please add one first.'}), 400

    if influencer.user_id:
        existing_user = User.query.get(influencer.user_id)
        if existing_user and existing_user.is_active:
            return jsonify({'error': 'This influencer has already accepted the invitation.'}), 400
        if existing_user and existing_user.invite_token:
            return jsonify({'error': 'An invitation has already been sent. You can resend if needed.', 'already_invited': True}), 400

    # Check if email is already used by another user
    existing_email_user = User.query.filter_by(email=influencer.email).first()
    if existing_email_user:
        return jsonify({'error': 'A user with this email already exists in the system.'}), 400

    try:
        invite_token = str(uuid.uuid4())

        # Create user account (inactive until password is set)
        new_user = User(
            username=influencer.email,
            email=influencer.email,
            first_name=influencer.name.split()[0] if influencer.name else '',
            last_name=' '.join(influencer.name.split()[1:]) if influencer.name and len(influencer.name.split()) > 1 else '',
            is_active=False,
            invite_token=invite_token,
            invite_token_expires=datetime.utcnow() + timedelta(days=7),
            invited_at=datetime.utcnow()
        )
        new_user.set_password(generate_random_password())  # placeholder password

        # Assign Influencer role
        influencer_role = Role.query.filter_by(name='Influencer').first()
        if influencer_role:
            new_user.roles.append(influencer_role)

        db.session.add(new_user)
        db.session.flush()

        # Link influencer to user
        influencer.user_id = new_user.id
        db.session.commit()

        # Send invite email
        email_sent = send_invite_email(influencer.email, influencer.name, invite_token)

        response_data = {
            'message': 'Invitation sent successfully',
            'email_sent': email_sent,
            'influencer': influencer.to_dict()
        }

        if not email_sent:
            response_data['invite_link'] = f'{FRONTEND_URL}/set-password?token={invite_token}'
            response_data['warning'] = 'Email not configured. Share this invite link with the influencer manually.'

        return jsonify(response_data), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to send invitation', 'details': str(e)}), 500

@app.route('/api/influencers/<int:influencer_id>/resend-invite', methods=['POST'])
@role_required('Admin', 'Campaign Manager')
def resend_invite(user, influencer_id):
    """Resend invitation to an influencer"""
    influencer = Influencer.query.get_or_404(influencer_id)

    if not influencer.user_id:
        return jsonify({'error': 'Influencer has not been invited yet.'}), 400

    linked_user = User.query.get(influencer.user_id)
    if not linked_user:
        return jsonify({'error': 'Linked user account not found.'}), 400

    if linked_user.is_active:
        return jsonify({'error': 'Influencer has already accepted the invitation.'}), 400

    try:
        new_token = str(uuid.uuid4())
        linked_user.invite_token = new_token
        linked_user.invite_token_expires = datetime.utcnow() + timedelta(days=7)
        linked_user.invited_at = datetime.utcnow()
        db.session.commit()

        email_sent = send_invite_email(influencer.email, influencer.name, new_token)

        response_data = {
            'message': 'Invitation resent successfully',
            'email_sent': email_sent
        }

        if not email_sent:
            response_data['invite_link'] = f'{FRONTEND_URL}/set-password?token={new_token}'
            response_data['warning'] = 'Email not configured. Share this invite link with the influencer manually.'

        return jsonify(response_data), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to resend invitation'}), 500

# ==================== INFLUENCER SELF-SERVICE API ROUTES ====================

@app.route('/api/influencer/me', methods=['GET'])
@token_required
def get_my_influencer_profile(current_user):
    """Get the logged-in influencer's own profile"""
    if not current_user.influencer_profile:
        return jsonify({'error': 'No influencer profile linked to your account'}), 404
    return jsonify(current_user.influencer_profile.to_dict()), 200

@app.route('/api/influencer/me', methods=['PUT'])
@token_required
def update_my_influencer_profile(current_user):
    """Update the logged-in influencer's own profile"""
    if not current_user.influencer_profile:
        return jsonify({'error': 'No influencer profile linked to your account'}), 404

    influencer = current_user.influencer_profile
    data = request.get_json()

    # Influencers can update limited fields
    allowed_fields = ['bio', 'phone', 'profile_pic',
                      'country_id', 'state_id', 'city_id',
                      'instagram_handle', 'instagram_url', 'youtube_handle', 'youtube_url',
                      'facebook_handle', 'facebook_url', 'twitter_handle', 'twitter_url',
                      'linkedin_handle', 'linkedin_url']

    try:
        for field in allowed_fields:
            if field in data:
                setattr(influencer, field, data[field])

        influencer.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify(influencer.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update profile'}), 500

@app.route('/api/influencer/me/campaigns', methods=['GET'])
@token_required
def get_my_campaigns(current_user):
    """Get campaigns assigned to the logged-in influencer"""
    if not current_user.influencer_profile:
        return jsonify({'error': 'No influencer profile linked to your account'}), 404

    assignments = CampaignInfluencer.query.filter_by(
        influencer_id=current_user.influencer_profile.id
    ).all()

    result = []
    for assignment in assignments:
        campaign = Campaign.query.get(assignment.campaign_id)
        if campaign:
            campaign_data = campaign.to_dict()
            assignment_data = assignment.to_dict()
            assignment_data['content_links'] = [c.to_dict() for c in assignment.content]
            campaign_data['assignment'] = assignment_data
            result.append(campaign_data)

    return jsonify(result), 200

@app.route('/api/influencer/me/campaigns/<int:campaign_id>/links', methods=['PUT'])
@token_required
def update_my_campaign_links(current_user, campaign_id):
    """Allow influencer to update their link for a campaign assignment"""
    if not current_user.influencer_profile:
        return jsonify({'error': 'No influencer profile linked to your account'}), 404

    data = request.get_json()
    link = data.get('link', '').strip() if data else ''

    assignment = CampaignInfluencer.query.filter_by(
        campaign_id=campaign_id,
        influencer_id=current_user.influencer_profile.id
    ).first()

    if not assignment:
        return jsonify({'error': 'You are not assigned to this campaign'}), 404

    try:
        assignment.link = link
        db.session.commit()
        return jsonify({'message': 'Link updated successfully', 'assignment': assignment.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update link'}), 500

# ==================== INFLUENCER SELF-SERVICE CONTENT ROUTES ====================

@app.route('/api/influencer/me/campaign/<int:campaign_id>', methods=['GET'])
@token_required
def get_my_campaign_detail(current_user, campaign_id):
    """Get campaign details with all assignments for the logged-in influencer"""
    if not current_user.influencer_profile:
        return jsonify({'error': 'No influencer profile linked to your account'}), 404

    campaign = Campaign.query.get(campaign_id)
    if not campaign:
        return jsonify({'error': 'Campaign not found'}), 404

    assignments = CampaignInfluencer.query.filter_by(
        campaign_id=campaign_id,
        influencer_id=current_user.influencer_profile.id
    ).all()

    if not assignments:
        return jsonify({'error': 'You are not assigned to this campaign'}), 404

    campaign_data = campaign.to_dict()
    assignments_data = []
    total_views = 0
    total_likes = 0
    total_comments = 0
    total_shares = 0
    total_saves = 0
    total_content = 0
    for a in assignments:
        ad = a.to_dict()
        content_list = [c.to_dict() for c in a.content]
        ad['content_links'] = content_list
        # Compute per-assignment totals
        ad['total_views'] = sum(c.views or 0 for c in a.content)
        ad['total_likes'] = sum(c.likes or 0 for c in a.content)
        ad['total_comments'] = sum(c.comments or 0 for c in a.content)
        ad['total_shares'] = sum(c.shares or 0 for c in a.content)
        ad['total_saves'] = sum(c.saves or 0 for c in a.content)
        total_views += ad['total_views']
        total_likes += ad['total_likes']
        total_comments += ad['total_comments']
        total_shares += ad['total_shares']
        total_saves += ad['total_saves']
        total_content += len(a.content)
        # Get followers for platform
        inf = a.influencer
        platform_lower = (a.platform or '').lower()
        followers_map = {
            'instagram': inf.instagram_followers if inf else 0,
            'youtube': inf.youtube_subscribers if inf else 0,
            'facebook': inf.facebook_followers if inf else 0,
            'twitter': inf.twitter_followers if inf else 0,
            'x (twitter)': inf.twitter_followers if inf else 0,
            'linkedin': inf.linkedin_followers if inf else 0,
        }
        ad['followers'] = (followers_map.get(platform_lower, 0) or 0)
        assignments_data.append(ad)
    campaign_data['assignments'] = assignments_data
    campaign_data['my_total_views'] = total_views
    campaign_data['my_total_likes'] = total_likes
    campaign_data['my_total_comments'] = total_comments
    campaign_data['my_total_shares'] = total_shares
    campaign_data['my_total_saves'] = total_saves
    campaign_data['my_total_content'] = total_content
    campaign_data['my_engagement_rate'] = round(((total_likes + total_comments) / total_views * 100), 2) if total_views > 0 else 0

    return jsonify(campaign_data), 200

@app.route('/api/influencer/me/campaign/<int:campaign_id>/analytics', methods=['GET'])
@token_required
def get_my_campaign_analytics(current_user, campaign_id):
    """Get analytics for influencer's own content in a campaign"""
    if not current_user.influencer_profile:
        return jsonify({'error': 'No influencer profile linked to your account'}), 404

    assignments = CampaignInfluencer.query.filter_by(
        campaign_id=campaign_id,
        influencer_id=current_user.influencer_profile.id
    ).all()

    if not assignments:
        return jsonify({'error': 'You are not assigned to this campaign'}), 404

    # Collect all content for this influencer in this campaign
    all_content = []
    for a in assignments:
        all_content.extend(a.content)

    # Daily metrics
    content_by_date = {}
    for content in all_content:
        if not content.published_at:
            continue
        date_key = content.published_at.strftime('%Y-%m-%d')
        if date_key not in content_by_date:
            content_by_date[date_key] = {
                'date': date_key,
                'views': 0,
                'likes': 0,
                'comments': 0,
                'content_count': 0
            }
        content_by_date[date_key]['views'] += content.views or 0
        content_by_date[date_key]['likes'] += content.likes or 0
        content_by_date[date_key]['comments'] += content.comments or 0
        content_by_date[date_key]['content_count'] += 1
    daily_metrics = sorted(content_by_date.values(), key=lambda x: x['date'])

    # Platform breakdown
    platform_stats = {}
    for content in all_content:
        plat = content.platform or 'Unknown'
        if plat not in platform_stats:
            platform_stats[plat] = {
                'platform': plat,
                'content_count': 0,
                'views': 0,
                'likes': 0,
                'comments': 0
            }
        platform_stats[plat]['content_count'] += 1
        platform_stats[plat]['views'] += content.views or 0
        platform_stats[plat]['likes'] += content.likes or 0
        platform_stats[plat]['comments'] += content.comments or 0

    # Top performers
    top_performers = sorted(
        [c.to_dict() for c in all_content],
        key=lambda x: x['views'] or 0,
        reverse=True
    )[:10]

    return jsonify({
        'daily_metrics': daily_metrics,
        'platform_stats': list(platform_stats.values()),
        'top_performers': top_performers
    })

@app.route('/api/influencer/me/assignments/<int:assignment_id>', methods=['GET'])
@token_required
def get_my_assignment(current_user, assignment_id):
    """Get a single campaign assignment with content links for the logged-in influencer"""
    if not current_user.influencer_profile:
        return jsonify({'error': 'No influencer profile linked to your account'}), 404

    assignment = CampaignInfluencer.query.get(assignment_id)
    if not assignment or assignment.influencer_id != current_user.influencer_profile.id:
        return jsonify({'error': 'Assignment not found'}), 404

    campaign = Campaign.query.get(assignment.campaign_id)
    if not campaign:
        return jsonify({'error': 'Campaign not found'}), 404

    campaign_data = campaign.to_dict()
    assignment_data = assignment.to_dict()
    assignment_data['content_links'] = [c.to_dict() for c in assignment.content]
    campaign_data['assignment'] = assignment_data

    return jsonify(campaign_data), 200

@app.route('/api/influencer/me/assignments/<int:assignment_id>/content', methods=['POST'])
@token_required
def add_my_content(current_user, assignment_id):
    """Allow influencer to add a content link to their campaign assignment"""
    if not current_user.influencer_profile:
        return jsonify({'error': 'No influencer profile linked to your account'}), 404

    assignment = CampaignInfluencer.query.get(assignment_id)

    if not assignment or assignment.influencer_id != current_user.influencer_profile.id:
        return jsonify({'error': 'You are not assigned to this campaign'}), 404

    data = request.get_json()
    url = data.get('url', '').strip() if data else ''
    content_type = data.get('content_type', 'Post')

    if not url:
        return jsonify({'error': 'URL is required'}), 400

    try:
        content = Content(
            campaign_id=assignment.campaign_id,
            influencer_id=current_user.influencer_profile.id,
            campaign_influencer_id=assignment.id,
            platform=assignment.platform,
            content_type=content_type,
            url=url,
            status='published',
            published_at=datetime.utcnow(),
            created_at=datetime.utcnow()
        )
        db.session.add(content)
        db.session.commit()
        return jsonify(content.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to add content'}), 500

@app.route('/api/influencer/me/content/<int:content_id>', methods=['PUT'])
@token_required
def update_my_content(current_user, content_id):
    """Allow influencer to update their own content link"""
    if not current_user.influencer_profile:
        return jsonify({'error': 'No influencer profile linked to your account'}), 404

    content = Content.query.get_or_404(content_id)
    if content.influencer_id != current_user.influencer_profile.id:
        return jsonify({'error': 'You can only edit your own content'}), 403

    data = request.get_json()
    try:
        if 'url' in data:
            content.url = data['url'].strip()
        if 'content_type' in data:
            content.content_type = data['content_type']
        content.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify(content.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update content'}), 500

@app.route('/api/influencer/me/content/<int:content_id>', methods=['DELETE'])
@token_required
def delete_my_content(current_user, content_id):
    """Allow influencer to delete their own content link"""
    if not current_user.influencer_profile:
        return jsonify({'error': 'No influencer profile linked to your account'}), 404

    content = Content.query.get_or_404(content_id)
    if content.influencer_id != current_user.influencer_profile.id:
        return jsonify({'error': 'You can only delete your own content'}), 403

    try:
        db.session.delete(content)
        db.session.commit()
        return jsonify({'message': 'Content deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete content'}), 500

# ==================== SOCIAL MEDIA INTEGRATION ====================

# --- OAuth Helper Functions ---

def generate_oauth_state(influencer_id, platform):
    """Create a CSRF state token for OAuth flow"""
    state_token = str(uuid.uuid4())
    oauth_state = OAuthState(
        state_token=state_token,
        influencer_id=influencer_id,
        platform=platform,
        expires_at=datetime.utcnow() + timedelta(minutes=10)
    )
    db.session.add(oauth_state)
    db.session.commit()
    return state_token


def verify_oauth_state(state_token, platform):
    """Validate and consume an OAuth state token"""
    state = OAuthState.query.filter_by(state_token=state_token, platform=platform).first()
    if not state:
        return None
    if state.expires_at < datetime.utcnow():
        db.session.delete(state)
        db.session.commit()
        return None
    influencer_id = state.influencer_id
    db.session.delete(state)
    db.session.commit()
    return influencer_id


def exchange_code_for_token(code, redirect_uri):
    """Exchange Facebook auth code for a long-lived access token"""
    app_id = os.getenv('FACEBOOK_APP_ID')
    app_secret = os.getenv('FACEBOOK_APP_SECRET')
    api_version = os.getenv('FACEBOOK_GRAPH_API_VERSION', 'v21.0')

    # Step 1: Exchange code for short-lived token
    token_url = f'https://graph.facebook.com/{api_version}/oauth/access_token'
    resp = http_requests.get(token_url, params={
        'client_id': app_id,
        'client_secret': app_secret,
        'redirect_uri': redirect_uri,
        'code': code
    })
    if resp.status_code != 200:
        return None
    short_token = resp.json().get('access_token')

    # Step 2: Exchange for long-lived token (60 days)
    long_url = f'https://graph.facebook.com/{api_version}/oauth/access_token'
    resp2 = http_requests.get(long_url, params={
        'grant_type': 'fb_exchange_token',
        'client_id': app_id,
        'client_secret': app_secret,
        'fb_exchange_token': short_token
    })
    if resp2.status_code != 200:
        return {'access_token': short_token, 'expires_in': 3600}
    data = resp2.json()
    return data


def get_facebook_pages(access_token):
    """Get user's Facebook Pages"""
    api_version = os.getenv('FACEBOOK_GRAPH_API_VERSION', 'v21.0')
    resp = http_requests.get(
        f'https://graph.facebook.com/{api_version}/me/accounts',
        params={'access_token': access_token, 'fields': 'id,name,access_token'}
    )
    if resp.status_code != 200:
        return []
    return resp.json().get('data', [])


def get_instagram_business_account(access_token):
    """Get IG Business Account ID from Facebook Pages"""
    api_version = os.getenv('FACEBOOK_GRAPH_API_VERSION', 'v21.0')
    pages = get_facebook_pages(access_token)
    for page in pages:
        page_token = page.get('access_token', access_token)
        resp = http_requests.get(
            f'https://graph.facebook.com/{api_version}/{page["id"]}',
            params={'fields': 'instagram_business_account{id,username,name,followers_count,media_count}', 'access_token': page_token}
        )
        if resp.status_code == 200:
            ig_data = resp.json().get('instagram_business_account')
            if ig_data:
                return {**ig_data, 'page_id': page['id'], 'page_token': page_token, 'page_name': page.get('name')}
    return None


# --- Platform Detection & Metrics Helpers ---

def detect_platform_from_url(url):
    """Detect social media platform from URL"""
    if not url:
        return None
    url_lower = url.lower()
    if 'instagram.com' in url_lower:
        return 'instagram'
    elif 'facebook.com' in url_lower or 'fb.com' in url_lower or 'fb.watch' in url_lower:
        return 'facebook'
    elif 'youtube.com' in url_lower or 'youtu.be' in url_lower:
        return 'youtube'
    elif 'twitter.com' in url_lower or 'x.com' in url_lower:
        return 'twitter'
    return None


def extract_youtube_video_id(url):
    """Extract video ID from YouTube URL"""
    patterns = [
        r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/|youtube\.com/shorts/)([a-zA-Z0-9_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def extract_tweet_id(url):
    """Extract tweet ID from Twitter/X URL"""
    match = re.search(r'(?:twitter\.com|x\.com)/\w+/status/(\d+)', url)
    return match.group(1) if match else None


def extract_instagram_shortcode(url):
    """Extract shortcode from Instagram URL"""
    match = re.search(r'instagram\.com/(?:p|reel|reels)/([a-zA-Z0-9_-]+)', url)
    return match.group(1) if match else None


def fetch_youtube_video_metrics(url):
    """Fetch YouTube video metrics using API key (no OAuth needed)"""
    api_key = os.getenv('YOUTUBE_API_KEY')
    if not api_key:
        return {'error': 'YouTube API key not configured'}

    video_id = extract_youtube_video_id(url)
    if not video_id:
        return {'error': 'Could not extract video ID from URL'}

    resp = http_requests.get('https://www.googleapis.com/youtube/v3/videos', params={
        'part': 'statistics',
        'id': video_id,
        'key': api_key
    })
    if resp.status_code != 200:
        return {'error': f'YouTube API error: {resp.status_code}'}

    items = resp.json().get('items', [])
    if not items:
        return {'error': 'Video not found'}

    stats = items[0].get('statistics', {})
    return {
        'views': int(stats.get('viewCount', 0)),
        'likes': int(stats.get('likeCount', 0)),
        'comments': int(stats.get('commentCount', 0)),
        'shares': 0
    }


def fetch_twitter_post_metrics(url):
    """Fetch Twitter/X post metrics using Bearer token (no OAuth needed)"""
    bearer_token = os.getenv('TWITTER_BEARER_TOKEN')
    if not bearer_token:
        return {'error': 'Twitter Bearer token not configured'}

    tweet_id = extract_tweet_id(url)
    if not tweet_id:
        return {'error': 'Could not extract tweet ID from URL'}

    resp = http_requests.get(
        f'https://api.x.com/2/tweets/{tweet_id}',
        headers={'Authorization': f'Bearer {bearer_token}'},
        params={'tweet.fields': 'public_metrics'}
    )
    if resp.status_code != 200:
        return {'error': f'Twitter API error: {resp.status_code}'}

    data = resp.json().get('data', {})
    metrics = data.get('public_metrics', {})
    return {
        'views': int(metrics.get('impression_count', 0)),
        'likes': int(metrics.get('like_count', 0)),
        'comments': int(metrics.get('reply_count', 0)),
        'shares': int(metrics.get('retweet_count', 0)) + int(metrics.get('quote_count', 0))
    }


def fetch_instagram_post_metrics(url, access_token):
    """Fetch Instagram post metrics (requires OAuth token)"""
    api_version = os.getenv('FACEBOOK_GRAPH_API_VERSION', 'v21.0')
    shortcode = extract_instagram_shortcode(url)
    if not shortcode:
        return {'error': 'Could not extract post shortcode from URL'}

    # Search for media by shortcode using the IG user's media
    # First get the IG business account ID
    ig_account = get_instagram_business_account(access_token)
    if not ig_account:
        return {'error': 'Could not find Instagram business account'}

    ig_id = ig_account['id']

    # Get recent media and find matching shortcode
    resp = http_requests.get(
        f'https://graph.facebook.com/{api_version}/{ig_id}/media',
        params={'fields': 'id,shortcode,like_count,comments_count,media_type', 'limit': 50, 'access_token': access_token}
    )
    if resp.status_code != 200:
        return {'error': f'Instagram API error: {resp.status_code}'}

    media_list = resp.json().get('data', [])
    target_media = None
    for media in media_list:
        if media.get('shortcode') == shortcode:
            target_media = media
            break

    if not target_media:
        return {'error': 'Post not found in recent media. Make sure it belongs to your connected account.'}

    media_id = target_media['id']

    # Get insights for this media
    result = {
        'likes': target_media.get('like_count', 0),
        'comments': target_media.get('comments_count', 0),
        'views': 0,
        'shares': 0
    }

    # Try to get additional insights (reach, impressions)
    insights_resp = http_requests.get(
        f'https://graph.facebook.com/{api_version}/{media_id}/insights',
        params={'metric': 'impressions,reach', 'access_token': access_token}
    )
    if insights_resp.status_code == 200:
        for insight in insights_resp.json().get('data', []):
            if insight['name'] == 'impressions':
                result['views'] = insight['values'][0]['value'] if insight.get('values') else 0

    return result


def fetch_facebook_post_metrics(url, access_token):
    """Fetch Facebook post metrics (requires OAuth token)"""
    api_version = os.getenv('FACEBOOK_GRAPH_API_VERSION', 'v21.0')

    # Try to extract post ID from URL
    # Facebook URLs: facebook.com/{page}/posts/{post_id} or facebook.com/{page}/videos/{video_id}
    match = re.search(r'(?:posts|videos|photos)/(?:a\.\d+/)?(\d+)', url)
    if not match:
        # Try pfbid format
        match = re.search(r'pfbid[a-zA-Z0-9]+', url)
        if not match:
            return {'error': 'Could not extract post ID from Facebook URL'}

    post_identifier = match.group(0) if 'pfbid' in (match.group(0) if match else '') else match.group(1)

    # Get pages to find the right page token
    pages = get_facebook_pages(access_token)
    for page in pages:
        page_token = page.get('access_token', access_token)
        page_id = page['id']

        # Try fetching the post using page_id_post_id format
        resp = http_requests.get(
            f'https://graph.facebook.com/{api_version}/{page_id}_{post_identifier}',
            params={'fields': 'likes.summary(true),comments.summary(true),shares', 'access_token': page_token}
        )
        if resp.status_code == 200:
            data = resp.json()
            return {
                'likes': data.get('likes', {}).get('summary', {}).get('total_count', 0),
                'comments': data.get('comments', {}).get('summary', {}).get('total_count', 0),
                'shares': data.get('shares', {}).get('count', 0),
                'views': 0
            }

    return {'error': 'Could not fetch Facebook post metrics. Make sure the post belongs to your connected page.'}


# --- OAuth Endpoints ---

@app.route('/api/auth/instagram/connect', methods=['POST'])
@token_required
def connect_instagram(current_user):
    """Generate Instagram OAuth URL for influencer to connect"""
    if not current_user.influencer_profile:
        return jsonify({'error': 'No influencer profile linked'}), 404

    app_id = os.getenv('FACEBOOK_APP_ID')
    redirect_uri = os.getenv('INSTAGRAM_OAUTH_REDIRECT_URI')
    if not app_id or not redirect_uri:
        return jsonify({'error': 'Instagram OAuth not configured on server'}), 500

    state = generate_oauth_state(current_user.influencer_profile.id, 'instagram')
    api_version = os.getenv('FACEBOOK_GRAPH_API_VERSION', 'v21.0')

    auth_url = (
        f'https://www.facebook.com/{api_version}/dialog/oauth?'
        f'client_id={app_id}&redirect_uri={redirect_uri}&'
        f'scope=instagram_basic,instagram_manage_insights,pages_show_list,pages_read_engagement&'
        f'state={state}&response_type=code'
    )
    return jsonify({'auth_url': auth_url}), 200


@app.route('/api/auth/facebook/connect', methods=['POST'])
@token_required
def connect_facebook(current_user):
    """Generate Facebook OAuth URL for influencer to connect"""
    if not current_user.influencer_profile:
        return jsonify({'error': 'No influencer profile linked'}), 404

    app_id = os.getenv('FACEBOOK_APP_ID')
    redirect_uri = os.getenv('FACEBOOK_OAUTH_REDIRECT_URI')
    if not app_id or not redirect_uri:
        return jsonify({'error': 'Facebook OAuth not configured on server'}), 500

    state = generate_oauth_state(current_user.influencer_profile.id, 'facebook')
    api_version = os.getenv('FACEBOOK_GRAPH_API_VERSION', 'v21.0')

    auth_url = (
        f'https://www.facebook.com/{api_version}/dialog/oauth?'
        f'client_id={app_id}&redirect_uri={redirect_uri}&'
        f'scope=pages_show_list,pages_read_engagement,pages_read_user_content&'
        f'state={state}&response_type=code'
    )
    return jsonify({'auth_url': auth_url}), 200


@app.route('/api/auth/instagram/callback', methods=['GET'])
def instagram_oauth_callback():
    """Handle Instagram OAuth callback"""
    code = request.args.get('code')
    state = request.args.get('state')
    error = request.args.get('error')

    frontend_url = f'{FRONTEND_URL}/influencer/dashboard'

    if error:
        return flask_redirect(f'{frontend_url}?oauth_error={error}')

    if not code or not state:
        return flask_redirect(f'{frontend_url}?oauth_error=missing_params')

    influencer_id = verify_oauth_state(state, 'instagram')
    if not influencer_id:
        return flask_redirect(f'{frontend_url}?oauth_error=invalid_state')

    redirect_uri = os.getenv('INSTAGRAM_OAUTH_REDIRECT_URI')
    token_data = exchange_code_for_token(code, redirect_uri)
    if not token_data:
        return flask_redirect(f'{frontend_url}?oauth_error=token_exchange_failed')

    access_token = token_data.get('access_token')
    expires_in = token_data.get('expires_in', 5184000)

    # Find Instagram Business Account
    ig_account = get_instagram_business_account(access_token)
    if not ig_account:
        return flask_redirect(f'{frontend_url}?oauth_error=no_ig_business_account')

    # Store or update token
    existing = SocialAccountToken.query.filter_by(
        influencer_id=influencer_id, platform='instagram'
    ).first()

    if existing:
        existing.access_token = ig_account.get('page_token', access_token)
        existing.platform_user_id = ig_account['id']
        existing.platform_username = ig_account.get('username', '')
        existing.platform_name = ig_account.get('name', '')
        existing.expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
        existing.is_active = True
    else:
        new_token = SocialAccountToken(
            influencer_id=influencer_id,
            platform='instagram',
            access_token=ig_account.get('page_token', access_token),
            platform_user_id=ig_account['id'],
            platform_username=ig_account.get('username', ''),
            platform_name=ig_account.get('name', ''),
            expires_at=datetime.utcnow() + timedelta(seconds=expires_in),
            is_active=True
        )
        db.session.add(new_token)

    # Update influencer's Instagram stats
    influencer = Influencer.query.get(influencer_id)
    if influencer and ig_account.get('followers_count'):
        influencer.instagram_followers = ig_account['followers_count']
        if ig_account.get('username'):
            influencer.instagram_handle = ig_account['username']

    db.session.commit()
    return flask_redirect(f'{frontend_url}?oauth_success=instagram')


@app.route('/api/auth/facebook/callback', methods=['GET'])
def facebook_oauth_callback():
    """Handle Facebook OAuth callback"""
    code = request.args.get('code')
    state = request.args.get('state')
    error = request.args.get('error')

    frontend_url = f'{FRONTEND_URL}/influencer/dashboard'

    if error:
        return flask_redirect(f'{frontend_url}?oauth_error={error}')

    if not code or not state:
        return flask_redirect(f'{frontend_url}?oauth_error=missing_params')

    influencer_id = verify_oauth_state(state, 'facebook')
    if not influencer_id:
        return flask_redirect(f'{frontend_url}?oauth_error=invalid_state')

    redirect_uri = os.getenv('FACEBOOK_OAUTH_REDIRECT_URI')
    token_data = exchange_code_for_token(code, redirect_uri)
    if not token_data:
        return flask_redirect(f'{frontend_url}?oauth_error=token_exchange_failed')

    access_token = token_data.get('access_token')
    expires_in = token_data.get('expires_in', 5184000)

    # Get Facebook Pages
    pages = get_facebook_pages(access_token)
    if not pages:
        return flask_redirect(f'{frontend_url}?oauth_error=no_facebook_pages')

    # Use the first page
    page = pages[0]
    page_token = page.get('access_token', access_token)

    # Store or update token
    existing = SocialAccountToken.query.filter_by(
        influencer_id=influencer_id, platform='facebook'
    ).first()

    if existing:
        existing.access_token = page_token
        existing.platform_user_id = page['id']
        existing.platform_name = page.get('name', '')
        existing.expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
        existing.is_active = True
    else:
        new_token = SocialAccountToken(
            influencer_id=influencer_id,
            platform='facebook',
            access_token=page_token,
            platform_user_id=page['id'],
            platform_name=page.get('name', ''),
            expires_at=datetime.utcnow() + timedelta(seconds=expires_in),
            is_active=True
        )
        db.session.add(new_token)

    # Update influencer's Facebook follower count
    influencer = Influencer.query.get(influencer_id)
    if influencer:
        api_version = os.getenv('FACEBOOK_GRAPH_API_VERSION', 'v21.0')
        fans_resp = http_requests.get(
            f'https://graph.facebook.com/{api_version}/{page["id"]}',
            params={'fields': 'followers_count', 'access_token': page_token}
        )
        if fans_resp.status_code == 200:
            followers = fans_resp.json().get('followers_count', 0)
            influencer.facebook_followers = followers

    db.session.commit()
    return flask_redirect(f'{frontend_url}?oauth_success=facebook')


@app.route('/api/influencer/me/social-accounts', methods=['GET'])
@token_required
def get_social_accounts(current_user):
    """List connected social accounts for the current influencer"""
    if not current_user.influencer_profile:
        return jsonify({'error': 'No influencer profile linked'}), 404

    tokens = SocialAccountToken.query.filter_by(
        influencer_id=current_user.influencer_profile.id,
        is_active=True
    ).all()
    return jsonify([t.to_dict() for t in tokens]), 200


@app.route('/api/influencer/me/social-accounts/<int:account_id>', methods=['DELETE'])
@token_required
def disconnect_social_account(current_user, account_id):
    """Disconnect a social account"""
    if not current_user.influencer_profile:
        return jsonify({'error': 'No influencer profile linked'}), 404

    token = SocialAccountToken.query.filter_by(
        id=account_id,
        influencer_id=current_user.influencer_profile.id
    ).first()
    if not token:
        return jsonify({'error': 'Social account not found'}), 404

    token.is_active = False
    db.session.commit()
    return jsonify({'message': f'{token.platform} disconnected successfully'}), 200


# --- Metrics Refresh Endpoints ---

@app.route('/api/influencer/me/refresh-instagram-stats', methods=['POST'])
@token_required
def refresh_instagram_stats(current_user):
    """Refresh Instagram account stats using connected token"""
    if not current_user.influencer_profile:
        return jsonify({'error': 'No influencer profile linked'}), 404

    token = SocialAccountToken.query.filter_by(
        influencer_id=current_user.influencer_profile.id,
        platform='instagram',
        is_active=True
    ).first()
    if not token:
        return jsonify({'error': 'Instagram not connected'}), 400

    api_version = os.getenv('FACEBOOK_GRAPH_API_VERSION', 'v21.0')
    resp = http_requests.get(
        f'https://graph.facebook.com/{api_version}/{token.platform_user_id}',
        params={'fields': 'followers_count,media_count,username,name', 'access_token': token.access_token}
    )
    if resp.status_code != 200:
        return jsonify({'error': 'Failed to fetch Instagram stats'}), 502

    data = resp.json()
    influencer = current_user.influencer_profile
    influencer.instagram_followers = data.get('followers_count', influencer.instagram_followers)
    if data.get('username'):
        influencer.instagram_handle = data['username']
    db.session.commit()

    return jsonify({
        'followers': data.get('followers_count', 0),
        'media_count': data.get('media_count', 0),
        'username': data.get('username', '')
    }), 200


@app.route('/api/influencer/me/refresh-facebook-stats', methods=['POST'])
@token_required
def refresh_facebook_stats(current_user):
    """Refresh Facebook page stats using connected token"""
    if not current_user.influencer_profile:
        return jsonify({'error': 'No influencer profile linked'}), 404

    token = SocialAccountToken.query.filter_by(
        influencer_id=current_user.influencer_profile.id,
        platform='facebook',
        is_active=True
    ).first()
    if not token:
        return jsonify({'error': 'Facebook not connected'}), 400

    api_version = os.getenv('FACEBOOK_GRAPH_API_VERSION', 'v21.0')
    resp = http_requests.get(
        f'https://graph.facebook.com/{api_version}/{token.platform_user_id}',
        params={'fields': 'followers_count,fan_count,name', 'access_token': token.access_token}
    )
    if resp.status_code != 200:
        return jsonify({'error': 'Failed to fetch Facebook stats'}), 502

    data = resp.json()
    influencer = current_user.influencer_profile
    influencer.facebook_followers = data.get('followers_count', data.get('fan_count', influencer.facebook_followers))
    db.session.commit()

    return jsonify({
        'followers': data.get('followers_count', data.get('fan_count', 0)),
        'page_name': data.get('name', '')
    }), 200


@app.route('/api/content/<int:content_id>/refresh-metrics', methods=['POST'])
@token_required
def refresh_content_metrics(current_user, content_id):
    """Refresh metrics for a content link — auto-detects platform"""
    content = Content.query.get(content_id)
    if not content:
        return jsonify({'error': 'Content not found'}), 404

    # Verify ownership
    if current_user.influencer_profile and content.influencer_id != current_user.influencer_profile.id:
        # Allow admins too
        if not current_user.has_role('Admin'):
            return jsonify({'error': 'You can only refresh metrics for your own content'}), 403

    platform = detect_platform_from_url(content.url)
    if not platform:
        return jsonify({'error': 'Could not detect platform from content URL'}), 400

    metrics = None

    if platform == 'youtube':
        metrics = fetch_youtube_video_metrics(content.url)
    elif platform == 'twitter':
        metrics = fetch_twitter_post_metrics(content.url)
    elif platform in ('instagram', 'facebook'):
        # These need OAuth tokens
        token = SocialAccountToken.query.filter_by(
            influencer_id=content.influencer_id,
            platform=platform,
            is_active=True
        ).first()
        if not token:
            return jsonify({'error': f'{platform.capitalize()} not connected. Please connect your account first.'}), 400

        if platform == 'instagram':
            metrics = fetch_instagram_post_metrics(content.url, token.access_token)
        else:
            metrics = fetch_facebook_post_metrics(content.url, token.access_token)

    if not metrics:
        return jsonify({'error': 'Failed to fetch metrics'}), 500

    if 'error' in metrics:
        return jsonify({'error': metrics['error']}), 400

    # Update content with metrics
    content.views = metrics.get('views', content.views)
    content.likes = metrics.get('likes', content.likes)
    content.comments = metrics.get('comments', content.comments)
    content.shares = metrics.get('shares', content.shares)
    content.last_metrics_update = datetime.utcnow()

    # Calculate engagement rate
    influencer = Influencer.query.get(content.influencer_id)
    if influencer:
        followers = 0
        if platform == 'instagram':
            followers = influencer.instagram_followers or 0
        elif platform == 'facebook':
            followers = influencer.facebook_followers or 0
        elif platform == 'youtube':
            followers = influencer.youtube_subscribers or 0
        elif platform == 'twitter':
            followers = influencer.twitter_followers or 0
        content.calculate_engagement_rate(followers)

    db.session.commit()

    return jsonify({
        'views': content.views,
        'likes': content.likes,
        'comments': content.comments,
        'shares': content.shares,
        'engagement_rate': content.engagement_rate,
        'last_metrics_update': content.last_metrics_update.strftime('%Y-%m-%d %H:%M:%S')
    }), 200


# ==================== LOCATION API ROUTES ====================

@app.route('/api/countries', methods=['GET'])
@token_required
def get_countries(user):
    """Get all countries"""
    countries = Country.query.order_by(Country.name.asc()).all()
    return jsonify([c.to_dict() for c in countries])

@app.route('/api/countries', methods=['POST'])
@role_required('Admin', 'Campaign Manager')
def create_country(user):
    """Create a new country"""
    data = request.get_json()
    if not data.get('name'):
        return jsonify({'error': 'Country name is required'}), 400
    if Country.query.filter_by(name=data['name']).first():
        return jsonify({'error': 'Country already exists'}), 400
    try:
        country = Country(name=data['name'], code=data.get('code', ''), status=data.get('status', 'active'))
        db.session.add(country)
        db.session.commit()
        return jsonify(country.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create country'}), 500

@app.route('/api/countries/<int:country_id>', methods=['PUT'])
@role_required('Admin', 'Campaign Manager')
def update_country(user, country_id):
    """Update a country"""
    country = Country.query.get_or_404(country_id)
    data = request.get_json()
    if 'name' in data:
        country.name = data['name']
    if 'code' in data:
        country.code = data['code']
    if 'status' in data:
        country.status = data['status']
    db.session.commit()
    return jsonify(country.to_dict()), 200

@app.route('/api/countries/<int:country_id>', methods=['DELETE'])
@role_required('Admin', 'Campaign Manager')
def delete_country(user, country_id):
    """Delete a country"""
    country = Country.query.get_or_404(country_id)
    try:
        db.session.delete(country)
        db.session.commit()
        return jsonify({'message': 'Country deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete country. It may have states linked.'}), 500

@app.route('/api/states', methods=['GET'])
@token_required
def get_states(user):
    """Get states, optionally filtered by country_id"""
    country_id = request.args.get('country_id', type=int)
    query = State.query
    if country_id:
        query = query.filter_by(country_id=country_id)
    states = query.order_by(State.name.asc()).all()
    return jsonify([s.to_dict() for s in states])

@app.route('/api/states', methods=['POST'])
@role_required('Admin', 'Campaign Manager')
def create_state(user):
    """Create a new state"""
    data = request.get_json()
    if not data.get('name') or not data.get('country_id'):
        return jsonify({'error': 'State name and country_id are required'}), 400
    if State.query.filter_by(name=data['name'], country_id=data['country_id']).first():
        return jsonify({'error': 'State already exists in this country'}), 400
    try:
        state = State(name=data['name'], country_id=data['country_id'], status=data.get('status', 'active'))
        db.session.add(state)
        db.session.commit()
        return jsonify(state.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create state'}), 500

@app.route('/api/states/<int:state_id>', methods=['PUT'])
@role_required('Admin', 'Campaign Manager')
def update_state(user, state_id):
    """Update a state"""
    state = State.query.get_or_404(state_id)
    data = request.get_json()
    if 'name' in data:
        state.name = data['name']
    if 'status' in data:
        state.status = data['status']
    db.session.commit()
    return jsonify(state.to_dict()), 200

@app.route('/api/states/<int:state_id>', methods=['DELETE'])
@role_required('Admin', 'Campaign Manager')
def delete_state(user, state_id):
    """Delete a state"""
    state = State.query.get_or_404(state_id)
    try:
        db.session.delete(state)
        db.session.commit()
        return jsonify({'message': 'State deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete state. It may have cities linked.'}), 500

@app.route('/api/cities', methods=['GET'])
@token_required
def get_cities(user):
    """Get cities, optionally filtered by state_id"""
    state_id = request.args.get('state_id', type=int)
    query = City.query
    if state_id:
        query = query.filter_by(state_id=state_id)
    cities = query.order_by(City.name.asc()).all()
    return jsonify([c.to_dict() for c in cities])

@app.route('/api/cities', methods=['POST'])
@role_required('Admin', 'Campaign Manager')
def create_city(user):
    """Create a new city"""
    data = request.get_json()
    if not data.get('name') or not data.get('state_id'):
        return jsonify({'error': 'City name and state_id are required'}), 400
    if City.query.filter_by(name=data['name'], state_id=data['state_id']).first():
        return jsonify({'error': 'City already exists in this state'}), 400
    try:
        city = City(name=data['name'], state_id=data['state_id'], status=data.get('status', 'active'))
        db.session.add(city)
        db.session.commit()
        return jsonify(city.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create city'}), 500

@app.route('/api/cities/<int:city_id>', methods=['PUT'])
@role_required('Admin', 'Campaign Manager')
def update_city(user, city_id):
    """Update a city"""
    city = City.query.get_or_404(city_id)
    data = request.get_json()
    if 'name' in data:
        city.name = data['name']
    if 'status' in data:
        city.status = data['status']
    db.session.commit()
    return jsonify(city.to_dict()), 200

@app.route('/api/cities/<int:city_id>', methods=['DELETE'])
@role_required('Admin', 'Campaign Manager')
def delete_city(user, city_id):
    """Delete a city"""
    city = City.query.get_or_404(city_id)
    try:
        db.session.delete(city)
        db.session.commit()
        return jsonify({'message': 'City deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete city'}), 500

# ==================== CATEGORY API ROUTES ====================

@app.route('/api/categories', methods=['GET'])
@token_required
def get_categories(user):
    """Get all categories"""
    status = request.args.get('status', 'active')
    query = Category.query
    if status:
        query = query.filter_by(status=status)
    categories = query.order_by(Category.name.asc()).all()
    return jsonify([cat.to_dict() for cat in categories])

@app.route('/api/categories', methods=['POST'])
@role_required('Admin', 'Campaign Manager')
def create_category(user):
    """Create a new category"""
    data = request.get_json()

    if not data.get('name'):
        return jsonify({'error': 'Category name is required'}), 400

    if Category.query.filter_by(name=data['name']).first():
        return jsonify({'error': 'Category already exists'}), 400

    try:
        category = Category(
            name=data['name'],
            description=data.get('description', ''),
            icon=data.get('icon', ''),
            status=data.get('status', 'active')
        )
        db.session.add(category)
        db.session.commit()
        return jsonify(category.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create category', 'details': str(e)}), 500

@app.route('/api/categories/<int:category_id>', methods=['PUT'])
@role_required('Admin', 'Campaign Manager')
def update_category(user, category_id):
    """Update a category"""
    category = Category.query.get_or_404(category_id)
    data = request.get_json()

    try:
        if 'name' in data:
            existing = Category.query.filter_by(name=data['name']).first()
            if existing and existing.id != category_id:
                return jsonify({'error': 'Category name already exists'}), 400
            category.name = data['name']
        if 'description' in data:
            category.description = data['description']
        if 'icon' in data:
            category.icon = data['icon']
        if 'status' in data:
            category.status = data['status']

        db.session.commit()
        return jsonify(category.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update category'}), 500

@app.route('/api/categories/<int:category_id>', methods=['DELETE'])
@role_required('Admin', 'Campaign Manager')
def delete_category(user, category_id):
    """Delete a category"""
    category = Category.query.get_or_404(category_id)

    try:
        db.session.delete(category)
        db.session.commit()
        return jsonify({'message': 'Category deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete category'}), 500

# ==================== BRAND API ROUTES ====================

@app.route('/api/brands', methods=['GET'])
@token_required
def get_brands(user):
    """Get all brands with optional search filter"""
    search = request.args.get('search', '').strip()

    query = Brand.query

    if search:
        search_filter = f'%{search}%'
        query = query.filter(
            db.or_(
                Brand.name.ilike(search_filter),
                Brand.description.ilike(search_filter)
            )
        )

    brands = query.order_by(Brand.name.asc()).all()
    return jsonify([brand.to_dict() for brand in brands])

@app.route('/api/brands/<int:brand_id>', methods=['GET'])
@token_required
def get_brand(user, brand_id):
    """Get single brand details"""
    brand = Brand.query.get_or_404(brand_id)
    return jsonify(brand.to_dict())

@app.route('/api/brands', methods=['POST'])
@role_required('Admin', 'Campaign Manager')
def create_brand(user):
    """Create a new brand"""
    data = request.get_json()

    if not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400

    try:
        brand = Brand(
            name=data['name'],
            description=data.get('description', ''),
            status=data.get('status', 'active'),
            created_by_user_id=user.id
        )

        # Assign categories if provided
        if 'category_ids' in data and isinstance(data['category_ids'], list):
            categories = Category.query.filter(Category.id.in_(data['category_ids'])).all()
            brand.categories = categories

        db.session.add(brand)
        db.session.commit()

        return jsonify(brand.to_dict()), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create brand', 'details': str(e)}), 500

@app.route('/api/brands/<int:brand_id>', methods=['PUT'])
@role_required('Admin', 'Campaign Manager')
def update_brand(user, brand_id):
    """Update brand details"""
    brand = Brand.query.get_or_404(brand_id)
    data = request.get_json()

    try:
        if 'name' in data:
            brand.name = data['name']
        if 'description' in data:
            brand.description = data['description']
        if 'status' in data:
            brand.status = data['status']
        if 'category_ids' in data and isinstance(data['category_ids'], list):
            categories = Category.query.filter(Category.id.in_(data['category_ids'])).all()
            brand.categories = categories

        brand.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify(brand.to_dict())

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update brand', 'details': str(e)}), 500

@app.route('/api/brands/<int:brand_id>', methods=['DELETE'])
@role_required('Admin')
def delete_brand(user, brand_id):
    """Delete brand"""
    brand = Brand.query.get_or_404(brand_id)

    try:
        db.session.delete(brand)
        db.session.commit()

        return jsonify({'message': 'Brand deleted successfully'})

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete brand', 'details': str(e)}), 500

# ==================== INITIALIZE DATABASE ====================

def migrate_roles():
    """Migrate old role names to new ones and ensure Influencer role exists"""
    # Rename Manager -> Campaign Manager
    manager_role = Role.query.filter_by(name='Manager').first()
    if manager_role:
        manager_role.name = 'Campaign Manager'
        manager_role.description = 'Campaign management access'
        manager_role.permissions = '["campaigns.read", "campaigns.write", "campaigns.delete", "influencers.read", "influencers.write"]'
        print("[MIGRATE] Renamed 'Manager' role to 'Campaign Manager'")

    # Rename Viewer -> Campaign Executor
    viewer_role = Role.query.filter_by(name='Viewer').first()
    if viewer_role:
        viewer_role.name = 'Campaign Executor'
        viewer_role.description = 'Campaign execution access'
        viewer_role.permissions = '["campaigns.read", "influencers.read", "influencers.assign", "influencers.links"]'
        print("[MIGRATE] Renamed 'Viewer' role to 'Campaign Executor'")

    # Create Influencer role if not exists
    if not Role.query.filter_by(name='Influencer').first():
        influencer_role = Role(
            name='Influencer',
            description='Influencer self-service access',
            permissions='["influencer.self.read", "influencer.self.write", "campaigns.self.read"]'
        )
        db.session.add(influencer_role)
        print("[MIGRATE] Created 'Influencer' role")

    # Ensure Campaign Manager role exists (for fresh DBs that already have new names)
    if not Role.query.filter_by(name='Campaign Manager').first():
        cm_role = Role(
            name='Campaign Manager',
            description='Campaign management access',
            permissions='["campaigns.read", "campaigns.write", "campaigns.delete", "influencers.read", "influencers.write"]'
        )
        db.session.add(cm_role)

    # Ensure Campaign Executor role exists
    if not Role.query.filter_by(name='Campaign Executor').first():
        ce_role = Role(
            name='Campaign Executor',
            description='Campaign execution access',
            permissions='["campaigns.read", "influencers.read", "influencers.assign", "influencers.links"]'
        )
        db.session.add(ce_role)

    db.session.commit()

def init_db():
    with app.app_context():
        # Create all tables first
        db.create_all()

        # Always run role migration
        migrate_roles()

        # Seed default categories if none exist
        if Category.query.count() == 0:
            default_categories = [
                {'name': 'Fashion', 'icon': '', 'description': 'Fashion and apparel'},
                {'name': 'Lifestyle', 'icon': '', 'description': 'Lifestyle and daily living'},
                {'name': 'Beauty', 'icon': '', 'description': 'Beauty and cosmetics'},
                {'name': 'Tech', 'icon': '', 'description': 'Technology and gadgets'},
                {'name': 'Gaming', 'icon': '', 'description': 'Gaming and esports'},
                {'name': 'Gadgets', 'icon': '', 'description': 'Electronic gadgets and devices'},
                {'name': 'Fitness', 'icon': '', 'description': 'Fitness and exercise'},
                {'name': 'Health', 'icon': '', 'description': 'Health and wellness'},
                {'name': 'Wellness', 'icon': '', 'description': 'Mental and physical wellness'},
                {'name': 'Food', 'icon': '', 'description': 'Food and cooking'},
                {'name': 'Travel', 'icon': '', 'description': 'Travel and tourism'},
                {'name': 'Music', 'icon': '', 'description': 'Music and audio'},
                {'name': 'Art', 'icon': '', 'description': 'Art and creativity'},
                {'name': 'Photography', 'icon': '', 'description': 'Photography and videography'},
                {'name': 'Comedy', 'icon': '', 'description': 'Comedy and humor'},
                {'name': 'Entertainment', 'icon': '', 'description': 'Entertainment and media'},
                {'name': 'Education', 'icon': '', 'description': 'Education and learning'},
                {'name': 'Business', 'icon': '', 'description': 'Business and entrepreneurship'},
                {'name': 'Finance', 'icon': '', 'description': 'Finance and investment'},
                {'name': 'Sports', 'icon': '', 'description': 'Sports and athletics'},
                {'name': 'Automotive', 'icon': '', 'description': 'Cars and automotive'},
                {'name': 'Parenting', 'icon': '', 'description': 'Parenting and family'},
                {'name': 'Home & Decor', 'icon': '', 'description': 'Home decoration and interior design'},
                {'name': 'Pets', 'icon': '', 'description': 'Pets and animal care'},
            ]
            for cat_data in default_categories:
                db.session.add(Category(**cat_data))
            db.session.commit()
            print(f"[OK] Seeded {len(default_categories)} default categories")

        # Seed default location data if none exist
        if Country.query.count() == 0:
            india = Country(name='India', code='IN')
            db.session.add(india)
            db.session.flush()

            india_states = {
                'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Aurangabad', 'Navi Mumbai'],
                'Delhi': ['New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi'],
                'Karnataka': ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubli', 'Belgaum'],
                'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Salem', 'Tiruchirappalli'],
                'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam'],
                'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar'],
                'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer'],
                'Uttar Pradesh': ['Lucknow', 'Noida', 'Ghaziabad', 'Agra', 'Varanasi', 'Kanpur'],
                'West Bengal': ['Kolkata', 'Howrah', 'Siliguri', 'Durgapur', 'Asansol'],
                'Kerala': ['Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Kollam'],
                'Madhya Pradesh': ['Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain'],
                'Punjab': ['Chandigarh', 'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala'],
                'Haryana': ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Karnal'],
                'Bihar': ['Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur'],
                'Odisha': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Puri'],
                'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Tirupati'],
                'Assam': ['Guwahati', 'Silchar', 'Dibrugarh'],
                'Jharkhand': ['Ranchi', 'Jamshedpur', 'Dhanbad'],
                'Uttarakhand': ['Dehradun', 'Haridwar', 'Rishikesh'],
                'Goa': ['Panaji', 'Margao', 'Vasco da Gama'],
                'Chhattisgarh': ['Raipur', 'Bhilai', 'Bilaspur'],
            }

            for state_name, cities in india_states.items():
                state = State(name=state_name, country_id=india.id)
                db.session.add(state)
                db.session.flush()
                for city_name in cities:
                    db.session.add(City(name=city_name, state_id=state.id))

            db.session.commit()
            print(f"[OK] Seeded India with {len(india_states)} states and cities")

        # Check if admin user exists and is active
        existing_admin = User.query.filter_by(username='admin').first()
        if existing_admin:
            # Ensure admin is always active
            existing_admin.is_active = True
            # Ensure admin has Admin role
            admin_role = Role.query.filter_by(name='Admin').first()
            if admin_role and admin_role not in existing_admin.roles:
                existing_admin.roles.append(admin_role)
            db.session.commit()
            print("[OK] Admin account activated and verified!")
            return

        # Create default roles
        admin_role = Role(name='Admin', description='Full system access', permissions='["*"]')
        campaign_manager_role = Role.query.filter_by(name='Campaign Manager').first()
        campaign_executor_role = Role.query.filter_by(name='Campaign Executor').first()

        db.session.add(admin_role)
        db.session.commit()
        
        # Create default admin user (always active, cannot be deactivated)
        admin_user = User(
            username='admin',
            email='admin@example.com',
            first_name='Admin',
            last_name='User',
            is_active=True  # Explicitly set to True
        )
        admin_user.set_password('admin123')
        admin_user.roles.append(admin_role)
        db.session.add(admin_user)
        db.session.flush()  # Flush to get the ID
        
        # Double-check admin is active
        admin_user.is_active = True
        
        # Create sample manager user
        manager_user = User(
            username='manager',
            email='manager@example.com',
            first_name='Manager',
            last_name='User',
            is_active=True
        )
        manager_user.set_password('manager123')
        manager_user.roles.append(campaign_manager_role)
        db.session.add(manager_user)
        
        db.session.commit()
        
        # Sample influencer names and data
        influencer_data = [
            {'name': 'Ashish Chanchlani', 'username': '@ashishchanchlani', 'platform': 'YouTube', 'followers': 295000, 'tier': 'Macro'},
            {'name': 'Karan Sonawane', 'username': '@focusedindian', 'platform': 'Instagram', 'followers': 1500000, 'tier': 'Mega'},
            {'name': 'Amritha Thendral', 'username': '@amritha', 'platform': 'Instagram', 'followers': 841200, 'tier': 'Macro'},
            {'name': 'SANKET MEHTA', 'username': '@sanket125', 'platform': 'Instagram', 'followers': 841200, 'tier': 'Macro'},
            {'name': 'Rishabh Chawla', 'username': '@rishabh', 'platform': 'Instagram', 'followers': 366400, 'tier': 'Micro'},
            {'name': 'Focused Indian', 'username': '@focusedindian', 'platform': 'YouTube', 'followers': 295000, 'tier': 'Macro'},
            {'name': 'Ananya Nagalla', 'username': '@ananya', 'platform': 'Instagram', 'followers': 520000, 'tier': 'Macro'},
        ]
        
        # Create Campaign 1: Jurassic World Movie Reviewers
        campaign1 = Campaign(
            campaign_name="Jurassic World Movie Reviewers",
            objective="Brand Awareness",
            brand="Universal Pictures",
            description="Movie promotion campaign with top content creators",
            status="active",
            start_date=datetime(2025, 6, 24),
            end_date=datetime(2025, 7, 15),
            created_at=datetime(2025, 6, 30),
            created_by_user_id=manager_user.id
        )
        campaign1.assigned_users.append(manager_user)
        db.session.add(campaign1)
        db.session.commit()
        
        # Add influencers to campaign 1
        campaign1_influencers = []
        for i, inf_data in enumerate(influencer_data[:5]):
            influencer = Influencer(
                campaign_id=campaign1.id,
                **inf_data
            )
            db.session.add(influencer)
            campaign1_influencers.append(influencer)
        
        db.session.commit()
        
        # Add content for campaign 1
        platforms = ['YouTube', 'Instagram', 'Instagram', 'Instagram']
        content_types = ['Video', 'Reel', 'Reel', 'Reel']
        
        for i, influencer in enumerate(campaign1_influencers):
            # Each influencer creates 2-4 pieces of content
            num_content = random.randint(2, 4)
            for j in range(num_content):
                days_offset = random.randint(0, 15)
                views = random.randint(10000, 7000000)
                likes = int(views * random.uniform(0.02, 0.15))
                comments = int(likes * random.uniform(0.01, 0.05))
                shares = int(comments * random.uniform(0.1, 0.5))
                
                content = Content(
                    campaign_id=campaign1.id,
                    influencer_id=influencer.id,
                    platform=random.choice(['YouTube', 'Instagram', 'Instagram']),
                    content_type=random.choice(['Video', 'Reel', 'Post']),
                    url=f"https://example.com/post/{i}{j}",
                    thumbnail=f"https://placehold.co/400x300?text=Content+{i}{j}",
                    views=views,
                    likes=likes,
                    comments=comments,
                    shares=shares,
                    engagement_rate=round((likes + comments) / views * 100, 2) if views > 0 else 0,
                    published_at=datetime(2025, 6, 24) + timedelta(days=days_offset)
                )
                db.session.add(content)
        
        # Create Campaign 2: Summer Fashion Launch
        campaign2 = Campaign(
            campaign_name="Summer Fashion Launch",
            objective="Brand Awareness",
            brand="StyleHub",
            description="Summer collection showcase",
            status="active",
            start_date=datetime(2024, 6, 1),
            end_date=datetime(2024, 8, 31),
            created_at=datetime(2024, 6, 1),
            created_by_user_id=manager_user.id
        )
        campaign2.assigned_users.append(manager_user)
        db.session.add(campaign2)
        db.session.commit()
        
        # Add influencers to campaign 2
        campaign2_influencers = []
        for inf_data in influencer_data[2:5]:
            influencer = Influencer(
                campaign_id=campaign2.id,
                **inf_data
            )
            db.session.add(influencer)
            campaign2_influencers.append(influencer)
        
        db.session.commit()
        
        # Add content for campaign 2
        for influencer in campaign2_influencers:
            for j in range(random.randint(3, 6)):
                days_offset = random.randint(0, 90)
                views = random.randint(50000, 500000)
                likes = int(views * random.uniform(0.03, 0.12))
                comments = int(likes * random.uniform(0.02, 0.08))
                
                content = Content(
                    campaign_id=campaign2.id,
                    influencer_id=influencer.id,
                    platform='Instagram',
                    content_type=random.choice(['Post', 'Reel']),
                    url=f"https://example.com/post/{influencer.id}{j}",
                    views=views,
                    likes=likes,
                    comments=comments,
                    engagement_rate=round((likes + comments) / views * 100, 2),
                    published_at=datetime(2024, 6, 1) + timedelta(days=days_offset)
                )
                db.session.add(content)
        
        # Create Campaign 3: Tech Product Review
        campaign3 = Campaign(
            campaign_name="Tech Product Review",
            objective="Product Launch",
            brand="TechGadgets Inc",
            description="New smartphone launch campaign",
            status="completed",
            start_date=datetime(2024, 3, 15),
            end_date=datetime(2024, 5, 15),
            created_at=datetime(2024, 3, 15),
            created_by_user_id=admin_user.id
        )
        campaign3.assigned_users.append(admin_user)
        db.session.add(campaign3)
        db.session.commit()
        
        # Create Campaign 4: Fitness Challenge 2024
        campaign4 = Campaign(
            campaign_name="Fitness Challenge 2024",
            objective="Engagement",
            brand="FitLife",
            description="30-day fitness transformation challenge",
            status="active",
            start_date=datetime(2024, 7, 1),
            end_date=None,
            created_at=datetime(2024, 7, 1),
            created_by_user_id=manager_user.id
        )
        campaign4.assigned_users.append(manager_user)
        db.session.add(campaign4)
        
        db.session.commit()
        print("[OK] Database initialized with comprehensive sample data!")

if __name__ == '__main__':
    init_db()
    print("[STARTING] Backend server starting on http://localhost:5000")
    app.run(debug=True, port=5000)