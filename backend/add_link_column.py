"""
Run this script once to add the 'link' column to the campaign_influencer table.
Usage: python add_link_column.py
"""
from sqlalchemy import text
from app import app, db

with app.app_context():
    try:
        with db.engine.connect() as conn:
            conn.execute(text('ALTER TABLE campaign_influencer ADD COLUMN link VARCHAR(500)'))
            conn.commit()
        print("Successfully added 'link' column to campaign_influencer table!")
    except Exception as e:
        if 'Duplicate column name' in str(e) or 'duplicate column' in str(e).lower():
            print("Column 'link' already exists.")
        else:
            print(f"Error: {e}")
