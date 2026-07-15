<#
.SYNOPSIS
Builds the ElDoc ERD Canvas VS Code extension and Desktop applications for PRODUCTION.

.DESCRIPTION
This script ensures all dependencies are installed, then sequentially packages the VS Code extension
and compiles the Tauri Desktop application for release.

.EXAMPLE
.\build-prod.ps1
#>

Write-Host "Installing dependencies..." -ForegroundColor Cyan
pnpm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install dependencies." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n==============================================" -ForegroundColor Magenta
Write-Host " Compiling TypeScript (All Workspaces)..." -ForegroundColor Magenta
Write-Host "==============================================" -ForegroundColor Magenta
pnpm -r build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Workspace TypeScript build failed." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n==============================================" -ForegroundColor Magenta
Write-Host " Building MCP CLI Server (Production)..." -ForegroundColor Magenta
Write-Host "==============================================" -ForegroundColor Magenta
Set-Location -Path "apps\mcp-cli"
pnpm run pkg
if ($LASTEXITCODE -ne 0) {
    Write-Host "MCP CLI Server build failed." -ForegroundColor Red
    Set-Location -Path "..\.."
    exit $LASTEXITCODE
}
Set-Location -Path "..\.."

Write-Host "`n==============================================" -ForegroundColor Magenta
Write-Host " Building VS Code Extension (Production)..." -ForegroundColor Magenta
Write-Host "==============================================" -ForegroundColor Magenta
Set-Location -Path "apps\vscode"
pnpm dlx @vscode/vsce package --no-dependencies
if ($LASTEXITCODE -ne 0) {
    Write-Host "VS Code extension build failed." -ForegroundColor Red
    Set-Location -Path "..\.."
    exit $LASTEXITCODE
}
Set-Location -Path "..\.."

Write-Host "`n==============================================" -ForegroundColor Magenta
Write-Host " Building Desktop Application (Production)..." -ForegroundColor Magenta
Write-Host "==============================================" -ForegroundColor Magenta
Set-Location -Path "apps\desktop"
pnpm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Desktop build failed." -ForegroundColor Red
    Set-Location -Path "..\.."
    exit $LASTEXITCODE
}
Set-Location -Path "..\.."

Write-Host "`n==============================================" -ForegroundColor Green
Write-Host " All production builds completed successfully!" -ForegroundColor Green
Write-Host " - VS Code output is in apps\vscode\*.vsix" -ForegroundColor DarkGray
Write-Host " - Desktop output is in apps\desktop\src-tauri\target\release" -ForegroundColor DarkGray
Write-Host " - MCP CLI Server output is in apps\desktop\src-tauri\bin" -ForegroundColor DarkGray
Write-Host "==============================================" -ForegroundColor Green
