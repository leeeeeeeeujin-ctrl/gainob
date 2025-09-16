@echo off
echo ========================================
echo    Raid Starter Kit - 설치
echo ========================================
echo.

echo Node.js가 설치되어 있는지 확인 중...
node --version >nul 2>&1
if errorlevel 1 (
    echo 오류: Node.js가 설치되어 있지 않습니다.
    echo https://nodejs.org 에서 Node.js를 다운로드하여 설치하세요.
    pause
    exit /b 1
)

echo Node.js 버전:
node --version

echo.
echo npm 버전:
npm --version

echo.
echo [1/2] 의존성 설치 중...
npm install
if errorlevel 1 (
    echo 오류: npm install 실패
    pause
    exit /b 1
)

echo.
echo [2/2] 설치 완료!
echo.
echo 이제 start.bat 파일을 실행하여 서버를 시작할 수 있습니다.
echo.
pause
