#!/usr/bin/env bash
# Quick helper to chunk and embed all PDFs in a folder from scraper
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET_DIR="${1:-$SCRIPT_DIR/downloads}"

"$REPO_ROOT/embed_folder.sh" "$TARGET_DIR"
