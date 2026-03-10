"""
Run this script to add all new columns to the database.
Usage: python add_all_new_columns.py
"""
from sqlalchemy import text
from app import app, db

columns_to_add = [
    # Facebook columns
    ('influencer', 'facebook_handle', 'VARCHAR(100)'),
    ('influencer', 'facebook_followers', 'INT DEFAULT 0'),
    ('influencer', 'facebook_url', 'VARCHAR(500)'),
    ('influencer', 'rate_per_post_facebook', 'FLOAT'),
    ('influencer', 'rate_per_reel_facebook', 'FLOAT'),
    ('influencer', 'rate_per_story_facebook', 'FLOAT'),

    # LinkedIn columns
    ('influencer', 'linkedin_handle', 'VARCHAR(100)'),
    ('influencer', 'linkedin_followers', 'INT DEFAULT 0'),
    ('influencer', 'linkedin_url', 'VARCHAR(500)'),
    ('influencer', 'rate_per_post_linkedin', 'FLOAT'),

    # Campaign influencer link column
    ('campaign_influencer', 'link', 'VARCHAR(500)'),
]

with app.app_context():
    try:
        with db.engine.connect() as conn:
            for table, column, col_type in columns_to_add:
                try:
                    sql = f'ALTER TABLE {table} ADD COLUMN {column} {col_type}'
                    conn.execute(text(sql))
                    print(f"Added {column} to {table}")
                except Exception as e:
                    if 'Duplicate column name' in str(e) or 'duplicate column' in str(e).lower():
                        print(f"{column} already exists in {table}")
                    else:
                        print(f"Error adding {column} to {table}: {e}")

            conn.commit()
            print("\nDone! All columns checked/added.")
    except Exception as e:
        print(f"Error: {e}")
