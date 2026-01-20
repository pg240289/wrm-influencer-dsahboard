"""
Database Schema Upgrade Script
Migrates from old schema (Influencer tied to Campaign) to new schema (Influencer Master + Join Table)
"""

import os
import sys
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Get database path
db_path = os.path.join(os.path.dirname(__file__), 'influencer_dashboard.db')
db_uri = f'sqlite:///{db_path}'

def backup_database():
    """Create a backup of the current database"""
    import shutil
    backup_path = db_path.replace('.db', f'_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.db')
    if os.path.exists(db_path):
        shutil.copy2(db_path, backup_path)
        print(f"[OK] Database backup created: {backup_path}")
        return backup_path
    return None

def upgrade_schema():
    """Upgrade the database schema"""
    print("=" * 60)
    print("DATABASE SCHEMA UPGRADE")
    print("=" * 60)

    # Step 1: Backup
    print("\n[1/6] Creating database backup...")
    backup_path = backup_database()

    # Step 2: Connect to database
    print("\n[2/6] Connecting to database...")
    engine = create_engine(db_uri)
    connection = engine.connect()

    try:
        # Step 3: Check if old schema exists
        print("\n[3/6] Checking current schema...")
        result = connection.execute(text("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='influencer'
        """))
        has_old_influencer = result.fetchone() is not None

        if has_old_influencer:
            print("   [WARNING]  Old influencer schema detected")

            # Check if there's any data
            result = connection.execute(text("SELECT COUNT(*) as count FROM influencer"))
            count = result.fetchone()[0]
            print(f"   [INFO] Found {count} influencer records")

            if count > 0:
                print("\n   [WARNING]  WARNING: You have existing influencer data!")
                print("   This data is tied to specific campaigns and cannot be automatically migrated")
                print("   to the new many-to-many schema without data loss.")
                print("\n   Recommended action:")
                print("   1. Export your influencer data")
                print("   2. Allow this script to create the new schema")
                print("   3. Re-import influencers into the new master table")
                print("   4. Manually reassign them to campaigns")

                response = input("\n   Do you want to proceed? This will DROP the old influencer table (yes/no): ")
                if response.lower() != 'yes':
                    print("\n   [ERROR] Upgrade cancelled by user")
                    connection.close()
                    return False

        # Step 4: Drop old tables (if they exist)
        print("\n[4/6] Dropping old schema tables...")
        connection.execute(text("DROP TABLE IF EXISTS content"))
        connection.execute(text("DROP TABLE IF EXISTS influencer"))
        connection.commit()
        print("   [OK] Old tables dropped")

        # Step 5: Create new schema
        print("\n[5/6] Creating new schema...")

        # Create new Influencer master table
        connection.execute(text("""
            CREATE TABLE influencer (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(120),
                phone VARCHAR(20),
                profile_pic VARCHAR(500),
                bio TEXT,
                categories JSON,
                city VARCHAR(100),
                state VARCHAR(100),
                country VARCHAR(100) DEFAULT 'India',

                instagram_handle VARCHAR(100),
                instagram_followers INTEGER DEFAULT 0,
                instagram_url VARCHAR(500),

                youtube_handle VARCHAR(100),
                youtube_subscribers INTEGER DEFAULT 0,
                youtube_url VARCHAR(500),

                tiktok_handle VARCHAR(100),
                tiktok_followers INTEGER DEFAULT 0,
                tiktok_url VARCHAR(500),

                twitter_handle VARCHAR(100),
                twitter_followers INTEGER DEFAULT 0,
                twitter_url VARCHAR(500),

                tier VARCHAR(50),

                rate_per_post_instagram FLOAT,
                rate_per_reel_instagram FLOAT,
                rate_per_story_instagram FLOAT,
                rate_per_video_youtube FLOAT,
                rate_per_short_youtube FLOAT,
                currency VARCHAR(10) DEFAULT 'INR',

                past_brands JSON,

                worked_with_wrm BOOLEAN DEFAULT 0,
                wrm_first_collab_date DATETIME,
                wrm_last_collab_date DATETIME,
                wrm_total_campaigns INTEGER DEFAULT 0,
                wrm_notes TEXT,

                status VARCHAR(50) DEFAULT 'active',
                performance_rating FLOAT,

                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_by_user_id INTEGER,

                FOREIGN KEY (created_by_user_id) REFERENCES user(id)
            )
        """))
        print("   [OK] Influencer master table created")

        # Create CampaignInfluencer join table
        connection.execute(text("""
            CREATE TABLE campaign_influencer (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER NOT NULL,
                influencer_id INTEGER NOT NULL,

                platform VARCHAR(50) NOT NULL,
                deliverables_count INTEGER DEFAULT 0,
                content_type VARCHAR(100),

                agreed_amount FLOAT,
                compensation_type VARCHAR(50),
                compensation_notes TEXT,

                contract_start_date DATETIME,
                contract_end_date DATETIME,

                status VARCHAR(50) DEFAULT 'pending',

                content_submitted INTEGER DEFAULT 0,
                content_approved INTEGER DEFAULT 0,
                content_published INTEGER DEFAULT 0,

                notes TEXT,

                assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                assigned_by_user_id INTEGER,

                FOREIGN KEY (campaign_id) REFERENCES campaign(id) ON DELETE CASCADE,
                FOREIGN KEY (influencer_id) REFERENCES influencer(id) ON DELETE CASCADE,
                FOREIGN KEY (assigned_by_user_id) REFERENCES user(id)
            )
        """))
        print("   [OK] CampaignInfluencer join table created")

        # Create new Content table
        connection.execute(text("""
            CREATE TABLE content (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER NOT NULL,
                influencer_id INTEGER NOT NULL,
                campaign_influencer_id INTEGER NOT NULL,

                platform VARCHAR(50) NOT NULL,
                content_type VARCHAR(50) NOT NULL,
                url VARCHAR(500),
                thumbnail VARCHAR(500),
                caption TEXT,

                views INTEGER DEFAULT 0,
                likes INTEGER DEFAULT 0,
                comments INTEGER DEFAULT 0,
                shares INTEGER DEFAULT 0,
                saves INTEGER DEFAULT 0,
                engagement_rate FLOAT DEFAULT 0.0,

                status VARCHAR(50) DEFAULT 'draft',

                published_at DATETIME,
                submitted_at DATETIME,
                approved_at DATETIME,
                last_metrics_update DATETIME,

                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY (campaign_id) REFERENCES campaign(id) ON DELETE CASCADE,
                FOREIGN KEY (influencer_id) REFERENCES influencer(id) ON DELETE CASCADE,
                FOREIGN KEY (campaign_influencer_id) REFERENCES campaign_influencer(id) ON DELETE CASCADE
            )
        """))
        print("   [OK] Content table created")

        connection.commit()

        # Step 6: Verify
        print("\n[6/6] Verifying new schema...")
        result = connection.execute(text("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name IN ('influencer', 'campaign_influencer', 'content')
            ORDER BY name
        """))
        tables = [row[0] for row in result.fetchall()]
        print(f"   [OK] Tables created: {', '.join(tables)}")

        print("\n" + "=" * 60)
        print("[OK] SCHEMA UPGRADE COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        print(f"\n[FILE] Backup location: {backup_path}")
        print("\nNext steps:")
        print("1. Prepare your influencer data CSV")
        print("2. Run the import script to load influencers")
        print("3. Restart the Flask application")
        print("=" * 60)

        return True

    except Exception as e:
        print(f"\n[ERROR] Error during upgrade: {str(e)}")
        print(f"[FILE] Database backup is available at: {backup_path}")
        print("   You can restore it if needed")
        connection.rollback()
        return False
    finally:
        connection.close()

if __name__ == '__main__':
    print("\n[WARNING] This script will upgrade your database schema")
    print("[WARNING] A backup will be created automatically\n")

    response = input("Do you want to continue? (yes/no): ")
    if response.lower() == 'yes':
        success = upgrade_schema()
        sys.exit(0 if success else 1)
    else:
        print("\n[CANCELLED] Upgrade cancelled")
        sys.exit(1)

