# Agnes Planning App — Azure Deployment Guide

## Azure resources (already created)

| Resource | Value |
|---|---|
| Subscription | `e612cd39-37d4-4af0-aa65-b8e3288aff25` |
| Resource group | `MBTimeRG` |
| Web app | `agnes-planning` (agnes-planning.azurewebsites.net) |
| App Service plan | `BudgetApp-server` (B1, Linux, Germany West Central) |
| Runtime | Node 22 LTS |
| Entra app ID | `ef70409a-043b-4664-9257-7bb98997ff80` |
| Entra tenant | `f19d01e1-ad81-47ff-9893-496ed39b3c68` |

Easy Auth (Entra) is already configured on the web app. App settings (DATABASE_URL, BUDGET_APP_URL, etc.) are already set.

---

## Deploying a new version

### 1. Build the zip

Run in PowerShell from the repo root:

```powershell
$zipPath = "C:/Users/idanc/AppData/Local/Temp/agnes-deploy.zip"
Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
$sourceDir = "c:\Users\idanc\repos\Agnes-Planning-App"
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')
$files = Get-ChildItem -Path $sourceDir -Recurse -File | Where-Object {
    $rel = $_.FullName.Substring($sourceDir.Length + 1)
    $parts = $rel.Split('\')
    $parts[0] -notin @('.next', 'node_modules', '.git') -and $_ -notlike '*.env.local'
}
foreach ($file in $files) {
    $relative = $file.FullName.Substring($sourceDir.Length + 1).Replace('\', '/')
    $null = [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $relative)
}
$zip.Dispose()
Write-Host "Created $zipPath ($([math]::Round((Get-Item $zipPath).Length/1MB,2)) MB, $($files.Count) files)"
```

The zip must use **forward slashes** in entry paths (the script above handles this). Do not include `.next/`, `node_modules/`, `.env.local`.

### 2. Deploy

```powershell
az webapp deployment source config-zip `
  --subscription e612cd39-37d4-4af0-aa65-b8e3288aff25 `
  --resource-group MBTimeRG `
  --name agnes-planning `
  --src "C:/Users/idanc/AppData/Local/Temp/agnes-deploy.zip"
```

The az CLI will timeout after ~17 minutes but **the Oryx build continues on Azure**. The full build takes ~23 minutes on the B1 plan:
- `npm install`: ~17 min (production deps including Tailwind CSS tools)
- `next build`: ~6 min

To check if the build actually succeeded after CLI timeout:
```powershell
az rest --method get `
  --url "https://management.azure.com/subscriptions/e612cd39-37d4-4af0-aa65-b8e3288aff25/resourceGroups/MBTimeRG/providers/Microsoft.Web/sites/agnes-planning/deployments?api-version=2022-03-01" `
  --query "value[0].{status:properties.status,complete:properties.complete}"
```
`status: 4` = success.

### 3. Restart after deployment

After deployment completes, the first container start may fail due to a race condition (the Oryx manifest file is written at the very end of the file copy, so the container init may miss it). **Restart once** to fix:

```powershell
az webapp restart `
  --subscription e612cd39-37d4-4af0-aa65-b8e3288aff25 `
  --resource-group MBTimeRG `
  --name agnes-planning
```

The app will be ready ~160 seconds after restart (node_modules extraction ~90s + `next start` ~30s + overhead ~40s).

---

## Important: package.json constraint

`@tailwindcss/postcss` and `tailwindcss` **must remain in `dependencies`** (not `devDependencies`).

`NODE_ENV=production` is set on the web app, which causes `npm install` to skip devDependencies. These two packages are needed at `next build` time.

---

## Monitoring startup

```powershell
az webapp log download `
  --subscription e612cd39-37d4-4af0-aa65-b8e3288aff25 `
  --resource-group MBTimeRG `
  --name agnes-planning `
  --log-file "$env:TEMP\agnes-logs.zip"
```

Extract and read `LogFiles/*_containerStream.log` for container output.

---

## Easy Auth (Entra)

Already configured. If it ever needs to be reconfigured:

- **Use the Azure Portal**, not the CLI (CLI cannot cleanly upgrade between auth v1/v2).
- Portal → App Service → Authentication → Delete existing provider → Add identity provider → Microsoft → Pick existing app registration → enter app ID `ef70409a-043b-4664-9257-7bb98997ff80` and the client secret → set unauthenticated action to "HTTP 302 redirect".
- In the Entra app registration (**Agnes Planning App**), ensure **ID tokens** is checked under Authentication → Implicit grant and hybrid flows.
