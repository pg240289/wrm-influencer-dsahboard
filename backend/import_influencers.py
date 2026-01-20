"""
Import Influencers from CSV
Loads influencer data from CSV file into the database
"""

import os
import csv
import json
from datetime import datetime
from flask import Flask
from flask_sqlalchemy import SQLAlchemy

# Import app instance
from app import app, db, Influencer

def parse_categories(categories_str):
    """Convert pipe-separated string to list"""
    if not categories_str or categories_str.strip() == '':
        return []
    return [cat.strip() for cat in categories_str.split('|')]

def parse_brands(brands_str):
    """Convert pipe-separated string to list"""
    if not brands_str or brands_str.strip() == '':
        return []
    return [brand.strip() for brand in brands_str.split('|')]

def parse_bool(value):
    """Convert string to boolean"""
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.upper() in ['TRUE', 'YES', '1', 'Y']
    return False

def parse_int(value):
    """Safely parse integer"""
    try:
        return int(value) if value and value.strip() else 0
    except (ValueError, AttributeError):
        return 0

def parse_float(value):
    """Safely parse float"""
    try:
        return float(value) if value and value.strip() else None
    except (ValueError, AttributeError):
        return None

def import_from_csv(csv_path):
    """Import influencers from CSV file"""
    print("\n" + "=" * 60)
    print("INFLUENCER DATA IMPORT")
    print("=" * 60)

    if not os.path.exists(csv_path):
        print(f"\n[ERROR] CSV file not found: {csv_path}")
        return False

    with app.app_context():
        try:
            with open(csv_path, 'r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                count = 0
                errors = []

                for row_num, row in enumerate(reader, start=2):
                    try:
                        # Auto-calculate tier based on max followers
                        max_followers = max(
                            parse_int(row.get('instagram_followers')),
                            parse_int(row.get('youtube_subscribers')),
                            parse_int(row.get('tiktok_followers')),
                            parse_int(row.get('twitter_followers'))
                        )

                        if max_followers >= 1000000:
                            tier = 'Mega'
                        elif max_followers >= 100000:
                            tier = 'Macro'
                        elif max_followers >= 10000:
                            tier = 'Micro'
                        else:
                            tier = 'Nano'

                        # Create influencer instance
                        influencer = Influencer(
                            name=row['name'],
                            email=row.get('email') or None,
                            phone=row.get('phone') or None,
                            profile_pic=None,
                            bio=None,
                            categories=parse_categories(row.get('categories')),
                            city=row.get('city') or None,
                            state=row.get('state') or None,
                            country=row.get('country') or 'India',

                            instagram_handle=row.get('instagram_handle') or None,
                            instagram_followers=parse_int(row.get('instagram_followers')),
                            instagram_url=row.get('instagram_url') or None,

                            youtube_handle=row.get('youtube_handle') or None,
                            youtube_subscribers=parse_int(row.get('youtube_subscribers')),
                            youtube_url=row.get('youtube_url') or None,

                            tiktok_handle=row.get('tiktok_handle') or None,
                            tiktok_followers=parse_int(row.get('tiktok_followers')),
                            tiktok_url=row.get('tiktok_url') or None,

                            twitter_handle=row.get('twitter_handle') or None,
                            twitter_followers=parse_int(row.get('twitter_followers')),
                            twitter_url=row.get('twitter_url') or None,

                            tier=tier,

                            rate_per_post_instagram=parse_float(row.get('rate_per_post_instagram')),
                            rate_per_reel_instagram=parse_float(row.get('rate_per_reel_instagram')),
                            rate_per_story_instagram=parse_float(row.get('rate_per_story_instagram')),
                            rate_per_video_youtube=parse_float(row.get('rate_per_video_youtube')),
                            rate_per_short_youtube=parse_float(row.get('rate_per_short_youtube')),
                            currency=row.get('currency') or 'INR',

                            past_brands=parse_brands(row.get('past_brands')),

                            worked_with_wrm=parse_bool(row.get('worked_with_wrm')),
                            wrm_notes=row.get('wrm_notes') or None,

                            status=row.get('status') or 'active',
                            created_at=datetime.utcnow()
                        )

                        db.session.add(influencer)
                        count += 1

                    except Exception as e:
                        errors.append(f"Row {row_num}: {str(e)}")

                # Commit all influencers
                db.session.commit()

                print(f"\n[OK] Successfully imported {count} influencers")

                if errors:
                    print(f"\n[WARNING] {len(errors)} errors occurred:")
                    for error in errors[:10]:  # Show first 10 errors
                        print(f"  - {error}")
                    if len(errors) > 10:
                        print(f"  ... and {len(errors) - 10} more errors")

                print("\n" + "=" * 60)
                return True

        except Exception as e:
            print(f"\n[ERROR] Failed to import: {str(e)}")
            db.session.rollback()
            return False

if __name__ == '__main__':
    import sys

    if len(sys.argv) < 2:
        print("\nUsage: python import_influencers.py <csv_file_path>")
        print("\nExample:")
        print("  python import_influencers.py influencers_template.csv")
        print("  python import_influencers.py my_influencers.csv")
        sys.exit(1)

    csv_path = sys.argv[1]
    success = import_from_csv(csv_path)
    sys.exit(0 if success else 1)
