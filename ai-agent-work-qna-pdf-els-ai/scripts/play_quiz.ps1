# One-command launcher for the unified Question Player.
#   .\scripts\play_quiz.ps1
#   .\scripts\play_quiz.ps1 -Open
#   .\scripts\play_quiz.ps1 -Port 8080
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 8000,
    [switch]$Open
)

$Root = Split-Path $PSScriptRoot -Parent
$py = Join-Path $Root '.venv\Scripts\python.exe'
$server = Join-Path $Root 'scripts\quiz_server.py'
$pgScript = Join-Path $Root 'scripts\pg.ps1'

if (-not (Test-Path $py)) {
    throw "Python environment not found: $py"
}

if (Test-Path $pgScript) {
    & $pgScript status *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[player] Starting PostgreSQL..."
        & $pgScript start
        if ($LASTEXITCODE -ne 0) {
            throw "PostgreSQL could not be started. Run '$pgScript status' for details."
        }
    }
}

$env:PYTHONPATH = Join-Path $Root 'src'
$url = "http://127.0.0.1:$Port"
Write-Host "[player] Prilepko Question Player -> $url   (Ctrl+C to stop)"

if ($Open) {
    Start-Process $url
}

& $py $server --port $Port --host 127.0.0.1
exit $LASTEXITCODE
