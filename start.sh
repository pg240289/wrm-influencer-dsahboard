#!/bin/bash

echo "============================================"
echo "  Influencer Dashboard Startup Script"
echo "============================================"
echo ""

# Kill any existing processes on ports 5000 and 3000
echo "Checking for existing processes..."

# Kill process on port 5000 (Backend)
lsof -ti:5000 | xargs kill -9 2>/dev/null && echo "Killed process on port 5000"

# Kill process on port 3000 (Frontend)
lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "Killed process on port 3000"

echo ""
echo "Starting Backend (Flask) on http://localhost:5000..."
echo "============================================"

# Start Backend in background
cd backend
python app.py &
BACKEND_PID=$!
cd ..

echo ""
echo "Waiting 3 seconds for backend to start..."
sleep 3

echo ""
echo "Starting Frontend (React) on http://localhost:3000..."
echo "============================================"

# Start Frontend in background
cd frontend
npm start &
FRONTEND_PID=$!
cd ..

echo ""
echo "============================================"
echo "  Both servers are running!"
echo "============================================"
echo ""
echo "  Backend:  http://localhost:5000 (PID: $BACKEND_PID)"
echo "  Frontend: http://localhost:3000 (PID: $FRONTEND_PID)"
echo ""
echo "  Default Credentials:"
echo "  - Admin:   admin / admin123"
echo "  - Manager: manager / manager123"
echo ""
echo "  Press Ctrl+C to stop both servers."
echo "============================================"
echo ""

# Wait for Ctrl+C
trap "echo ''; echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT

# Keep script running
wait
