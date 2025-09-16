@echo off
echo ========================================
echo    Raid Starter Kit - 서버 시작
echo ========================================
echo.

echo [1/3] 의존성 확인 중...
if not exist "node_modules" (
    echo 의존성을 설치합니다...
    npm install
    if errorlevel 1 (
        echo 오류: npm install 실패
        pause
        exit /b 1
    )
    echo 의존성 설치 완료!
) else (
    echo 의존성이 이미 설치되어 있습니다.
)

echo.
echo [2/3] 포트 확인 중...
netstat -aon | findstr :8080 >nul
if not errorlevel 1 (
    echo 경고: 8080 포트가 이미 사용 중입니다.
    echo kill-port.bat을 실행하여 포트를 해제하거나
    echo start-alt.bat을 사용하여 다른 포트(3000)로 실행하세요.
    echo.
    set /p choice="포트를 해제하고 계속하시겠습니까? (y/N): "
    if /i not "%choice%"=="y" (
        echo 취소되었습니다.
        pause
        exit /b 0
    )
    echo 8080 포트를 사용하는 프로세스를 종료합니다...
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080') do taskkill /f /pid %%a >nul 2>&1
    timeout /t 2 /nobreak >nul
)

echo.
echo [3/3] 서버 시작 중...
echo 서버 주소: http://localhost:8080
echo 브라우저에서 자동으로 열립니다...
echo.
echo 종료하려면 Ctrl+C를 누르세요
echo.

start http://localhost:8080
npm start

echo.
echo 서버가 종료되었습니다.
pause
