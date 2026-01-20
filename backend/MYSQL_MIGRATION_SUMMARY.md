# MySQL Database Migration - Summary of Changes

This document summarizes all changes made to migrate from SQLite to MySQL.

## Files Modified

### 1. **requirements.txt**
- ✅ Added `PyMySQL==1.1.0` - MySQL driver for Python
- All other dependencies remain unchanged

### 2. **.env** (Backend Configuration)
- ✅ Added MySQL connection parameters:
  - `DB_HOST=localhost` - MySQL server host
  - `DB_PORT=3306` - MySQL server port
  - `DB_USER=root` - MySQL username
  - `DB_PASSWORD=your_mysql_password` - MySQL password (UPDATE THIS!)
  - `DB_NAME=influencer_dashboard` - Database name
- ✅ Added `FLASK_ENV=development` for development environment

### 3. **app.py** (Main Flask Application)
- ✅ Changed database configuration from SQLite to MySQL
- ✅ Updated `SQLALCHEMY_DATABASE_URI` to use:
  - Connection string format: `mysql+pymysql://user:password@host:port/database`
  - Credentials loaded from `.env` file
  - Fallback defaults provided for all parameters
- ✅ No changes to models, routes, or business logic

## New Files Created

### 1. **migrate_to_mysql.py**
- Automated migration script to transfer data from SQLite to MySQL
- Features:
  - Safe connection testing
  - Table discovery from SQLite
  - Batch data transfer (1000 records at a time)
  - Foreign key management during migration
  - Detailed progress reporting
  - Error handling and recovery

### 2. **MYSQL_MIGRATION_GUIDE.md**
- Comprehensive step-by-step migration guide
- Installation instructions for all platforms (Windows, macOS, Linux)
- Troubleshooting section
- Backup and restore procedures
- Security best practices

### 3. **setup_mysql.bat** (Windows)
- Automated setup script for Windows users
- Validates MySQL installation
- Tests database connection
- Creates database automatically
- Installs Python dependencies

### 4. **setup_mysql.sh** (macOS/Linux)
- Automated setup script for Unix-like systems
- Same functionality as Windows version
- Requires execute permissions: `chmod +x setup_mysql.sh`

## Database Connection String

**Old (SQLite):**
```
sqlite:///campaigns.db
```

**New (MySQL):**
```
mysql+pymysql://root:password@localhost:3306/influencer_dashboard
```

## Configuration Flow

```
.env file (credentials)
    ↓
app.py (reads from environment)
    ↓
SQLAlchemy (creates connection string)
    ↓
PyMySQL (connects to MySQL)
```

## Key Features

### Environment-Based Configuration
- All sensitive data stored in `.env` (not in code)
- Supports different configurations per environment
- `.env` file is gitignored for security

### Backward Compatible
- All existing code works without changes
- Same database models and relationships
- Migration script preserves all data types and relationships

### Flexible Database Connection
- Support for localhost, remote servers, and cloud databases
- Configurable port
- Username/password authentication

## Security Considerations

⚠️ **Important:**
- Never commit `.env` file to version control
- Change `SECRET_KEY` for production
- Use strong MySQL passwords
- Restrict MySQL user privileges in production
- Enable SSL for remote connections

## Migration Checklist

- [ ] Install MySQL Server
- [ ] Create `influencer_dashboard` database
- [ ] Update `.env` with MySQL credentials
- [ ] Run `pip install -r requirements.txt`
- [ ] Initialize database: `python -c "from app import app, db; app.app_context().push(); db.create_all()"`
- [ ] (Optional) Migrate data: `python migrate_to_mysql.py`
- [ ] Test application locally
- [ ] Backup SQLite data before deleting
- [ ] Deploy to production

## Performance Improvements

MySQL over SQLite:
- ✅ Better concurrent connection handling
- ✅ Superior performance for large datasets
- ✅ Native support for transactions
- ✅ Better support for complex queries
- ✅ Production-ready reliability

## Rollback Plan

If you need to revert to SQLite:
1. Restore from backup: `cp instance/campaigns_backup.db instance/campaigns.db`
2. Revert app.py to previous version with SQLite URI
3. Remove PyMySQL from requirements.txt
4. Reinstall dependencies: `pip install -r requirements.txt`

## Support & Documentation

- [MySQL Documentation](https://dev.mysql.com/doc/)
- [SQLAlchemy MySQL Guide](https://docs.sqlalchemy.org/en/20/dialects/mysql.html)
- [PyMySQL Documentation](https://pymysql.readthedocs.io/)
- [Flask-SQLAlchemy](https://flask-sqlalchemy.palletsprojects.com/)

## Environment Variables Reference

```env
# Required
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=influencer_dashboard

# Optional (with defaults)
SECRET_KEY=your-secret-key
FLASK_ENV=development
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
```

## Troubleshooting Commands

### Check MySQL Server Status
```bash
# Windows
mysql -u root -p -e "STATUS;"

# macOS/Linux
sudo systemctl status mysql
```

### View Current Database
```bash
mysql -u root -p -e "SELECT DATABASE();"
```

### List All Databases
```bash
mysql -u root -p -e "SHOW DATABASES;"
```

### Test PyMySQL Installation
```bash
python -c "import pymysql; print('PyMySQL installed successfully')"
```

---

**Created:** January 2026  
**Compatibility:** Flask 3.0+, SQLAlchemy 3.1+, Python 3.8+
