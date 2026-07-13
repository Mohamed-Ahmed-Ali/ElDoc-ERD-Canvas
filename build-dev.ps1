<#
.SYNOPSIS
Starts the ElDoc ERD Canvas VS Code extension and Desktop applications in DEVELOPMENT mode.

.DESCRIPTION
This script ensures all dependencies are installed, then concurrently launches the development servers
for the VS Code webview and the Tauri desktop app in separate terminal windows.

.EXAMPLE
.\build-dev.ps1
#>

Write-Host "Installing dependencies..." -ForegroundColor Cyan
pnpm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install dependencies." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n==============================================" -ForegroundColor Magenta
Write-Host " Starting VS Code Extension in Dev Mode..." -ForegroundColor Magenta
Write-Host "==============================================" -ForegroundColor Magenta
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd apps\vscode; pnpm run dev:webview"

Write-Host "`n==============================================" -ForegroundColor Magenta
Write-Host " Starting Desktop Application in Dev Mode..." -ForegroundColor Magenta
Write-Host "==============================================" -ForegroundColor Magenta
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd apps\desktop; pnpm run dev"

Write-Host "`n==============================================" -ForegroundColor Green
Write-Host " Development servers starting in separate windows!" -ForegroundColor Green
Write-Host " - The VS Code extension webview server is running in a new window." -ForegroundColor DarkGray
Write-Host " - The Tauri desktop application is launching in another window." -ForegroundColor DarkGray
Write-Host "==============================================" -ForegroundColor Green
