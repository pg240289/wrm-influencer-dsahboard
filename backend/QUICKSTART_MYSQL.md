# Quick Start: MySQL Migration

## ⚡ 5-Minute Setup

### Step 1: Install MySQL
**Windows:** Download from https://dev.mysql.com/downloads/mysql/

**macOS:** 
```bash
brew install mysql && brew services start mysql
```

**Linux:**
```bash
sudo apt-get install mysql-server
```

### Step 2: Create Database
```bash
mysql -u root -p
```
Then enter:
```sql
CREATE DATABASE wrm_influencer_dashboard;
EXIT;
```

### Step 3: Update .env File
Edit `backend/.env` and update:
```env
DB_PASSWORD=your_mysql_password
DB_NAME=wrm_influencer_dashboard
```

### Step 4: Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### Step 5: Initialize Database
```bash
cd backend
python
```

Then in Python:
```python
from app import app, db
with app.app_context():
    db.create_all()
print("✅ Done!")
exit()
```

### Step 6: Test & Run
```bash
python app.py
```

Visit: http://localhost:3000

**Credentials:**
- Username: `admin`
- Password: `admin123`

---

## 📋 Migrating Existing Data

If you have data in SQLite, run:
```bash
python migrate_to_mysql.py
```

---

## ⚙️ Configuration Reference

**File:** `backend/.env`

| Variable | Default | Required |
|----------|---------|----------|
| `DB_HOST` | localhost | ✅ |
| `DB_PORT` | 3306 | ✅ |
| `DB_USER` | root | ✅ |
| `DB_PASSWORD` | (empty) | ✅ Update this! |
| `DB_NAME` | wrm_influencer_dashboard | ✅ |

---

## 🐛 Common Issues

**"Access denied"**
- Check `DB_PASSWORD` matches your MySQL password
- Verify `DB_USER` exists in MySQL

**"Can't connect to MySQL server"**
- Ensure MySQL is running
- Check `DB_HOST` and `DB_PORT`

**"Unknown database"**
- Run: `mysql -u root -p -e "CREATE DATABASE wrm_influencer_dashboard;"`

---

## 📚 Full Documentation

- [MYSQL_MIGRATION_GUIDE.md](./MYSQL_MIGRATION_GUIDE.md) - Detailed guide
- [MYSQL_MIGRATION_SUMMARY.md](./MYSQL_MIGRATION_SUMMARY.md) - Technical summary
- [migrate_to_mysql.py](./migrate_to_mysql.py) - Data migration script

---

**Last Updated:** January 2026
