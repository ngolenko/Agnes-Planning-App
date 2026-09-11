# Fast deploy: build locally, ship the FULL standalone output to Azure (~3-4 min vs ~23 min)
# Run from the repo root: .\scripts\deploy-fast.ps1
#
# Deploy flow:
#   1. npm run build  ->  builds with WEBPACK (see package.json "build": "next build --webpack")
#      Turbopack is NOT used: its serverExternalPackages support emits a broken hashed
#      module id  require("@prisma/client-<hash>")  that fails at runtime with 500s.
#   2. Zip the standalone dir INCLUDING node_modules. The webpack standalone trace contains
#      the complete `next` runtime (next/dist/compiled/next-server/*) AND @prisma/client +
#      the Linux query engine. Do NOT let Oryx npm-install instead — its trace differs and
#      breaks the webpack server.js.
#   3. az webapp deploy sends the zip; Oryx compresses the shipped node_modules into
#      node_modules.tar.gz + writes oryx-manifest.toml (it does NOT npm install — that is
#      disabled via ENABLE_ORYX_BUILD=false and no CUSTOM_BUILD_COMMAND).
#   4. At startup, container extracts the tarball, then runs: node server.js
#
# One-time app settings required (already set):
#   ENABLE_ORYX_BUILD=false, SCM_DO_BUILD_DURING_DEPLOYMENT=false  (no CUSTOM_BUILD_COMMAND)

Set-Location $PSScriptRoot\..

Write-Host "Building locally..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed" -ForegroundColor Red; exit 1 }

# Locate server.js in the standalone output (path varies by OS/Next.js version)
$serverJsMatch = Get-ChildItem -Path ".next\standalone" -Name "server.js" -Recurse | Select-Object -First 1
if (-not $serverJsMatch) { Write-Host "ERROR: server.js not found in .next\standalone" -ForegroundColor Red; exit 1 }
$deployDir = Split-Path (Resolve-Path (Join-Path ".next\standalone" $serverJsMatch)) -Parent
Write-Host "server.js found in: $deployDir" -ForegroundColor Cyan

# Copy static assets into the correct subdirectory (Next.js requires this)
Copy-Item -Recurse -Force ".next\static" "$deployDir\.next\static"
Copy-Item -Recurse -Force "public"       "$deployDir\public"

# Copy Prisma Linux engine to a stable folder that PRISMA_QUERY_ENGINE_LIBRARY points at.
# (Prisma also finds the engine inside node_modules/.prisma/client, but this is a backup.)
$engineSrc = "node_modules\.prisma\client\libquery_engine-debian-openssl-3.0.x.so.node"
$engineDst = "$deployDir\prisma-engine"
New-Item -ItemType Directory -Force $engineDst | Out-Null
Copy-Item -Force $engineSrc $engineDst
Write-Host "Prisma Linux engine -> prisma-engine/" -ForegroundColor Cyan

# Package the FULL standalone output INCLUDING node_modules.
# Exclude only the Windows-only engine + tmp files (can't run on Linux, just bloat).
Write-Host "Packaging..." -ForegroundColor Cyan
$zipPath = "C:\Users\idanc\AppData\Local\Temp\agnes-deploy-standalone.zip"
if (Test-Path $zipPath) { [System.IO.File]::Delete($zipPath) }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')
$files = Get-ChildItem -Path $deployDir -Recurse -File |
    Where-Object { $_.Name -notlike "*.tmp*" -and $_.Name -ne "query_engine-windows.dll.node" }
foreach ($file in $files) {
    $relative = $file.FullName.Substring($deployDir.Length + 1).Replace('\', '/')
    $null = [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $relative)
}
$zip.Dispose()
$sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host "Package: $zipPath ($sizeMB MB, $($files.Count) files)" -ForegroundColor Cyan

Write-Host "Deploying to Azure..." -ForegroundColor Cyan
az webapp deploy `
    --subscription e612cd39-37d4-4af0-aa65-b8e3288aff25 `
    --resource-group MBTimeRG `
    --name agnes-planning `
    --src-path $zipPath `
    --type zip `
    --async true

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deploy submitted. App restarts in ~3-5 min at https://agnes-planning.azurewebsites.net" -ForegroundColor Green
} else {
    Write-Host "Deploy failed." -ForegroundColor Red
}
