param(
  [switch]$Dev,
  [switch]$Build,
  [switch]$NoBrowser
)

$root = Split-Path -Parent $PSScriptRoot
$config = Get-Content (Join-Path $root 'stickflow.config.json') -Raw | ConvertFrom-Json
$port = $config.dashboard.port
$studio = Join-Path $root 'studio'

if (-not (Test-Path (Join-Path $studio 'node_modules'))) {
  Write-Host 'Installing Studio dependencies...'
  Push-Location $studio
  npm install --no-audit --no-fund
  Pop-Location
}

if ($Build -or -not (Test-Path (Join-Path $studio '.next'))) {
  Write-Host 'Building Studio...'
  Push-Location $studio
  npm run build
  Pop-Location
}

Write-Host "StickFlow Studio: http://127.0.0.1:$port"
if (-not $NoBrowser) {
  Start-Process "http://127.0.0.1:$port"
}

Push-Location $studio
try {
  if ($Dev) {
    npx next dev -p $port
  } else {
    npx next start -p $port
  }
} finally {
  Pop-Location
}
