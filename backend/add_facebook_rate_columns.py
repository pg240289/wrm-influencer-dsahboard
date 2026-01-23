"""
Run this script once to add Facebook rate columns to the influencer table.
Usage: python add_facebook_rate_columns.py
"""
from sqlalchemy import text
from app import app, db

with app.app_context():
    try:
        with db.engine.connect() as conn:
            # Add Facebook rate columns
            try:
                conn.execute(text('ALTER TABLE influencer ADD COLUMN rate_per_post_facebook FLOAT'))
                print("Added rate_per_post_facebook column")
            except Exception as e:
                if 'Duplicate column name' in str(e):
                    print("rate_per_post_facebook column already exists")

            try:
                conn.execute(text('ALTER TABLE influencer ADD COLUMN rate_per_reel_facebook FLOAT'))
                print("Added rate_per_reel_facebook column")
            except Exception as e:
                if 'Duplicate column name' in str(e):
                    print("rate_per_reel_facebook column already exists")

            try:
                conn.execute(text('ALTER TABLE influencer ADD COLUMN rate_per_story_facebook FLOAT'))
                print("Added rate_per_story_facebook column")
            except Exception as e:
                if 'Duplicate column name' in str(e):
                    print("rate_per_story_facebook column already exists")

            conn.commit()
            print("\nSuccessfully added Facebook rate columns!")

    except Exception as e:
        print(f"Error: {e}")
