@echo off
chcp 65001 >nul
echo ================================
echo   GitHub 업로드 스크립트
echo ================================
echo.

cd /d "%~dp0"

echo [1/3] 변경사항 확인 중...
git status
echo.

set /p commit_msg="커밋 메시지를 입력하세요 (엔터=자동): "
if "%commit_msg%"=="" set commit_msg=코드 업데이트 %date% %time%

echo.
echo [2/3] 변경사항 추가 및 커밋 중...
git add .
git commit -m "%commit_msg%"

echo.
echo [3/3] GitHub에 업로드 중...
git push

echo.
echo ================================
echo   업로드 완료!
echo ================================
pause
