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

## Fast deploy (~3-4 min) — use this

Builds locally, ships only the standalone Next.js output — no remote `npm install`.

```powershell
.\scripts\deploy-fast.ps1
```

What it does:
1. `next build` locally (~2 min on dev machine)
2. Copies `.next/static` and `public` into `.next/standalone`
3. Zips only the standalone artifacts (~20-50 MB)
4. Deploys the zip (Azure just extracts and starts — no build step)
5. Restarts the app

Azure is already configured for this:
- `SCM_DO_BUILD_DURING_DEPLOYMENT=false` (skips Oryx)
- Startup command: `node server.js`

---

## Slow deploy (~23 min) — legacy, do not use

Left here for reference only. Requires SCM basic auth to be enabled.

```powershell
# Build the zip (source only, no .next or node_modules)
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

# Deploy (Oryx remote build: npm install ~17min + next build ~6min)
az webapp deployment source config-zip `
  --subscription e612cd39-37d4-4af0-aa65-b8e3288aff25 `
  --resource-group MBTimeRG `
  --name agnes-planning `
  --src $zipPath
```

---

## Checking build/deploy status

```powershell
az rest --method get `
  --url "https://management.azure.com/subscriptions/e612cd39-37d4-4af0-aa65-b8e3288aff25/resourceGroups/MBTimeRG/providers/Microsoft.Web/sites/agnes-planning/deployments?api-version=2022-03-01" `
  --query "value[0].{status:properties.status,complete:properties.complete}"
```
`status: 4` = success, `status: 1` = in progress, `status: 3` = failed.

---

## Restart after deployment

```powershell
az webapp restart `
  --subscription e612cd39-37d4-4af0-aa65-b8e3288aff25 `
  --resource-group MBTimeRG `
  --name agnes-planning
```

App ready ~60 seconds after restart.

---

## SCM basic auth

SCM basic auth publishing is enabled (`basicPublishingCredentialsPolicies/scm = true`).
Required for zip deploy. Do not disable.

---

## Important: package.json constraint

`@tailwindcss/postcss` and `tailwindcss` **must remain in `dependencies`** (not `devDependencies`).
These are needed at build time and the fast deploy does a local `next build`.

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
