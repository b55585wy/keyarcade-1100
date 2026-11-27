@echo off
setlocal
set "SDK=%LOCALAPPDATA%\Android\Sdk"
set "ADB=%SDK%\platform-tools\adb.exe"
set "EMU=%SDK%\emulator\emulator.exe"
set "AVD=KeyArcade_Phone"
set "APK=%~dp0..\android\app\build\outputs\apk\debug\app-debug.apk"

echo [KeyArcade 1100] Checking emulator status (%AVD%)...

:: Gracefully stop any background headless instance holding the AVD lock
"%ADB%" -s emulator-5554 emu kill >nul 2>&1
timeout /t 3 /nobreak >nul
tasklist /FI "IMAGENAME eq qemu-system-x86_64.exe" 2>nul | find /I "qemu-system-x86_64.exe" >nul && taskkill /F /IM qemu-system-x86_64.exe >nul 2>&1
tasklist /FI "IMAGENAME eq emulator.exe" 2>nul | find /I "emulator.exe" >nul && taskkill /F /IM emulator.exe >nul 2>&1

echo [KeyArcade 1100] Launching Android Emulator window...
start "KeyArcade_Phone Emulator" "%EMU%" -avd %AVD% -gpu auto

echo [KeyArcade 1100] Waiting for Android device and boot completion...
"%ADB%" wait-for-device
:waitboot
"%ADB%" shell getprop sys.boot_completed 2>nul | find "1" >nul
if errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto waitboot
)

if exist "%APK%" (
    echo [KeyArcade 1100] Installing/updating KeyArcade 1100 APK...
    "%ADB%" -s emulator-5554 install -r "%APK%"
)

echo [KeyArcade 1100] Starting KeyArcade 1100 App...
"%ADB%" -s emulator-5554 shell am start -W -n "com.keyarcade.app1100/.MainActivity"

echo.
echo [KeyArcade 1100] Android Emulator and App are running!
timeout /t 3 /nobreak >nul
