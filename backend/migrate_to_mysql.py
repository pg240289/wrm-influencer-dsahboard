"""
Migration script to transfer data from SQLite to MySQL
Run this script after setting up MySQL and configuring .env file
"""

import sqlite3
import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def create_mysql_connection():
    """Create MySQL connection"""
    import pymysql
    
    try:
        connection = pymysql.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=int(os.getenv('DB_PORT', 3306)),
            user=os.getenv('DB_USER', 'root'),
            password=os.getenv('DB_PASSWORD', ''),
            database=os.getenv('DB_NAME', 'wrm_influencer_dashboard'),
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor
        )
        return connection
    except Exception as e:
        print(f"❌ Failed to connect to MySQL: {e}")
        print("\nPlease ensure:")
        print("1. MySQL server is running")
        print("2. Database exists: CREATE DATABASE wrm_influencer_dashboard;")
        print("3. .env file has correct DB credentials")
        sys.exit(1)

def initialize_mysql_schema(mysql_conn):
    """Initialize MySQL database schema from Flask models"""
    try:
        # Import Flask app and db
        from app import app, db
        
        print("📌 Creating database schema...")
        with app.app_context():
            db.create_all()
        print("✅ Database schema created successfully")
        return True
    except Exception as e:
        print(f"❌ Failed to create database schema: {e}")
        print("\nTrying alternative method...")
        return False

def create_sqlite_connection():
    """Create SQLite connection"""
    try:
        if not os.path.exists('instance/campaigns.db'):
            print("❌ SQLite database not found at instance/campaigns.db")
            print("Please ensure your Flask app has been initialized with SQLite first.")
            sys.exit(1)
        
        connection = sqlite3.connect('instance/campaigns.db')
        connection.row_factory = sqlite3.Row
        return connection
    except Exception as e:
        print(f"❌ Failed to connect to SQLite: {e}")
        sys.exit(1)

def get_sqlite_tables(sqlite_conn):
    """Get all table names from SQLite"""
    cursor = sqlite_conn.cursor()
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
    """)
    tables = [row[0] for row in cursor.fetchall()]
    cursor.close()
    return tables

def get_sqlite_data(sqlite_conn, table_name):
    """Get all data from SQLite table"""
    cursor = sqlite_conn.cursor()
    cursor.execute(f"SELECT * FROM {table_name}")
    rows = [dict(row) for row in cursor.fetchall()]
    cursor.close()
    return rows

def get_table_schema(sqlite_conn, table_name):
    """Get column info from SQLite table"""
    cursor = sqlite_conn.cursor()
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = cursor.fetchall()
    cursor.close()
    return columns

def insert_data_to_mysql(mysql_conn, table_name, rows):
    """Insert data into MySQL table"""
    if not rows:
        return 0
    
    cursor = mysql_conn.cursor()
    
    try:
        # Build column names and placeholders
        columns = list(rows[0].keys())
        placeholders = ', '.join(['%s'] * len(columns))
        column_str = ', '.join([f'`{col}`' for col in columns])
        
        query = f"INSERT INTO `{table_name}` ({column_str}) VALUES ({placeholders})"
        
        # Insert in batches
        batch_size = 1000
        for i in range(0, len(rows), batch_size):
            batch = rows[i:i + batch_size]
            values = [tuple(row[col] for col in columns) for row in batch]
            cursor.executemany(query, values)
        
        mysql_conn.commit()
        return len(rows)
    except Exception as e:
        mysql_conn.rollback()
        print(f"❌ Error inserting data into {table_name}: {e}")
        raise
    finally:
        cursor.close()

def disable_foreign_keys(mysql_conn):
    """Disable foreign key checks for migration"""
    cursor = mysql_conn.cursor()
    cursor.execute("SET FOREIGN_KEY_CHECKS=0")
    cursor.close()

def enable_foreign_keys(mysql_conn):
    """Enable foreign key checks after migration"""
    cursor = mysql_conn.cursor()
    cursor.execute("SET FOREIGN_KEY_CHECKS=1")
    cursor.close()

def main():
    print("=" * 60)
    print("🚀 SQLite to MySQL Migration Script")
    print("=" * 60)
    
    # Step 1: Initialize MySQL schema
    print("\n📌 Step 1: Initializing MySQL Database Schema")
    print("-" * 60)
    mysql_conn = create_mysql_connection()
    print("✅ MySQL connection successful")
    
    schema_created = initialize_mysql_schema(mysql_conn)
    if not schema_created:
        print("⚠️  Schema initialization encountered an issue")
    
    # Connect to SQLite
    print("\n📌 Step 2: Connecting to SQLite")
    print("-" * 60)
    sqlite_conn = create_sqlite_connection()
    print("✅ SQLite connection successful")
    
    # Get tables from SQLite
    print("\n📌 Step 3: Scanning SQLite tables")
    print("-" * 60)
    tables = get_sqlite_tables(sqlite_conn)
    
    if not tables:
        print("⚠️  No tables found in SQLite database")
        print("Please ensure your Flask app has been initialized with data")
        sqlite_conn.close()
        mysql_conn.close()
        return
    
    print(f"✅ Found {len(tables)} tables: {', '.join(tables)}")
    
    # Disable foreign key checks
    print("\n📌 Step 4: Disabling foreign key checks in MySQL")
    print("-" * 60)
    disable_foreign_keys(mysql_conn)
    print("✅ Foreign key checks disabled")
    
    # Migrate data
    print("\n📌 Step 5: Starting data migration")
    print("-" * 60 + "\n")
    total_records = 0
    
    for table_name in tables:
        print(f"   Migrating table: {table_name}...", end=" ")
        
        try:
            rows = get_sqlite_data(sqlite_conn, table_name)
            record_count = insert_data_to_mysql(mysql_conn, table_name, rows)
            total_records += record_count
            print(f"✅ ({record_count} records)")
        except Exception as e:
            print(f"❌ Failed: {e}")
            sqlite_conn.close()
            mysql_conn.close()
            sys.exit(1)
    
    # Re-enable foreign key checks
    print("\n📌 Step 6: Re-enabling foreign key checks in MySQL")
    print("-" * 60)
    enable_foreign_keys(mysql_conn)
    print("✅ Foreign key checks enabled")
    
    # Close connections
    sqlite_conn.close()
    mysql_conn.close()
    
    print("\n" + "=" * 60)
    print(f"✅ Migration completed successfully!")
    print(f"   Total records migrated: {total_records}")
    print("=" * 60)
    print("\n📝 Next steps:")
    print("1. ✅ Database schema created in MySQL")
    print("2. ✅ Data migrated from SQLite")
    print("3. Verify all data in your application")
    print("4. Test all functionality")
    print("5. Update your deployment if needed")
    print("\n")

if __name__ == '__main__':
    main()
