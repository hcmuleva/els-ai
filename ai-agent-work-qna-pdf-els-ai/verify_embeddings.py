#!/usr/bin/env python3
"""Embedding & Knowledge Inspection Script

Inspects stored concepts and runs semantic vector search to verify how well
the PDF content has been recognized, chunked, and embedded.

Usage:
    python3 verify_embeddings.py
    python3 verify_embeddings.py "math class 6 fractions"
"""
import sys
from pathlib import Path

# Add src/ to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from knowledge_pipeline.config import PipelineConfig
from knowledge_pipeline.serving.context import DirectRetriever
from knowledge_pipeline.stores import build_relational_store


def verify_knowledge_store(query: str = "algebra and geometry"):
    config = PipelineConfig.load()
    relational = build_relational_store(config.stores.postgres_dsn)
    retriever = DirectRetriever(config)

    print("==========================================================")
    print("📊 KNOWLEDGE PIPELINE DATABASE INSPECTION REPORT")
    print("==========================================================")

    # 1. Inspect Classes
    try:
        classes = relational.catalog_classes()
        print(f"\n🏷️  Available Classes ({len(classes)} found):")
        for item in classes:
            print(f"   • Class Level: {item.get('class_level')} | Subjects: {item.get('subject_count')} | Topics: {item.get('topic_count')} | Chunks: {item.get('chunk_count')}")
    except Exception as exc:
        print(f"   ⚠️ Could not fetch classes: {exc}")

    # 2. Inspect Subjects & Topics
    try:
        topics = relational.catalog_topics(limit=10)
        print(f"\n📚 Sample Topics ({len(topics)} retrieved):")
        for item in topics[:8]:
            print(f"   • Topic: '{item.get('topic')}' (Subject: {item.get('subject')}) | Concepts: {item.get('concept_count')} | Chunks: {item.get('chunk_count')}")
    except Exception as exc:
        print(f"   ⚠️ Could not fetch topics: {exc}")

    # 3. Vector Similarity Search Test
    print(f"\n🔍 Testing Vector Search for Query: '{query}'")
    print("----------------------------------------------------------")
    try:
        hits = retriever.vector_search(query, top_k=5)
        if not hits:
            print("⚠️ No vector search results returned for this query.")
        else:
            for idx, hit in enumerate(hits, start=1):
                payload = hit.get("payload", {})
                score = hit.get("score", 0.0)
                topic = payload.get("topic", "N/A")
                content = payload.get("content", "")[:250].replace("\n", " ")
                chunk_id = payload.get("chunk_id", "N/A")
                print(f"[{idx}] Similarity Score: {score:.4f}")
                print(f"    Topic:    {topic}")
                print(f"    Chunk ID: {chunk_id}")
                print(f"    Snippet:  {content}...")
                print()
    except Exception as exc:
        print(f"   ❌ Vector search error: {exc}")

    print("==========================================================")
    print("💡 To test question generation against these embeddings, open:")
    print("   Web Admin UI: http://127.0.0.1:8000/")
    print("==========================================================")


if __name__ == "__main__":
    search_query = sys.argv[1] if len(sys.argv) > 1 else "math geometry reasoning"
    verify_knowledge_store(search_query)
