"""
Run this script once to add Facebook columns to the influencer table.
Usage: python add_facebook_columns.py
"""
from sqlalchemy import text
from app import app, db

with app.app_context():
    try:
        with db.engine.connect() as conn:
            # Add Facebook columns
            try:
                conn.execute(text('ALTER TABLE influencer ADD COLUMN facebook_handle VARCHAR(100)'))
                print("Added facebook_handle column")
            except Exception as e:
                if 'Duplicate column name' in str(e):
                    print("facebook_handle column already exists")

            try:
                conn.execute(text('ALTER TABLE influencer ADD COLUMN facebook_followers INT DEFAULT 0'))
                print("Added facebook_followers column")
            except Exception as e:
                if 'Duplicate column name' in str(e):
                    print("facebook_followers column already exists")

            try:
                conn.execute(text('ALTER TABLE influencer ADD COLUMN facebook_url VARCHAR(500)'))
                print("Added facebook_url column")
            except Exception as e:
                if 'Duplicate column name' in str(e):
                    print("facebook_url column already exists")

            conn.commit()
            print("\nSuccessfully added Facebook columns!")

    except Exception as e:
        print(f"Error: {e}")
