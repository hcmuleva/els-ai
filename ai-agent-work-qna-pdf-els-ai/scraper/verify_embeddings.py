#!/usr/bin/env python3
"""Wrapper script to run verify_embeddings.py from inside the scraper directory."""
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from verify_embeddings import verify_knowledge_store

if __name__ == "__main__":
    search_query = sys.argv[1] if len(sys.argv) > 1 else "math geometry reasoning"
    verify_knowledge_store(search_query)
