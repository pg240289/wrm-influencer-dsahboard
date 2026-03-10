"""
Social Media Metrics Fetcher Service
=====================================
A cron job service that fetches engagement metrics (likes, views, comments)
from YouTube videos on an hourly basis.

Fetches data from the `campaign_influencer` table where:
- `platform` column is defined (e.g., 'YouTube')
- `link` column contains the video/post URL

For each campaign_influencer with a link, it:
1. Fetches metrics from the YouTube API
2. Finds or creates a corresponding content record
3. Updates the content record with views, likes, comments, etc.

Usage:
    python social_metrics_service.py          # Run with hourly scheduler
    python social_metrics_service.py --once   # Run once for testing

Environment Variables Required:
    - YOUTUBE_API_KEY: Google/YouTube Data API v3 key

Note: Database connection uses the same .env settings as app.py
"""

import os
import re
import json
import logging
import requests
from datetime import datetime
from urllib.parse import urlparse, parse_qs
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('social_metrics.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('SocialMetricsService')

# Initialize Flask app for database context
app = Flask(__name__)

# Configure database (same as app.py)
db_host = os.getenv('DB_HOST', 'localhost')
db_port = os.getenv('DB_PORT', '3306')
db_user = os.getenv('DB_USER', 'root')
db_password = os.getenv('DB_PASSWORD', '')
db_name = os.getenv('DB_NAME', 'wrm_influencer_dashboard')

app.config['SQLALCHEMY_DATABASE_URI'] = f'mysql+pymysql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)


# ==================== DATABASE MODEL ====================

class CampaignInfluencer(db.Model):
    """Mirror of CampaignInfluencer model from app.py - stores platform links"""
    __tablename__ = 'campaign_influencer'

    id = db.Column(db.Integer, primary_key=True)
    campaign_id = db.Column(db.Integer, nullable=False)
    influencer_id = db.Column(db.Integer, nullable=False)
    platform = db.Column(db.String(50), nullable=False)  # Instagram, YouTube, Twitter, Facebook, LinkedIn
    link = db.Column(db.String(500))  # Social media post/video URL
    content_type = db.Column(db.String(100))
    status = db.Column(db.String(50), default='pending')


class Content(db.Model):
    """Mirror of Content model from app.py for metrics updates"""
    __tablename__ = 'content'

    id = db.Column(db.Integer, primary_key=True)
    campaign_id = db.Column(db.Integer, nullable=False)
    influencer_id = db.Column(db.Integer, nullable=False)
    campaign_influencer_id = db.Column(db.Integer, nullable=False)

    # Content Details
    platform = db.Column(db.String(50), nullable=False)  # Instagram, YouTube, Twitter, Facebook, LinkedIn
    content_type = db.Column(db.String(50), nullable=False)  # Post, Reel, Story, Video, Short, Tweet
    url = db.Column(db.String(500))  # Social media post/video URL

    # Metrics (fetched from social media APIs)
    views = db.Column(db.Integer, default=0)
    likes = db.Column(db.Integer, default=0)
    comments = db.Column(db.Integer, default=0)
    shares = db.Column(db.Integer, default=0)
    saves = db.Column(db.Integer, default=0)
    engagement_rate = db.Column(db.Float, default=0.0)

    # Status
    status = db.Column(db.String(50), default='draft')

    # Timestamps
    last_metrics_update = db.Column(db.DateTime)


class MetricsFetchLog(db.Model):
    """Log table to track metrics fetch attempts"""
    __tablename__ = 'metrics_fetch_log'

    id = db.Column(db.Integer, primary_key=True)
    campaign_influencer_id = db.Column(db.Integer, nullable=True)
    content_id = db.Column(db.Integer, nullable=True)
    platform = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), nullable=False)  # success, failed, skipped
    error_message = db.Column(db.Text)
    views_fetched = db.Column(db.Integer)
    likes_fetched = db.Column(db.Integer)
    comments_fetched = db.Column(db.Integer)
    fetched_at = db.Column(db.DateTime, default=datetime.utcnow)


