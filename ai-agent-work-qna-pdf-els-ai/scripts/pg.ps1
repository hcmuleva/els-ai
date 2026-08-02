# Installed PostgreSQL control (no Docker or repository-local data directory).
# Usage: .\scripts\pg.ps1 start | stop | status
param([ValidateSet("start", "stop", "status")][string]$Action = "status")

$PG = "C:\Program Files\PostgreSQL\16\bin"
$PGDATA = "C:\Program Files\PostgreSQL\16\data"

switch ($Action) {
    "start"  { & "$PG\pg_ctl.exe" -D "$PGDATA" -l "$PGDATA\server.log" -w start }
    "stop"   { & "$PG\pg_ctl.exe" -D "$PGDATA" -m fast stop }
    "status" { & "$PG\pg_ctl.exe" -D "$PGDATA" status }
}
