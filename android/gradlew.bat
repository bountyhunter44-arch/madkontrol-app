@echo off
setlocal

set "GRADLE_DIST=%USERPROFILE%\.gradle\wrapper\dists\gradle-8.14.3-all"
for /d %%D in ("%GRADLE_DIST%\*") do (
  if exist "%%D\gradle-8.14.3\bin\gradle.bat" (
    call "%%D\gradle-8.14.3\bin\gradle.bat" %*
    exit /b %ERRORLEVEL%
  )
)

echo Gradle 8.14.3 was not found in %GRADLE_DIST%.
echo Install Gradle wrapper or run Capacitor sync before building.
exit /b 1
