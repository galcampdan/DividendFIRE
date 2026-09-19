@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Dividend FIRE - Microsoft Defender Verification

echo ==============================================
echo   Dividend FIRE - Local Defender Verification
echo ==============================================
echo.

set "TARGET=%~1"
if not defined TARGET (
  for %%F in ("%~dp0DividendFIRE-Setup-v*.exe") do (
    set "TARGET=%%~fF"
    goto :FOUND
  )
)

:FOUND
if not defined TARGET (
  echo [ERROR] Installer not found.
  echo Drag DividendFIRE-Setup-vX.Y.Z.exe onto this BAT,
  echo or place this BAT beside the installer and run it.
  pause
  exit /b 1
)

if not exist "%TARGET%" (
  echo [ERROR] File does not exist:
  echo %TARGET%
  pause
  exit /b 1
)

echo Target:
echo %TARGET%
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$p=(Resolve-Path -LiteralPath '%TARGET%').Path;" ^
  "Write-Host '[1/3] Checking Microsoft Defender...';" ^
  "$s=Get-MpComputerStatus;" ^
  "if(-not $s.AntivirusEnabled){throw 'Microsoft Defender Antivirus is not enabled.'};" ^
  "Write-Host ('Defender enabled: ' + $s.AntivirusEnabled);" ^
  "Write-Host '[2/3] Starting custom scan...';" ^
  "Start-MpScan -ScanType CustomScan -ScanPath $p;" ^
  "Write-Host '[3/3] Checking recent threat detections...';" ^
  "$since=(Get-Date).AddMinutes(-10);" ^
  "$hits=@(Get-MpThreatDetection -ErrorAction SilentlyContinue | Where-Object {$_.InitialDetectionTime -ge $since -and ($_.Resources -join ' ') -like ('*'+[IO.Path]::GetFileName($p)+'*')});" ^
  "if($hits.Count -gt 0){$hits | Format-List ThreatID,InitialDetectionTime,Resources; throw 'Defender reported a threat for this installer.'};" ^
  "$h=(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash;" ^
  "Write-Host ''; Write-Host '[CLEAN] Defender custom scan completed with no matching detection.' -ForegroundColor Green;" ^
  "Write-Host ('SHA256: ' + $h);"

if errorlevel 1 (
  echo.
  echo [FAIL] Defender verification did not pass.
  echo Do NOT add a Defender exclusion just to make it run.
  pause
  exit /b 1
)

echo.
echo Verification completed.
pause
exit /b 0
