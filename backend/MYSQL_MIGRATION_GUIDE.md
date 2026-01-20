# MySQL Migration Guide

This guide will help you migrate your Influencer Dashboard from SQLite to MySQL.

## Prerequisites

1. **MySQL Server** - Install and running locally or on a server
2. **Python dependencies** - Will be updated with PyMySQL

## Step-by-Step Migration

### 1. Install MySQL Server

**Windows:**
- Download from [MySQL Community Server](https://dev.mysql.com/downloads/mysql/)
- Run installer and follow setup wizard
- Remember your root password

**macOS (using Homebrew):**
```bash
brew install mysql
brew services start mysql
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install mysql-server
sudo mysql_secure_installation
```

### 2. Create MySQL Database

Connect to MySQL and create the database:

```bash
mysql -u root -p
```

Enter your MySQL root password, then run:

```sql
CREATE DATABASE influencer_dashboard;
EXIT;
```

### 3. Update Backend Dependencies

Install the new dependencies with PyMySQL driver:

```bash
cd backend
pip install -r requirements.txt
```

This will install PyMySQL, which is required for MySQL connectivity.

### 4. Configure .env File

Update your `.env` file with MySQL credentials:

```env
# Flask Configuration
SECRET_KEY=your-secret-key-change-in-production
FLASK_ENV=development

# MySQL Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=influencer_dashboard

# Email Configuration (keep existing settings)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=organisedkos@gmail.com
MAIL_PASSWORD=nzwh okdy dbvd bndn
MAIL_DEFAULT_SENDER=organisedkos@gmail.com
```

**Replace:**
- `DB_PASSWORD` - Your MySQL root password
- Other variables as needed

### 5. Initialize MySQL Database Schema

Start Python shell from backend directory:

```bash
python
```

Then run:

```python
from app import app, db

with app.app_context():
    db.create_all()
    print("✅ Database tables created!")
```

Exit with `exit()`.

### 6. Migrate Data from SQLite (Optional)

If you have existing data in SQLite that you want to transfer:

```bash
python migrate_to_mysql.py
```

This script will:
- Connect to your SQLite database (instance/campaigns.db)
- Connect to your MySQL database
- Transfer all data from SQLite to MySQL
- Display migration progress

**Expected output:**
```
============================================================
🚀 SQLite to MySQL Migration Script
============================================================

📌 Connecting to SQLite...
✅ SQLite connection successful
📌 Connecting to MySQL...
✅ MySQL connection successful

📌 Scanning SQLite tables...
✅ Found X tables: ...

📌 Starting data migration...
   Migrating table: user... ✅ (X records)
   Migrating table: role... ✅ (X records)
   ...
============================================================
✅ Migration completed successfully!
```

### 7. Start Your Application

Now start the Flask application:

```bash
python app.py
```

You should see:
```
 * Running on http://127.0.0.1:5000
```

### 8. Verify Database

Test the application by:
1. Opening http://localhost:3000 in your browser
2. Logging in with credentials:
   - Username: `admin`
   - Password: `admin123`
3. Creating a new campaign or influencer
4. Checking if data is saved correctly

### Troubleshooting

**Error: "Can't connect to MySQL server"**
- Ensure MySQL server is running
- Check DB_HOST and DB_PORT in .env
- Verify credentials are correct

**Error: "Access denied for user"**
- Check DB_USER and DB_PASSWORD in .env
- Ensure user has permission to access the database

**Error: "Unknown database 'influencer_dashboard'"**
- Run the MySQL database creation command again
- Verify DB_NAME in .env matches the created database

**Error: "No such file or directory: instance/campaigns.db"**
- This is normal if you don't have existing SQLite data
- Skip the migration step, data will be fresh in MySQL

## Database Connection Details

Your application now uses:
- **Database Type:** MySQL
- **Connection String:** `mysql+pymysql://user:password@host:port/database`
- **Configuration:** Loaded from `.env` file

## Backing Up Your Data

### MySQL Backup

```bash
mysqldump -u root -p influencer_dashboard > backup.sql
```

### MySQL Restore

```bash
mysql -u root -p influencer_dashboard < backup.sql
```

### SQLite Backup (Keep old data)

```bash
# On Windows
copy instance/campaigns.db instance/campaigns_backup.db

# On macOS/Linux
cp instance/campaigns.db instance/campaigns_backup.db
```

## Important Notes

⚠️ **Security:**
- Change `SECRET_KEY` in .env for production
- Use strong MySQL passwords
- Never commit credentials to version control
- Add `.env` to `.gitignore` if not already present

✅ **Best Practices:**
- Test thoroughly before deploying to production
- Keep backups of your data
- Monitor MySQL server performance
- Review MySQL logs for issues: `/var/log/mysql/error.log`

## Next Steps

1. ✅ Update your deployment scripts to use MySQL
2. ✅ Configure MySQL remote access if needed
3. ✅ Set up automated backups
4. ✅ Monitor database performance
5. ✅ Consider database indexing for better performance

For more help, check:
- [MySQL Documentation](https://dev.mysql.com/doc/)
- [SQLAlchemy MySQL Guide](https://docs.sqlalchemy.org/en/20/dialects/mysql.html)
- [PyMySQL Documentation](https://pymysql.readthedocs.io/)
