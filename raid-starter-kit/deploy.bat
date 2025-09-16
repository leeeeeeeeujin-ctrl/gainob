@echo off
echo Vercel 배포를 시작합니다...
echo.
echo 1. Vercel CLI 설치 확인 중...
npx vercel --version >nul 2>&1
if errorlevel 1 (
    echo Vercel CLI가 설치되지 않았습니다. 설치 중...
    npm install -g vercel
)

echo.
echo 2. Vercel 로그인 확인 중...
vercel whoami >nul 2>&1
if errorlevel 1 (
    echo Vercel에 로그인해주세요...
    vercel login
)

echo.
echo 3. 프로젝트 배포 중...
vercel --prod

echo.
echo 배포 완료! 주소를 복사해서 공유하세요.
pause
