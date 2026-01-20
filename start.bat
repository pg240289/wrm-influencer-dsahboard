@echo off
echo ============================================
echo   Influencer Dashboard Startup Script
echo ============================================
echo.

REM Kill any existing processes on ports 5000 and 3000
echo Checking for existing processes...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5000" ^| find "LISTENING"') do (
    echo Killing process on port 5000 (PID: %%a)
    taskkill /F /PID %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    echo Killing process on port 3000 (PID: %%a)
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo Starting Backend (Flask) on http://localhost:5000...
echo ============================================
cd backend
start "Flask Backend" cmd /k "python app.py"
cd ..

echo.
echo Waiting 3 seconds for backend to start...
timeout /t 3 /nobreak >nul

echo.
echo Starting Frontend (React) on http://localhost:3000...
echo ============================================
cd frontend
start "React Frontend" cmd /k "npm start"
cd ..

echo.
echo ============================================
echo   Both servers are starting!
echo ============================================
echo.
echo   Backend:  http://localhost:5000
echo   Frontend: http://localhost:3000
echo.
echo   Default Credentials:
echo   - Admin:   admin / admin123
echo   - Manager: manager / manager123
echo.
echo   Two new terminal windows have opened.
echo   Close them to stop the servers.
echo ============================================
echo.
pause
