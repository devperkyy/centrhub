@echo off
REM VANTA :: build + launch (lightweight - only needs .NET 8 SDK, not Visual Studio)
setlocal
cd /d "%~dp0"

where dotnet >nul 2>&1
if errorlevel 1 (
    echo [!] .NET 8 SDK not found.
    echo     Download ^(~200MB^): https://dotnet.microsoft.com/download/dotnet/8.0
    echo     Pick the x64 Installer under "SDK 8.0.x".
    pause & exit /b 1
)

echo [*] building Loader ^(WPF, .NET 8^)...
pushd Loader
dotnet publish Loader.csproj -c Release -r win-x64 --self-contained false -o ..\dist /p:EnableWindowsTargeting=true -v minimal
if errorlevel 1 ( echo [!] Loader build failed & popd & pause & exit /b 1 )
popd

if not exist "dist\Bootstrap.dll"   echo [!] missing prebuilt Bootstrap.dll  — grab from the project root dist\ folder
if not exist "dist\Injector.exe"    echo [!] missing prebuilt Injector.exe
if not exist "dist\EarlyLaunch.exe" echo [!] missing prebuilt EarlyLaunch.exe
if not exist "dist\Mapper.exe"      echo [!] missing prebuilt Mapper.exe

echo.
echo [+] launching VANTA...
start "" "dist\RobloxExecutor.exe"
echo [+] dist folder: %cd%\dist
