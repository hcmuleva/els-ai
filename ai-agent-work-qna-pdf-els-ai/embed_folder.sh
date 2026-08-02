#!/usr/bin/env bash
# PDF Folder Chunking & Embedding Script
# Usage:
#   ./embed_folder.sh scraper/downloads
#   ./embed_folder.sh /path/to/your/pdf_folder

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${1:-scraper/downloads}"

if [ ! -d "$TARGET_DIR" ]; then
  echo "❌ Error: Folder '$TARGET_DIR' does not exist."
  echo "Usage: ./embed_folder.sh <path_to_pdf_folder>"
  exit 1
fi

echo "🚀 Starting Chunking & Embedding Pipeline for folder: '$TARGET_DIR'"
echo "   Provider: Local LLM (qwen3.6:35b)"
echo "   Output:   data/output/runs/"
echo ""

# Run pipeline extraction, semantic chunking, and embedding preparation
PYTHONPATH="$REPO_ROOT/src" python3 -m knowledge_pipeline.cli \
  --input "$TARGET_DIR" \
  --provider local \
  --no-generate

LATEST_RUN_DIR="$(ls -td "$REPO_ROOT/data/output/runs"/* | head -n 1)"

echo ""
echo "📦 Syncing extracted concepts and chunk vectors into database & vector store..."
PYTHONPATH="$REPO_ROOT/src" python3 "$REPO_ROOT/scripts/load_stores.py" \
  --output-dir "$LATEST_RUN_DIR" \
  --chunks-file chunk_repository.json \
  --allow-unvalidated

echo ""
echo "🎉 Finished! All PDFs in '$TARGET_DIR' have been chunked, indexed, and embedded into PostgreSQL & Vector Store."
