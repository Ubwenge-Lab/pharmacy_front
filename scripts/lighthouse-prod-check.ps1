# Checks whether the live E-Vuze site can log anyone in, and if so runs a
# logged-in Lighthouse baseline on 2 accounts (pharmacy owner + doctor).
#
#   powershell -ExecutionPolicy Bypass -File scripts\lighthouse-prod-check.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\lighthouse-prod-check.ps1 -CheckOnly
param([switch]$CheckOnly)

$frontend = 'https://evuze.ubwengelab.rw'
$backend  = 'https://pharmacy-backend-hmir.onrender.com/api'

function Get-Status($url, $method = 'GET', $body = $null) {
  try {
    $r = Invoke-WebRequest -Uri $url -Method $method -Body $body -ContentType 'application/json' -UseBasicParsing -TimeoutSec 60 -MaximumRedirection 0 -ErrorAction Stop
    return @{ Code = [int]$r.StatusCode; Render = $r.Headers['x-render-routing'] }
  } catch {
    $resp = $_.Exception.Response
    if ($resp) { return @{ Code = [int]$resp.StatusCode; Render = $resp.Headers['x-render-routing'] } }
    return @{ Code = 0; Render = $_.Exception.Message }
  }
}

Write-Host "`n== Production check $(Get-Date -Format 'yyyy-MM-dd HH:mm') ==" -ForegroundColor Cyan
$fe = Get-Status "$frontend/login"
Write-Host ("Frontend  {0,-55} {1}" -f "$frontend/login", $fe.Code)
# A wrong password should give 401 when the backend is healthy.
$be = Get-Status "$backend/auth/login" 'POST' '{"email":"healthcheck@example.com","password":"x"}'
Write-Host ("Backend   {0,-55} {1} {2}" -f "$backend/auth/login", $be.Code, $be.Render)

if ($fe.Code -ne 200) { Write-Host "`nFrontend is down. Stop here." -ForegroundColor Red; exit 1 }
if ($be.Code -eq 503 -and "$($be.Render)" -match 'suspend') {
  Write-Host "`nBackend is SUSPENDED on Render. Nobody can log in. Resume the service in the Render dashboard, then run this again." -ForegroundColor Red; exit 1
}
if ($be.Code -ne 401 -and $be.Code -ne 400) {
  Write-Host "`nBackend not healthy (HTTP $($be.Code)). If it was asleep, wait 1 minute and run again." -ForegroundColor Yellow; exit 1
}
Write-Host "`nBackend is UP (a wrong password was correctly rejected)." -ForegroundColor Green
if ($CheckOnly) { exit 0 }

Write-Host "`nA Chrome window will open twice. Log in as:" -ForegroundColor Cyan
Write-Host "  1. owner@medplus.com   (pharmacy owner)"
Write-Host "  2. eric@kingfaisal.com (doctor)"
Write-Host "Use the live-site test password for each account.`n"
Set-Location (Split-Path $PSScriptRoot -Parent)
node scripts/lighthouse-baseline.js --routes lighthouse/routes.production-smoke.json --interactive-login
exit $LASTEXITCODE
