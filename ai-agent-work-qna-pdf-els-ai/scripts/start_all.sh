#!/usr/bin/env bash
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

API_PORT="${1:-8000}"
PLAYER_PORT="${2:-8010}"

export KP_PROVIDER="${KP_PROVIDER:-local}"
export KP_LOCAL_LLM_BASE_URL="${KP_LOCAL_LLM_BASE_URL:-http://127.0.0.1:11434/v1}"
export KP_LOCAL_LLM_MODEL="${KP_LOCAL_LLM_MODEL:-qwen2.5-coder:7b}"
export KP_POSTGRES_DSN="${KP_POSTGRES_DSN:-postgresql://kp:kp@127.0.0.1:5544/kp}"
export KP_API_HOST="127.0.0.1"
export KP_API_PORT="$API_PORT"

PYTHON_BIN="python3"
if [ -f "$REPO_ROOT/.venv/bin/python" ]; then
    PYTHON_BIN="$REPO_ROOT/.venv/bin/python"
fi

free_port() {
    local port="$1"
    local pids
    pids=$(lsof -ti:"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo "[start] Freeing port $port (killing existing PID(s): $pids)..."
        kill -15 $pids 2>/dev/null || true
        sleep 0.5
        kill -9 $pids 2>/dev/null || true
    fi
}

free_port "$API_PORT"
free_port "$PLAYER_PORT"

echo "[start] Starting API Server on http://127.0.0.1:$API_PORT ..."
"$PYTHON_BIN" scripts/api_server.py &
API_PID=$!

stop_api() {
    if [ -n "$API_PID" ] && kill -0 "$API_PID" 2>/dev/null; then
        echo "[start] Stopping API server (PID $API_PID)..."
        kill -15 "$API_PID" 2>/dev/null || true
        wait "$API_PID" 2>/dev/null || true
    fi
}

trap stop_api EXIT INT TERM

echo "[start] Starting Quiz Player on http://127.0.0.1:$PLAYER_PORT ..."
"$PYTHON_BIN" scripts/quiz_server.py --port "$PLAYER_PORT" --host 127.0.0.1

