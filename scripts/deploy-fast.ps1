# Fast deploy: build locally, ship standalone output to Azure (~3-4 min vs ~23 min)
# Run from the repo root: .\scripts\deploy-fast.ps1

Set-Location $PSScriptRoot\..

Write-Host "Building locally..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed" -ForegroundColor Red; exit 1 }

# Copy static assets into standalone (Next.js requires this)
$standaloneDir = ".next\standalone"
Copy-Item -Recurse -Force ".next\static"  "$standaloneDir\.next\static"
Copy-Item -Recurse -Force "public"         "$standaloneDir\public"

Write-Host "Packaging..." -ForegroundColor Cyan
$zipPath = "$env:TEMP\agnes-deploy-standalone.zip"
Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')
$base = (Resolve-Path $standaloneDir).Path
$files = Get-ChildItem -Path $base -Recurse -File
foreach ($file in $files) {
    $relative = $file.FullName.Substring($base.Length + 1).Replace('\', '/')
    $null = [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $relative)
}
$zip.Dispose()
$sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host "Package: $zipPath ($sizeMB MB, $($files.Count) files)" -ForegroundColor Cyan

Write-Host "Deploying to Azure..." -ForegroundColor Cyan
az webapp deployment source config-zip `
    --subscription e612cd39-37d4-4af0-aa65-b8e3288aff25 `
    --resource-group MBTimeRG `
    --name agnes-planning `
    --src $zipPath

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deploy complete. Restarting app..." -ForegroundColor Green
    az webapp restart `
        --subscription e612cd39-37d4-4af0-aa65-b8e3288aff25 `
        --resource-group MBTimeRG `
        --name agnes-planning
    Write-Host "Done! App will be ready at https://agnes-planning.azurewebsites.net in ~2 min." -ForegroundColor Green
} else {
    Write-Host "Deploy failed." -ForegroundColor Red
}
