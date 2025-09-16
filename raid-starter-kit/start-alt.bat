@echo off
echo ========================================
echo    Raid Starter Kit - 서버 시작 (포트 3000)
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
echo [2/3] 서버 시작 중...
echo 서버 주소: http://localhost:3000
echo 브라우저에서 자동으로 열립니다...
echo.
echo 종료하려면 Ctrl+C를 누르세요
echo.

start http://localhost:3000
set PORT=3000
npm start

echo.
echo 서버가 종료되었습니다.
pause
