# Influencer Dashboard Startup Script (PowerShell)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Influencer Dashboard Startup Script" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Kill any existing processes on ports 5000 and 3000
Write-Host "Checking for existing processes..." -ForegroundColor Yellow

# Kill process on port 5000 (Backend)
$backend = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
if ($backend) {
    Write-Host "Killing process on port 5000..." -ForegroundColor Yellow
    Stop-Process -Id $backend.OwningProcess -Force -ErrorAction SilentlyContinue
}

# Kill process on port 3000 (Frontend)
$frontend = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($frontend) {
    Write-Host "Killing process on port 3000..." -ForegroundColor Yellow
    Stop-Process -Id $frontend.OwningProcess -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Starting Backend (Flask) on http://localhost:5000..." -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan

# Start Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; Write-Host 'Starting Flask Backend...' -ForegroundColor Green; python app.py"

Write-Host ""
Write-Host "Waiting 3 seconds for backend to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "Starting Frontend (React) on http://localhost:3000..." -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan

# Start Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; Write-Host 'Starting React Frontend...' -ForegroundColor Green; npm start"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Both servers are starting!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Backend:  http://localhost:5000" -ForegroundColor White
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "  Default Credentials:" -ForegroundColor Yellow
Write-Host "  - Admin:   admin / admin123" -ForegroundColor White
Write-Host "  - Manager: manager / manager123" -ForegroundColor White
Write-Host ""
Write-Host "  Two new PowerShell windows have opened." -ForegroundColor Cyan
Write-Host "  Close them to stop the servers." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
