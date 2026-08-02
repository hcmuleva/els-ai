#!/usr/bin/env bash
set -e

# Repository root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

# Default environment configuration
export KP_PROVIDER="${KP_PROVIDER:-local}"
export KP_LOCAL_LLM_BASE_URL="${KP_LOCAL_LLM_BASE_URL:-http://127.0.0.1:11434/v1}"
export KP_LOCAL_LLM_MODEL="${KP_LOCAL_LLM_MODEL:-qwen3.6:35b}"
export KP_POSTGRES_DSN="${KP_POSTGRES_DSN:-postgresql://kp:kp@127.0.0.1:5544/kp}"
export KP_API_HOST="${KP_API_HOST:-127.0.0.1}"
export KP_API_PORT="${KP_API_PORT:-8000}"

# Find Python binary
if [ -f "$REPO_ROOT/.venv/bin/python" ]; then
    PYTHON_BIN="$REPO_ROOT/.venv/bin/python"
else
    PYTHON_BIN="python3"
fi

echo "=========================================================="
echo "🚀 Starting Knowledge Pipeline Question Service"
echo "   Provider:   $KP_PROVIDER"
echo "   LLM Model:  $KP_LOCAL_LLM_MODEL ($KP_LOCAL_LLM_BASE_URL)"
echo "   Database:   $KP_POSTGRES_DSN"
echo "   API Server: http://$KP_API_HOST:$KP_API_PORT"
echo "   Quiz UI:    http://$KP_API_HOST:$KP_API_PORT/player"
echo "   API Docs:   http://$KP_API_HOST:$KP_API_PORT/docs"
echo "=========================================================="

exec "$PYTHON_BIN" scripts/api_server.py "$@"
