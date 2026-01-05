@echo off
setlocal

echo ========================================
echo Building Novel Translator APK
echo ========================================
echo.

REM Set Java and Android SDK paths
set "JAVA_HOME=C:\Program Files\Java\jdk-21"
set "ANDROID_HOME=E:\android_sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\cmdline-tools\latest\bin;%ANDROID_HOME%\platform-tools;%PATH%"

echo Java version:
java -version
echo.

echo ========================================
echo Accepting Android Licenses...
echo ========================================
REM This line automatically sends "y" to the license manager
echo y| call sdkmanager --licenses

echo ========================================
echo Starting Gradle build...
echo ========================================
echo.

REM Build APK
cd android
call gradlew.bat assembleDebug

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo BUILD SUCCESSFUL!
    echo ========================================
    echo APK location:
    echo android\app\build\outputs\apk\debug\app-debug.apk
    echo.
) else (
    echo.
    echo ========================================
    echo BUILD FAILED!
    echo ========================================
)

pause