"""
Run this script once to add LinkedIn columns to the influencer table.
Usage: python add_linkedin_columns.py
"""
from sqlalchemy import text
from app import app, db

with app.app_context():
    try:
        with db.engine.connect() as conn:
            # Add LinkedIn columns
            try:
                conn.execute(text('ALTER TABLE influencer ADD COLUMN linkedin_handle VARCHAR(100)'))
                print("Added linkedin_handle column")
            except Exception as e:
                if 'Duplicate column name' in str(e):
                    print("linkedin_handle column already exists")

            try:
                conn.execute(text('ALTER TABLE influencer ADD COLUMN linkedin_followers INT DEFAULT 0'))
                print("Added linkedin_followers column")
            except Exception as e:
                if 'Duplicate column name' in str(e):
                    print("linkedin_followers column already exists")

            try:
                conn.execute(text('ALTER TABLE influencer ADD COLUMN linkedin_url VARCHAR(500)'))
                print("Added linkedin_url column")
            except Exception as e:
                if 'Duplicate column name' in str(e):
                    print("linkedin_url column already exists")

            try:
                conn.execute(text('ALTER TABLE influencer ADD COLUMN rate_per_post_linkedin FLOAT'))
                print("Added rate_per_post_linkedin column")
            except Exception as e:
                if 'Duplicate column name' in str(e):
                    print("rate_per_post_linkedin column already exists")

            conn.commit()
            print("\nSuccessfully added LinkedIn columns!")

    except Exception as e:
        print(f"Error: {e}")
