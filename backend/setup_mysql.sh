#!/bin/bash
# MySQL Setup Script for macOS/Linux
# This script helps set up MySQL database for the Influencer Dashboard

echo ""
echo "============================================================"
echo "  Influencer Dashboard - MySQL Setup Script"
echo "============================================================"
echo ""

# Check if MySQL is installed
if ! command -v mysql &> /dev/null; then
    echo "ERROR: MySQL is not installed"
    echo ""
    echo "Please install MySQL:"
    echo "  macOS:   brew install mysql"
    echo "  Ubuntu:  sudo apt-get install mysql-server"
    echo ""
    exit 1
fi

echo "[1/3] Testing MySQL connection..."
read -sp "Enter MySQL root password: " mysql_password
echo ""

if ! mysql -u root -p"$mysql_password" -e "SELECT 1;" &> /dev/null; then
    echo "ERROR: Could not connect to MySQL"
    echo "Please ensure MySQL server is running and password is correct"
    echo ""
    exit 1
fi
echo "[OK] MySQL connection successful"

echo ""
echo "[2/3] Creating database..."
mysql -u root -p"$mysql_password" -e "CREATE DATABASE IF NOT EXISTS influencer_dashboard; SHOW DATABASES LIKE 'influencer_dashboard';"
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to create database"
    exit 1
fi
echo "[OK] Database created successfully"

echo ""
echo "[3/3] Installing Python dependencies..."
pip install -r requirements.txt > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install Python dependencies"
    exit 1
fi
echo "[OK] Dependencies installed successfully"

echo ""
echo "============================================================"
echo "  Setup Complete!"
echo "============================================================"
echo ""
echo "Next steps:"
echo "1. Update .env file with your MySQL password:"
echo "   DB_PASSWORD=$mysql_password"
echo ""
echo "2. Initialize the database schema:"
echo "   python3"
echo "   from app import app, db"
echo "   with app.app_context():"
echo "       db.create_all()"
echo ""
echo "3. (Optional) Migrate data from SQLite:"
echo "   python3 migrate_to_mysql.py"
echo ""
echo "4. Start the application:"
echo "   python3 app.py"
echo ""
