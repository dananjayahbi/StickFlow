#Requires -Version 5.1
# Run the local Code Engine verification suite (no network, no paid model calls).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
$failed = 0
try {
    Write-Host '== Brand isolation ==' -ForegroundColor Cyan
    python tests/verify-brand-isolation.py
    if ($LASTEXITCODE -ne 0) { $failed++ }

    Write-Host '== Runtime Node tests ==' -ForegroundColor Cyan
    npm test --prefix skills/stickflow
    if ($LASTEXITCODE -ne 0) { $failed++ }

    Write-Host '== Runtime Python tests ==' -ForegroundColor Cyan
    Get-ChildItem skills/stickflow/tests/*_test.py, skills/stickflow/tests/test_*.py |
        ForEach-Object {
            Write-Host "-- $($_.Name)"
            python $_.FullName
            if ($LASTEXITCODE -ne 0) { $failed++; Write-Host "FAILED: $($_.Name)" -ForegroundColor Red }
        }

    Write-Host '== Repository checks ==' -ForegroundColor Cyan
    Get-ChildItem tests/verify-*.py | ForEach-Object {
        Write-Host "-- $($_.Name)"
        python $_.FullName
        if ($LASTEXITCODE -ne 0) { $failed++; Write-Host "FAILED: $($_.Name)" -ForegroundColor Red }
    }
} finally {
    Pop-Location
}
if ($failed) {
    Write-Host "$failed verification group(s) failed." -ForegroundColor Red
    exit 1
}
Write-Host 'All StickFlow checks passed.' -ForegroundColor Green
exit 0
