from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail, Message
from datetime import datetime, timedelta
from functools import wraps
import random
import string
import jwt
import json
from werkzeug.security import generate_password_hash, check_password_hash
import os
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
            'last_login': self.last_login.strftime('%Y-%m-%d %H:%M:%S') if self.last_login else None
        }

class Campaign(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    campaign_name = db.Column(db.String(200), nullable=False)
    objective = db.Column(db.String(200), nullable=False)
    brand = db.Column(db.Integer, db.ForeignKey('brand.id'), nullable=False)
    description = db.Column(db.Text)
    status = db.Column(db.String(50), nullable=False)
    start_date = db.Column(db.DateTime, nullable=False)
    end_date = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)  # Campaign creator

    # Relationships
    brand_rel = db.relationship('Brand', backref='campaigns')
    campaign_influencers = db.relationship('CampaignInfluencer', back_populates='campaign', cascade='all, delete-orphan')
    content = db.relationship('Content', backref='campaign', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'campaign_name': self.campaign_name,
            'objective': self.objective,
            'brand': self.brand,
            'brand_name': self.brand_rel.name if self.brand_rel else None,
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
            inf_data = ci.influencer.to_dict()
            inf_data.update({
                'assignment_id': ci.id,
                'platform': ci.platform,
                'deliverables_count': ci.deliverables_count,
                'status': ci.status,
                'agreed_amount': ci.agreed_amount
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

    # Influencer Tier (Nano < 10K, Micro 10K-100K, Macro 100K-1M, Mega > 1M)
    tier = db.Column(db.String(50))

    # Rate Card
    rate_per_post_instagram = db.Column(db.Float)
    rate_per_reel_instagram = db.Column(db.Float)
    rate_per_story_instagram = db.Column(db.Float)
    rate_per_video_youtube = db.Column(db.Float)
    rate_per_short_youtube = db.Column(db.Float)
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

    # Relationships
    campaign_assignments = db.relationship('CampaignInfluencer', back_populates='influencer', cascade='all, delete-orphan')

    def get_max_followers(self):
        """Get maximum followers across all platforms"""
        return max(
            self.instagram_followers or 0,
            self.youtube_subscribers or 0,
            self.tiktok_followers or 0,
            self.twitter_followers or 0
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
            'city': self.city,
            'state': self.state,
            'country': self.country,
            'instagram_handle': self.instagram_handle,
            'instagram_followers': self.instagram_followers,
            'instagram_url': self.instagram_url,
            'youtube_handle': self.youtube_handle,
            'youtube_subscribers': self.youtube_subscribers,
            'youtube_url': self.youtube_url,
            'tiktok_handle': self.tiktok_handle,
            'tiktok_followers': self.tiktok_followers,
            'tiktok_url': self.tiktok_url,
            'twitter_handle': self.twitter_handle,
            'twitter_followers': self.twitter_followers,
            'twitter_url': self.twitter_url,
            'tier': self.tier,
            'max_followers': self.get_max_followers(),
            'rate_per_post_instagram': self.rate_per_post_instagram,
            'rate_per_reel_instagram': self.rate_per_reel_instagram,
            'rate_per_story_instagram': self.rate_per_story_instagram,
            'rate_per_video_youtube': self.rate_per_video_youtube,
            'rate_per_short_youtube': self.rate_per_short_youtube,
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
            'total_campaigns': len(self.campaign_assignments)
        }

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

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'status': self.status or 'active',
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

                    <p>You can access the dashboard at: <a href="http://localhost:3000">http://localhost:3000</a></p>

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
        # Default to Manager role if not specified
        default_role = Role.query.filter_by(name='Manager').first()
        if default_role:
            new_user.roles.append(default_role)
        else:
            # If Manager role doesn't exist, try Viewer role
            viewer_role = Role.query.filter_by(name='Viewer').first()
            if viewer_role:
                new_user.roles.append(viewer_role)

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
@role_required('Admin', 'Manager')
def create_campaign(user):
    """Create a new campaign and auto-assign to creator (Admin/Manager only)"""
    data = request.get_json()
    
    # Validate required fields
    required_fields = ['campaign_name', 'objective', 'brand', 'status', 'start_date']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400

    # Validate brand exists
    brand_obj = Brand.query.get(data['brand'])
    if not brand_obj:
        return jsonify({'error': 'Invalid brand'}), 400

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
            brand=data['brand'],
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
                    status='pending',  # Default status
                    assigned_by_user_id=user.id,
                    assigned_at=datetime.utcnow()
                )
                db.session.add(campaign_influencer)

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
    """Update campaign user assignments (Admin only or campaign creator)"""
    campaign = Campaign.query.get_or_404(campaign_id)
    
    # Only admin or creator can update assignments
    if not user.has_role('Admin') and campaign.created_by_user_id != user.id:
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
    
    # Calculate daily metrics
    content_by_date = {}
    for content in campaign.content:
        date_key = content.published_at.strftime('%Y-%m-%d')
        if date_key not in content_by_date:
            content_by_date[date_key] = {
                'date': date_key,
                'views': 0,
                'likes': 0,
                'comments': 0,
                'content_count': 0
            }
        content_by_date[date_key]['views'] += content.views
        content_by_date[date_key]['likes'] += content.likes
        content_by_date[date_key]['comments'] += content.comments
        content_by_date[date_key]['content_count'] += 1
    
    daily_metrics = sorted(content_by_date.values(), key=lambda x: x['date'])
    
    # Calculate platform breakdown
    platform_stats = {}
    for content in campaign.content:
        if content.platform not in platform_stats:
            platform_stats[content.platform] = {
                'platform': content.platform,
                'content_count': 0,
                'views': 0,
                'likes': 0,
                'comments': 0
            }
        platform_stats[content.platform]['content_count'] += 1
        platform_stats[content.platform]['views'] += content.views
        platform_stats[content.platform]['likes'] += content.likes
        platform_stats[content.platform]['comments'] += content.comments
    
    return jsonify({
        'daily_metrics': daily_metrics,
        'platform_stats': list(platform_stats.values()),
        'top_performers': sorted(
            [c.to_dict() for c in campaign.content],
            key=lambda x: x['views'],
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

    # Start with base query
    query = Influencer.query

    # Apply filters
    if status:
        query = query.filter_by(status=status)

    if tier:
        query = query.filter_by(tier=tier)

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
@role_required('Admin', 'Manager')
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
            city=data.get('city'),
            state=data.get('state'),
            country=data.get('country', 'India'),

            instagram_handle=data.get('instagram_handle'),
            instagram_followers=data.get('instagram_followers', 0),
            instagram_url=data.get('instagram_url'),

            youtube_handle=data.get('youtube_handle'),
            youtube_subscribers=data.get('youtube_subscribers', 0),
            youtube_url=data.get('youtube_url'),

            tiktok_handle=data.get('tiktok_handle'),
            tiktok_followers=data.get('tiktok_followers', 0),
            tiktok_url=data.get('tiktok_url'),

            twitter_handle=data.get('twitter_handle'),
            twitter_followers=data.get('twitter_followers', 0),
            twitter_url=data.get('twitter_url'),

            rate_per_post_instagram=data.get('rate_per_post_instagram'),
            rate_per_reel_instagram=data.get('rate_per_reel_instagram'),
            rate_per_story_instagram=data.get('rate_per_story_instagram'),
            rate_per_video_youtube=data.get('rate_per_video_youtube'),
            rate_per_short_youtube=data.get('rate_per_short_youtube'),
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

        return jsonify(influencer.to_dict()), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create influencer', 'details': str(e)}), 500

@app.route('/api/influencers/<int:influencer_id>', methods=['PUT'])
@role_required('Admin', 'Manager')
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
        if 'city' in data:
            influencer.city = data['city']
        if 'state' in data:
            influencer.state = data['state']
        if 'country' in data:
            influencer.country = data['country']

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

        if 'tiktok_handle' in data:
            influencer.tiktok_handle = data['tiktok_handle']
        if 'tiktok_followers' in data:
            influencer.tiktok_followers = data['tiktok_followers']
        if 'tiktok_url' in data:
            influencer.tiktok_url = data['tiktok_url']

        if 'twitter_handle' in data:
            influencer.twitter_handle = data['twitter_handle']
        if 'twitter_followers' in data:
            influencer.twitter_followers = data['twitter_followers']
        if 'twitter_url' in data:
            influencer.twitter_url = data['twitter_url']

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
@role_required('Admin', 'Manager')
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

        db.session.add(brand)
        db.session.commit()

        return jsonify(brand.to_dict()), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create brand', 'details': str(e)}), 500

@app.route('/api/brands/<int:brand_id>', methods=['PUT'])
@role_required('Admin', 'Manager')
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

def init_db():
    with app.app_context():
        # Create all tables first
        db.create_all()

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
        manager_role = Role(name='Manager', description='Campaign management access', permissions='["campaigns.read", "campaigns.write", "campaigns.delete"]')
        viewer_role = Role(name='Viewer', description='Read-only access', permissions='["campaigns.read"]')
        
        db.session.add(admin_role)
        db.session.add(manager_role)
        db.session.add(viewer_role)
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
        manager_user.roles.append(manager_role)
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
                    thumbnail=f"https://via.placeholder.com/400x300?text=Content+{i}{j}",
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