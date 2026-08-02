"""HTTP API for document ingestion and validated question generation."""

from .app import create_app

__all__ = ["create_app"]