# ==================== PLATFORM FETCHERS ====================

class BaseFetcher:
    """Base class for platform-specific fetchers"""

    def __init__(self):
        self.api_key = None
        self.access_token = None

    def extract_post_id(self, url):
        """Extract post/video ID from URL - override in subclasses"""
        raise NotImplementedError

    def fetch_metrics(self, url):
        """Fetch metrics for a given URL - override in subclasses"""
        raise NotImplementedError

    def is_configured(self):
        """Check if the fetcher has required credentials"""
        return False


class YouTubeFetcher(BaseFetcher):
    """Fetcher for YouTube video metrics using YouTube Data API v3"""

    def __init__(self):
        super().__init__()
        self.api_key = os.getenv('YOUTUBE_API_KEY')
        self.base_url = 'https://www.googleapis.com/youtube/v3'

    def is_configured(self):
        return bool(self.api_key)

    def extract_video_id(self, url):
        """Extract video ID from various YouTube URL formats"""
        if not url:
            return None

        # Handle different YouTube URL formats
        patterns = [
            r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})',
            r'youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})',
        ]

        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)

        # Try parsing as URL with query params
        try:
            parsed = urlparse(url)
            if 'youtube.com' in parsed.netloc:
                query_params = parse_qs(parsed.query)
                if 'v' in query_params:
                    return query_params['v'][0]
        except:
            pass

        return None

    def fetch_metrics(self, url):
        """Fetch video statistics from YouTube API"""
        if not self.is_configured():
            logger.warning("YouTube API key not configured")
            return None

        video_id = self.extract_video_id(url)
        if not video_id:
            logger.warning(f"Could not extract video ID from URL: {url}")
            return None

        logger.info(f"Extracted video ID: {video_id} from URL: {url}")

        try:
            api_url = f'{self.base_url}/videos'
            params = {
                'part': 'statistics',
                'id': video_id,
                'key': self.api_key
            }
            logger.info(f"Making YouTube API request to: {api_url}")

            response = requests.get(api_url, params=params, timeout=10)

            logger.info(f"YouTube API response status: {response.status_code}")
            logger.info(f"YouTube API response body: {response.text[:500]}")

            response.raise_for_status()

            data = response.json()
            if 'items' not in data or len(data['items']) == 0:
                logger.warning(f"No data found for YouTube video: {video_id}")
                logger.warning(f"Full API response: {data}")
                return None

            stats = data['items'][0]['statistics']
            logger.info(f"YouTube stats for {video_id}: {stats}")

            return {
                'views': int(stats.get('viewCount', 0)),
                'likes': int(stats.get('likeCount', 0)),
                'comments': int(stats.get('commentCount', 0)),
                'shares': 0,  # YouTube API doesn't provide share count
                'saves': 0
            }

        except requests.exceptions.RequestException as e:
            logger.error(f"YouTube API request failed: {e}")
            logger.error(f"Response content: {getattr(e.response, 'text', 'N/A') if hasattr(e, 'response') else 'N/A'}")
            return None
        except (KeyError, ValueError, json.JSONDecodeError) as e:
            logger.error(f"Error parsing YouTube API response: {e}")
            return None


