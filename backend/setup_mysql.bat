@echo off
REM MySQL Setup Script for Windows
REM This script helps set up MySQL database for the Influencer Dashboard

echo.
echo ============================================================
echo   Influencer Dashboard - MySQL Setup Script
echo ============================================================
echo.

REM Check if MySQL command exists
where mysql >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo ERROR: MySQL is not installed or not in PATH
    echo.
    echo Please install MySQL Community Server from:
    echo https://dev.mysql.com/downloads/mysql/
    echo.
    pause
    exit /b 1
)

echo [1/3] Testing MySQL connection...
echo Enter your MySQL root password when prompted:
mysql -u root -p -e "SELECT 1;" >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Could not connect to MySQL
    echo Please ensure MySQL server is running and password is correct
    echo.
    pause
    exit /b 1
)
echo [OK] MySQL connection successful

echo.
echo [2/3] Creating database...
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS influencer_dashboard; SHOW DATABASES LIKE 'influencer_dashboard';"
if %errorlevel% neq 0 (
    echo ERROR: Failed to create database
    pause
    exit /b 1
)
echo [OK] Database created successfully

echo.
echo [3/3] Installing Python dependencies...
pip install -r requirements.txt >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Failed to install Python dependencies
    pause
    exit /b 1
)
echo [OK] Dependencies installed successfully

echo.
echo ============================================================
echo   Setup Complete!
echo ============================================================
echo.
echo Next steps:
echo 1. Update .env file with your MySQL password:
echo    DB_PASSWORD=your_mysql_password
echo.
echo 2. Initialize the database schema:
echo    python
echo    from app import app, db
echo    with app.app_context():
echo        db.create_all()
echo.
echo 3. (Optional) Migrate data from SQLite:
echo    python migrate_to_mysql.py
echo.
echo 4. Start the application:
echo    python app.py
echo.
pause
