#!/usr/bin/env bash
# Convenience launcher for ai-qna-poc.
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  echo "Creating virtualenv..."
  python3 -m venv .venv
fi

./.venv/bin/python -m pip install --quiet --upgrade pip
./.venv/bin/python -m pip install --quiet -r requirements.txt

PORT="${PORT:-4500}"
echo "Starting ai-qna-poc on http://localhost:${PORT}"
exec ./.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT}" --reload