class InstagramFetcher(BaseFetcher):
    """Fetcher for Instagram post/reel metrics using Facebook Graph API"""

    def __init__(self):
        super().__init__()
        self.access_token = os.getenv('INSTAGRAM_ACCESS_TOKEN')
        self.ig_business_account_id = os.getenv('INSTAGRAM_BUSINESS_ACCOUNT_ID')
        self.base_url = 'https://graph.facebook.com/v18.0'

    def is_configured(self):
        return bool(self.access_token)

    def extract_shortcode(self, url):
        if not url:
            return None
        patterns = [
            r'instagram\.com\/p\/([a-zA-Z0-9_-]+)',
            r'instagram\.com\/reel\/([a-zA-Z0-9_-]+)',
            r'instagram\.com\/tv\/([a-zA-Z0-9_-]+)',
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None

    def shortcode_to_media_id(self, shortcode):
        if not shortcode:
            return None
        alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
        media_id = 0
        for char in shortcode:
            media_id = media_id * 64 + alphabet.index(char)
        return str(media_id)

    def get_ig_media_id_from_shortcode(self, shortcode):
        if not self.ig_business_account_id:
            return self.shortcode_to_media_id(shortcode)
        try:
            response = requests.get(
                f'{self.base_url}/{self.ig_business_account_id}/media',
                params={'fields': 'id,shortcode,like_count,comments_count', 'access_token': self.access_token},
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            for media in data.get('data', []):
                if media.get('shortcode') == shortcode:
                    return media.get('id')
        except Exception as e:
            logger.warning(f"Could not find media ID from account: {e}")
        return self.shortcode_to_media_id(shortcode)

    def fetch_metrics(self, url):
        if not self.is_configured():
            return None
        shortcode = self.extract_shortcode(url)
        if not shortcode:
            return None
        try:
            media_id = self.get_ig_media_id_from_shortcode(shortcode)
            if not media_id:
                return None
            response = requests.get(
                f'{self.base_url}/{media_id}',
                params={'fields': 'like_count,comments_count,media_type,timestamp,caption', 'access_token': self.access_token},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                insights_data = {}
                try:
                    insights_response = requests.get(
                        f'{self.base_url}/{media_id}/insights',
                        params={'metric': 'impressions,reach,saved,shares', 'access_token': self.access_token},
                        timeout=10
                    )
                    if insights_response.status_code == 200:
                        insights = insights_response.json().get('data', [])
                        for insight in insights:
                            insights_data[insight['name']] = insight['values'][0]['value']
                except Exception as e:
                    logger.debug(f"Could not fetch insights: {e}")
                return {
                    'views': insights_data.get('impressions', 0),
                    'likes': data.get('like_count', 0),
                    'comments': data.get('comments_count', 0),
                    'shares': insights_data.get('shares', 0),
                    'saves': insights_data.get('saved', 0)
                }
            return None
        except Exception as e:
            logger.error(f"Instagram API request failed: {e}")
            return None


class FacebookFetcher(BaseFetcher):
    """Fetcher for Facebook post/video metrics using Facebook Graph API"""

    def __init__(self):
        super().__init__()
        self.access_token = os.getenv('FACEBOOK_ACCESS_TOKEN')
        self.base_url = 'https://graph.facebook.com/v18.0'

    def is_configured(self):
        return bool(self.access_token)

    def extract_post_id(self, url):
        if not url:
            return None
        patterns = [
            r'facebook\.com\/.*\/posts\/(\d+)',
            r'facebook\.com\/.*\/videos\/(\d+)',
            r'facebook\.com\/watch\/\?v=(\d+)',
            r'fb\.watch\/([a-zA-Z0-9_-]+)',
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None

    def fetch_metrics(self, url):
        if not self.is_configured():
            return None
        post_id = self.extract_post_id(url)
        if not post_id:
            return None
        try:
            response = requests.get(
                f'{self.base_url}/{post_id}',
                params={'fields': 'likes.summary(true),comments.summary(true),shares,reactions.summary(true)', 'access_token': self.access_token},
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            likes = data.get('reactions', {}).get('summary', {}).get('total_count', 0)
            if not likes:
                likes = data.get('likes', {}).get('summary', {}).get('total_count', 0)
            return {
                'views': 0,
                'likes': likes,
                'comments': data.get('comments', {}).get('summary', {}).get('total_count', 0),
                'shares': data.get('shares', {}).get('count', 0),
                'saves': 0
            }
        except Exception as e:
            logger.error(f"Facebook API request failed: {e}")
            return None


class LinkedInFetcher(BaseFetcher):
    """Fetcher for LinkedIn post metrics using LinkedIn API"""

    def __init__(self):
        super().__init__()
        self.access_token = os.getenv('LINKEDIN_ACCESS_TOKEN')
        self.base_url = 'https://api.linkedin.com/v2'

    def is_configured(self):
        return bool(self.access_token)

    def extract_post_id(self, url):
        if not url:
            return None
        patterns = [
            r'linkedin\.com\/feed\/update\/urn:li:activity:(\d+)',
            r'linkedin\.com\/posts\/.*-(\d+)-',
            r'linkedin\.com\/feed\/update\/urn:li:share:(\d+)',
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None

    def fetch_metrics(self, url):
        if not self.is_configured():
            return None
        post_id = self.extract_post_id(url)
        if not post_id:
            return None
        try:
            headers = {
                'Authorization': f'Bearer {self.access_token}',
                'X-Restli-Protocol-Version': '2.0.0',
                'LinkedIn-Version': '202304'
            }
            response = requests.get(
                f'{self.base_url}/socialActions/urn:li:share:{post_id}',
                headers=headers,
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            return {
                'views': 0,
                'likes': data.get('likesSummary', {}).get('totalLikes', 0),
                'comments': data.get('commentsSummary', {}).get('totalFirstLevelComments', 0),
                'shares': 0,
                'saves': 0
            }
        except Exception as e:
            logger.error(f"LinkedIn API request failed: {e}")
            return None


class TwitterFetcher(BaseFetcher):
    """Fetcher for Twitter/X post metrics using Twitter API v2"""

    def __init__(self):
        super().__init__()
        self.bearer_token = os.getenv('TWITTER_BEARER_TOKEN')
        self.base_url = 'https://api.twitter.com/2'

    def is_configured(self):
        return bool(self.bearer_token)

    def extract_tweet_id(self, url):
        """Extract tweet ID from various Twitter/X URL formats"""
        if not url:
            return None
        patterns = [
            r'(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)',
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None

    def fetch_metrics(self, url):
        """Fetch tweet metrics from Twitter API v2"""
        if not self.is_configured():
            logger.warning("Twitter Bearer Token not configured")
            return None

        tweet_id = self.extract_tweet_id(url)
        if not tweet_id:
            logger.warning(f"Could not extract tweet ID from URL: {url}")
            return None

        logger.info(f"Extracted tweet ID: {tweet_id} from URL: {url}")

        try:
            headers = {
                'Authorization': f'Bearer {self.bearer_token}'
            }
            params = {
                'tweet.fields': 'public_metrics'
            }

            response = requests.get(
                f'{self.base_url}/tweets/{tweet_id}',
                headers=headers,
                params=params,
                timeout=10
            )

            logger.info(f"Twitter API response status: {response.status_code}")

            response.raise_for_status()
            data = response.json()

            metrics = data.get('data', {}).get('public_metrics', {})
            if not metrics:
                logger.warning(f"No metrics found for tweet: {tweet_id}")
                return None

            logger.info(f"Twitter metrics for {tweet_id}: {metrics}")

            return {
                'views': int(metrics.get('impression_count', 0)),
                'likes': int(metrics.get('like_count', 0)),
                'comments': int(metrics.get('reply_count', 0)),
                'shares': int(metrics.get('retweet_count', 0)) + int(metrics.get('quote_count', 0)),
                'saves': int(metrics.get('bookmark_count', 0))
            }

        except requests.exceptions.RequestException as e:
            logger.error(f"Twitter API request failed: {e}")
            return None
        except (KeyError, ValueError, json.JSONDecodeError) as e:
            logger.error(f"Error parsing Twitter API response: {e}")
            return None


# ==================== METRICS SERVICE ====================

class SocialMetricsService:
    """Main service that orchestrates metrics fetching for all platforms"""

    def __init__(self):
        self.fetchers = {
            'YouTube': YouTubeFetcher(),
            'Instagram': InstagramFetcher(),
            'Facebook': FacebookFetcher(),
            'LinkedIn': LinkedInFetcher(),
            'Twitter': TwitterFetcher(),
        }

        # Log configuration status
        for platform, fetcher in self.fetchers.items():
            status = "configured" if fetcher.is_configured() else "NOT configured"
            logger.info(f"{platform} fetcher: {status}")

    def detect_platform(self, url):
        """Detect platform from URL"""
        if not url:
            return None

        url_lower = url.lower()

        if 'youtube.com' in url_lower or 'youtu.be' in url_lower:
            return 'YouTube'
        elif 'instagram.com' in url_lower:
            return 'Instagram'
        elif 'facebook.com' in url_lower or 'fb.watch' in url_lower:
            return 'Facebook'
        elif 'linkedin.com' in url_lower:
            return 'LinkedIn'
        elif 'twitter.com' in url_lower or 'x.com' in url_lower:
            return 'Twitter'

        return None

    def fetch_metrics_for_url(self, url, platform):
        """Fetch metrics for a URL"""
        if not url:
            logger.warning(f"No URL provided, skipping")
            return None

        # Detect platform from URL or use provided platform
        detected_platform = self.detect_platform(url) or platform

        if detected_platform not in self.fetchers:
            logger.warning(f"No fetcher available for platform: {detected_platform}")
            return None

        fetcher = self.fetchers[detected_platform]

        if not fetcher.is_configured():
            logger.debug(f"Fetcher for {detected_platform} is not configured, skipping")
            return None

        logger.info(f"Fetching metrics from {detected_platform} for URL: {url}")

        metrics = fetcher.fetch_metrics(url)
        return metrics

    def update_content_metrics(self, content, metrics):
        """Update content record with fetched metrics"""
        if not metrics:
            return False

        try:
            # Only update if we got valid data
            if metrics.get('views', 0) > 0 or metrics.get('likes', 0) > 0:
                content.views = metrics.get('views', content.views or 0)
                content.likes = metrics.get('likes', content.likes or 0)
                content.comments = metrics.get('comments', content.comments or 0)
                content.shares = metrics.get('shares', content.shares or 0)
                content.saves = metrics.get('saves', content.saves or 0)
                content.last_metrics_update = datetime.utcnow()

                # Recalculate engagement rate if we have views
                if content.views > 0:
                    engagement = (content.likes + content.comments + (content.shares or 0) + (content.saves or 0))
                    content.engagement_rate = round((engagement / content.views) * 100, 2)

                return True
        except Exception as e:
            logger.error(f"Error updating Content {content.id}: {e}")

        return False

    def get_content_type_from_platform(self, platform, url):
        """Determine content type based on platform and URL"""
        if platform == 'YouTube':
            if 'shorts' in url.lower():
                return 'Short'
            return 'Video'
        elif platform == 'Instagram':
            if 'reel' in url.lower():
                return 'Reel'
            elif 'stories' in url.lower():
                return 'Story'
            return 'Post'
        elif platform == 'Facebook':
            if 'reel' in url.lower():
                return 'Reel'
            return 'Post'
        elif platform == 'Twitter':
            return 'Tweet'
        elif platform == 'LinkedIn':
            return 'Post'
        return 'Post'

    def find_or_create_content(self, ci_record):
        """Find existing content or create new one from campaign_influencer record"""
        # Check if content already exists for this campaign_influencer with this URL
        existing_content = Content.query.filter_by(
            campaign_influencer_id=ci_record.id,
            url=ci_record.link
        ).first()

        if existing_content:
            logger.info(f"Found existing Content {existing_content.id} for CampaignInfluencer {ci_record.id}")
            return existing_content

        # Create new content record
        content_type = self.get_content_type_from_platform(ci_record.platform, ci_record.link)

        new_content = Content(
            campaign_id=ci_record.campaign_id,
            influencer_id=ci_record.influencer_id,
            campaign_influencer_id=ci_record.id,
            platform=ci_record.platform,
            content_type=content_type,
            url=ci_record.link,
            status='published'
        )
        db.session.add(new_content)
        db.session.flush()  # Get the ID without committing

        logger.info(f"Created new Content {new_content.id} for CampaignInfluencer {ci_record.id}")
        return new_content

    def run_fetch_job(self):
        """Main job that fetches metrics from campaign_influencer links"""
        logger.info("=" * 60)
        logger.info("Starting scheduled metrics fetch job")
        logger.info("=" * 60)

        with app.app_context():
            # Get all campaign_influencer records with links
            ci_records = CampaignInfluencer.query.filter(
                CampaignInfluencer.link.isnot(None),
                CampaignInfluencer.link != '',
                CampaignInfluencer.platform.isnot(None)
            ).all()

            logger.info(f"Found {len(ci_records)} campaign_influencer records with links to process")

            success_count = 0
            failed_count = 0
            skipped_count = 0

            for ci_record in ci_records:
                try:
                    logger.info(f"Processing CampaignInfluencer {ci_record.id}: platform={ci_record.platform}, link={ci_record.link}")

                    # Fetch metrics from the API
                    metrics = self.fetch_metrics_for_url(ci_record.link, ci_record.platform)

                    if metrics:
                        # Find or create content record
                        content = self.find_or_create_content(ci_record)

                        if self.update_content_metrics(content, metrics):
                            success_count += 1

                            # Log successful fetch
                            log_entry = MetricsFetchLog(
                                campaign_influencer_id=ci_record.id,
                                content_id=content.id,
                                platform=ci_record.platform,
                                status='success',
                                views_fetched=metrics.get('views'),
                                likes_fetched=metrics.get('likes'),
                                comments_fetched=metrics.get('comments')
                            )
                            db.session.add(log_entry)

                            logger.info(
                                f"Updated Content {content.id} for CampaignInfluencer {ci_record.id}: "
                                f"views={metrics.get('views')}, "
                                f"likes={metrics.get('likes')}, "
                                f"comments={metrics.get('comments')}"
                            )
                        else:
                            failed_count += 1
                            logger.warning(f"No valid metrics data for CampaignInfluencer {ci_record.id}")
                    else:
                        skipped_count += 1
                        logger.info(f"Skipped CampaignInfluencer {ci_record.id} - no metrics returned")

                except Exception as e:
                    failed_count += 1
                    logger.error(f"Error processing CampaignInfluencer {ci_record.id}: {e}")

                    # Log failed fetch
                    log_entry = MetricsFetchLog(
                        campaign_influencer_id=ci_record.id,
                        platform=ci_record.platform,
                        status='failed',
                        error_message=str(e)
                    )
                    db.session.add(log_entry)

            # Commit all changes
            try:
                db.session.commit()
                logger.info("Database changes committed successfully")
            except Exception as e:
                logger.error(f"Error committing changes: {e}")
                db.session.rollback()

            logger.info("=" * 60)
            logger.info("Metrics fetch job completed")
            logger.info(f"Success: {success_count}, Failed: {failed_count}, Skipped: {skipped_count}")
            logger.info("=" * 60)


# ==================== SCHEDULER ====================

def create_scheduler():
    """Create and configure the APScheduler"""
    scheduler = BlockingScheduler()
    service = SocialMetricsService()

    # Schedule hourly job
    scheduler.add_job(
        service.run_fetch_job,
        CronTrigger(minute=0),  # Run at the start of every hour
        id='hourly_metrics_fetch',
        name='Fetch social media metrics every hour',
        replace_existing=True
    )

    logger.info("Scheduler configured to run metrics fetch every hour at minute 0")

    return scheduler, service


def run_once():
    """Run the metrics fetch job once (for testing)"""
    service = SocialMetricsService()
    service.run_fetch_job()


# ==================== MAIN ====================

if __name__ == '__main__':
    import sys

    print("=" * 60)
    print("Social Media Metrics Fetcher Service")
    print("=" * 60)

    # Check if running in test mode
    if len(sys.argv) > 1 and sys.argv[1] == '--once':
        print("\nRunning in single-run mode...")
        run_once()
    else:
        print("\nStarting scheduler...")
        print("The service will fetch metrics every hour at minute 0")
        print("Press Ctrl+C to stop\n")

        # Run once immediately on startup
        print("Running initial fetch...")
        service = SocialMetricsService()
        service.run_fetch_job()

        # Start the scheduler
        scheduler, _ = create_scheduler()

        try:
            scheduler.start()
        except (KeyboardInterrupt, SystemExit):
            logger.info("Scheduler stopped by user")
            print("\nService stopped.")
