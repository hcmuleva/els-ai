#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PY="${PYTHON:-python3}"
cd "$ROOT"
exec "$PY" -m scripts.generate "$@"
