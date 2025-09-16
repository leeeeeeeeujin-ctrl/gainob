@echo off
echo ========================================
echo    포트 8080 사용 프로세스 종료
echo ========================================
echo.

echo 8080 포트를 사용하는 프로세스를 찾는 중...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080') do (
    set pid=%%a
    goto :found
)

echo 8080 포트를 사용하는 프로세스가 없습니다.
echo.
pause
exit /b 0

:found
echo 8080 포트를 사용하는 프로세스 ID: %pid%

echo.
set /p confirm="이 프로세스를 종료하시겠습니까? (y/N): "
if /i not "%confirm%"=="y" (
    echo 취소되었습니다.
    pause
    exit /b 0
)

echo.
echo 프로세스를 종료하는 중...
taskkill /f /pid %pid%
if errorlevel 1 (
    echo 오류: 프로세스 종료 실패
    pause
    exit /b 1
)

echo 프로세스가 성공적으로 종료되었습니다.
echo 이제 start.bat을 실행할 수 있습니다.
echo.
pause
