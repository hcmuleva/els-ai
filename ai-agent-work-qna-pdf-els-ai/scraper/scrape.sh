#!/usr/bin/env bash
# Quick launcher script to scrape PDFs from a URL
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "$SCRIPT_DIR/scrape_pdfs.py" "$@"
