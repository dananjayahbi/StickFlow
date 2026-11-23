#Requires -Version 5.1
# Install StickFlow's local runtime and register the Skill with OpenCode.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    Write-Host 'Installing Node runtime dependencies...' -ForegroundColor Cyan
    npm install --prefix skills/stickflow
    if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }

    Write-Host 'Checking B / Code Engine dependencies...' -ForegroundColor Cyan
    node skills/stickflow/scripts/autopilot.mjs doctor
    if ($LASTEXITCODE -ne 0) { throw 'doctor failed' }
    node skills/stickflow/scripts/autopilot.mjs doctor --style B6 --python python

    $skillsDir = Join-Path $env:USERPROFILE '.config\opencode\skills'
    $link = Join-Path $skillsDir 'stickflow'
    New-Item -ItemType Directory -Force -Path $skillsDir | Out-Null
    if (-not (Test-Path $link)) {
        New-Item -ItemType Junction -Path $link -Target (Join-Path $root 'skills\stickflow') | Out-Null
        Write-Host "Registered Skill: $link" -ForegroundColor Green
    } else {
        Write-Host "Skill already registered: $link" -ForegroundColor Yellow
    }

    Write-Host ''
    Write-Host 'StickFlow is ready. Open a new agent conversation and ask for a B-style video.' -ForegroundColor Green
} finally {
    Pop-Location
}
