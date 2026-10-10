@echo off
REM VANTA :: push to github
REM Usage: push_to_github.bat <github-username> <repo-name>
REM Needs: git installed, github auth already set up (gh auth or token in cred manager)
setlocal
cd /d "%~dp0"
if "%~2"=="" ( echo usage: push_to_github.bat ^<username^> ^<repo^> & exit /b 1 )

if not exist .git ( git init & git branch -M main )

REM gitignore
> .gitignore (
    echo bin/
    echo obj/
    echo .vs/
    echo x64/
    echo Debug/
    echo Release/
    echo dist/
    echo *.user
    echo *.suo
    echo luau-core.tar.gz
)

git add -A
git -c user.email=dev@vanta.local -c user.name=VANTA commit -m "VANTA executor + Da Hood loadout"
git remote remove origin 2>nul
git remote add origin https://github.com/%1/%2.git

echo.
echo [*] pushing - if github prompts for creds, enter your PAT as password
git push -u origin main
