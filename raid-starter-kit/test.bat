@echo off
echo ========================================
echo    Raid Starter Kit - 테스트
echo ========================================
echo.

echo [1/4] Node.js 확인...
node --version
if errorlevel 1 (
    echo 오류: Node.js가 설치되어 있지 않습니다.
    pause
    exit /b 1
)

echo.
echo [2/4] 의존성 확인...
if not exist "node_modules" (
    echo 의존성이 설치되어 있지 않습니다. install.bat을 먼저 실행하세요.
    pause
    exit /b 1
)

echo.
echo [3/4] 파일 구조 확인...
if not exist "server\server.js" (
    echo 오류: server\server.js 파일이 없습니다.
    pause
    exit /b 1
)

if not exist "public\pages\lobby.html" (
    echo 오류: public\pages\lobby.html 파일이 없습니다.
    pause
    exit /b 1
)

echo 모든 파일이 정상적으로 있습니다.

echo.
echo [4/4] 서버 테스트 시작...
echo 서버를 5초간 실행하여 테스트합니다...
echo.

timeout /t 1 /nobreak >nul
start /b npm start
timeout /t 5 /nobreak >nul

echo.
echo 테스트 완료!
echo 브라우저에서 http://localhost:8080 을 열어보세요.
echo.
echo 서버를 계속 실행하려면 start.bat을 사용하세요.
echo.
pause
