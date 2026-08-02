"""FastAPI application for upload, ingestion status, and RAG questions."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from ..config import PipelineConfig
from ..serving.openai_compatible import OpenAICompatibleClient
from ..serving.question_service import (
    QuestionGenerationError,
    QuestionGenerationService,
)
from ..stores import build_relational_store
from .jobs import IngestionJobManager
from .models import QuestionGenerationRequest

_ROOT = Path(__file__).resolve().parents[3]


def create_app(
    config: PipelineConfig | None = None,
    job_manager: IngestionJobManager | None = None,
    question_service: QuestionGenerationService | None = None,
    catalog_store: Any | None = None,
) -> FastAPI:
    cfg = config or PipelineConfig.load()
    jobs = job_manager or IngestionJobManager(cfg)
    questions = question_service or QuestionGenerationService(cfg)
    catalog = catalog_store or build_relational_store(cfg.stores.postgres_dsn)
    max_upload_bytes = int(os.getenv("KP_API_MAX_UPLOAD_MB", "200")) * 1024 * 1024

    app = FastAPI(
        title="Knowledge Pipeline API",
        version="1.0.0",
        description=(
            "Upload educational documents, run validated ingestion, and generate "
            "source-grounded question JSON from Qdrant."
        ),
    )
    from fastapi.middleware.cors import CORSMiddleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    gallery_dir = _ROOT / "web" / "generated" / "diagram-gallery"
    vendor_dir = _ROOT / "web" / "vendor"
    assets_dir = _ROOT / "web" / "assets"
    if vendor_dir.exists():
        app.mount(
            "/vendor",
            StaticFiles(directory=vendor_dir),
            name="vendor",
        )
    if assets_dir.exists():
        app.mount(
            "/assets",
            StaticFiles(directory=assets_dir),
            name="assets",
        )
    if gallery_dir.exists():
        app.mount(
            "/diagram-assets",
            StaticFiles(directory=gallery_dir),
            name="diagram-assets",
        )

    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    def index() -> HTMLResponse:
        path = _ROOT / "web" / "pipeline_admin.html"
        if not path.exists():
            return HTMLResponse("<h1>Knowledge Pipeline API</h1><p>Open <a href='/docs'>/docs</a>.</p>")
        return HTMLResponse(path.read_text(encoding="utf-8"))

    @app.get("/player", response_class=HTMLResponse, include_in_schema=False)
    def question_player() -> HTMLResponse:
        path = _ROOT / "web" / "question_player.html"
        if not path.exists():
            raise HTTPException(status_code=404, detail="Question player not found.")
        return HTMLResponse(
            path.read_text(encoding="utf-8"),
            headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
        )

    @app.get("/diagrams", response_class=HTMLResponse, include_in_schema=False)
    def diagram_gallery() -> HTMLResponse:
        path = gallery_dir / "index.html"
        if not path.exists():
            raise HTTPException(
                status_code=404,
                detail="Generate the gallery with scripts/generate_diagram_gallery.py.",
            )
        return HTMLResponse(path.read_text(encoding="utf-8"))

    @app.get("/api/health")
    def health() -> dict[str, Any]:
        provider = cfg.resolved_provider()
        llm_status: dict[str, Any] = {"reachable": None}
        if provider == "local":
            try:
                local = OpenAICompatibleClient(
                    base_url=cfg.local_llm_base_url,
                    model=cfg.local_llm_model,
                    api_key=cfg.local_llm_api_key,
                    timeout_s=min(cfg.local_llm_timeout_s, 5),
                )
                models = local.models()
                llm_status = {
                    "reachable": True,
                    "configured_model": cfg.local_llm_model,
                    "available_models": models,
                    "model_available": cfg.local_llm_model in models,
                    "base_url": cfg.local_llm_base_url,
                }
            except Exception as exc:
                llm_status = {
                    "reachable": False,
                    "configured_model": cfg.local_llm_model,
                    "base_url": cfg.local_llm_base_url,
                    "error": str(exc),
                }
        return {
            "status": "ok",
            "provider": provider,
            "llm": llm_status,
            "qdrant": {
                "url": cfg.stores.qdrant_url,
                "collection": cfg.stores.qdrant_collection,
            },
            "relational_backend": cfg.stores.postgres_dsn.split(":", 1)[0],
        }

    @app.post("/api/documents", status_code=202)
    async def upload_document(file: UploadFile = File(...)) -> dict[str, Any]:
        if not file.filename:
            raise HTTPException(status_code=400, detail="A filename is required.")
        content = await file.read(max_upload_bytes + 1)
        await file.close()
        if len(content) > max_upload_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"Upload exceeds the {max_upload_bytes // (1024 * 1024)} MB limit.",
            )
        try:
            return jobs.create(file.filename, content)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.get("/api/jobs/{job_id}")
    def job_status(job_id: str) -> dict[str, Any]:
        try:
            return jobs.get(job_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Job not found.") from exc

    @app.get("/api/catalog/classes")
    def catalog_classes(
        source_run_id: str | None = Query(default=None, max_length=200),
    ) -> dict[str, Any]:
        try:
            items = catalog.catalog_classes(source_run_id=source_run_id)
        except Exception as exc:
            raise HTTPException(
                status_code=503, detail=f"Embedded-content catalog unavailable: {exc}"
            ) from exc
        return {"count": len(items), "items": items}

    @app.get("/api/catalog/subjects")
    def catalog_subjects(
        class_level: str | None = Query(default=None, max_length=200),
        query: str = Query(default="", max_length=200),
        source_run_id: str | None = Query(default=None, max_length=200),
    ) -> dict[str, Any]:
        try:
            items = catalog.catalog_subjects(
                class_level=class_level,
                query=query.strip() or None,
                source_run_id=source_run_id,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=503, detail=f"Embedded-content catalog unavailable: {exc}"
            ) from exc
        return {"count": len(items), "items": items}

    @app.get("/api/catalog/topics")
    def catalog_topics(
        class_level: str | None = Query(default=None, max_length=200),
        subject: str | None = Query(default=None, max_length=200),
        query: str = Query(default="", max_length=200),
        source_run_id: str | None = Query(default=None, max_length=200),
        limit: int = Query(default=500, ge=1, le=1000),
    ) -> dict[str, Any]:
        try:
            items = catalog.catalog_topics(
                class_level=class_level,
                subject=subject,
                query=query.strip() or None,
                source_run_id=source_run_id,
                limit=limit,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=503, detail=f"Embedded-content catalog unavailable: {exc}"
            ) from exc
        return {"count": len(items), "items": items}

    @app.get("/api/player/subjects")
    def player_subjects() -> dict[str, Any]:
        try:
            items = catalog.quiz_subjects()
        except Exception as exc:
            raise HTTPException(
                status_code=503, detail=f"Persisted quiz catalog unavailable: {exc}"
            ) from exc
        return {"count": len(items), "items": items}

    @app.get("/api/player")
    def player_questions(
        subject: str | None = Query(default=None, max_length=200),
        limit: int = Query(default=1000, ge=1, le=1000),
    ) -> dict[str, Any]:
        try:
            return catalog.load_player_quiz(subject=subject, limit=limit)
        except Exception as exc:
            raise HTTPException(
                status_code=503, detail=f"Persisted questions unavailable: {exc}"
            ) from exc

    @app.post("/api/questions")
    def generate_questions(request: QuestionGenerationRequest) -> dict[str, Any]:
        try:
            return questions.generate(**request.model_dump())
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except QuestionGenerationError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=500, detail=f"Question generation failed: {exc}"
            ) from exc

    return app


app = create_app()
