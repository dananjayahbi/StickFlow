#Requires -Version 5.1
# Render the bundled B1 example locally: 16.4 s, 1280x720, 30 fps, with narration.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$work = Join-Path $root 'output\demo-b1'
Push-Location $root
try {
    if (Test-Path $work) { Remove-Item -Recurse -Force $work }
    New-Item -ItemType Directory -Force -Path $work | Out-Null
    Copy-Item skills/stickflow/examples/b1/* $work -Recurse

    Write-Host 'Rendering the B1 example preview (this is the full 16.4 s film)...' -ForegroundColor Cyan
    node skills/stickflow/scripts/autopilot.mjs preview (Join-Path $work 'project.json') --seconds 16.4 --replace
    if ($LASTEXITCODE -ne 0) { throw 'render failed' }

    $out = Join-Path $root 'output\StickFlow-B1-demo.mp4'
    Copy-Item (Join-Path $work 'output\preview.mp4') $out -Force
    Write-Host "Done: $out" -ForegroundColor Green
    ffprobe -v error -show_entries format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate -of json $out
} finally {
    Pop-Location
}
