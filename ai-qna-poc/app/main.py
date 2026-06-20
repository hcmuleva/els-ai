from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.config import settings
from app.pipeline import run
from app.schemas import (
    ClassLevel,
    Difficulty,
    GenerateRequest,
    GenerateResponse,
    Subject,
)

app = FastAPI(
    title="ai-qna-poc",
    version=__version__,
    description=(
        "Generate book-format (markdown + LaTeX) PCM/Biology questions from CBSE "
        "papers. Pipeline: Retriever -> Parser -> Generator -> Validator."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "ai-qna-poc",
        "version": __version__,
        "pdf_source_mode": settings.pdf_source_mode,
        "generation_provider": settings.generation_provider,
    }


@app.get("/options")
def options():
    """Selector values the client UI can render."""
    return {
        "class_level": [c.value for c in ClassLevel],
        "subject": [s.value for s in Subject],
        "difficulty": [d.value for d in Difficulty],
        "types": ["sc", "mcq", "tf"],
        "count": {"min": 1, "max": 30, "default": 10},
    }


@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest) -> GenerateResponse:
    return run(req)
