@echo off
setlocal enabledelayedexpansion

echo.
echo 🐐 Starting Goat Collar Demo...
echo.

REM Check if backend directory exists
if not exist "backend\" (
    echo Error: backend directory not found!
    pause
    exit /b 1
)

REM Check if frontend directory exists
if not exist "frontend\" (
    echo Error: frontend directory not found!
    pause
    exit /b 1
)

REM Check if model files exist
if not exist "backend\M1_collar_model.joblib" (
    echo Error: M1_collar_model.joblib not found in backend\!
    pause
    exit /b 1
)

REM Start backend
echo Starting backend...
cd backend

REM Check if venv exists
if not exist "venv\" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate venv
call venv\Scripts\activate.bat

REM Install/update dependencies
pip install -q -r requirements.txt

REM Start Flask server in new window
start "Goat Collar Backend" cmd /k "python app.py"
echo ✓ Backend started
timeout /t 2 /nobreak

cd ..

REM Start frontend
cd frontend

REM Check if node_modules exists
if not exist "node_modules\" (
    echo Installing frontend dependencies...
    call npm install --silent
)

echo Starting frontend...
start "Goat Collar Frontend" cmd /k "npm start"
echo ✓ Frontend started
timeout /t 3 /nobreak

cd ..

echo.
echo ==========================================
echo 🐐 Goat Collar Demo is Ready!
echo ==========================================
echo.
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:5000
echo Health:   http://localhost:5000/health
echo.
echo The browser will open automatically.
echo.
echo To stop, close both console windows.
echo ==========================================
echo.

timeout /t 5 /nobreak

REM Open browser
start "" http://localhost:3000

pause
