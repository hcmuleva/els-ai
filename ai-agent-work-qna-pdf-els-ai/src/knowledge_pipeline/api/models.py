from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class QuestionGenerationRequest(BaseModel):
    class_level: Optional[str] = Field(default=None, max_length=200)
    subject: Optional[str] = Field(default=None, max_length=200)
    topic: Optional[str] = Field(default=None, min_length=1, max_length=200)
    query: str = Field(default="", max_length=1000)
    level_band: Literal[
        "very_easy",
        "easy",
        "moderate",
        "difficult",
        "very_difficult",
    ] = "moderate"
    count: int = Field(default=5, ge=1, le=50)
    source_run_id: Optional[str] = Field(default=None, max_length=200)
    diagram_mode: Literal["auto", "diagram_only"] = "auto"
    question_style: Literal[
        "standard",
        "olympiad",
        "jee",
        "school_exam",
        "conceptual",
    ] = "standard"
    generation_profile: Literal["standard", "jee_geometry_complex"] = "standard"
    diagram_families: List[
        Literal[
            "triangle-geometry",
            "circle-geometry",
            "solid-geometry",
            "geometry",
            "triangle",
            "right-triangle",
            "circle",
            "angle",
            "function",
            "function-region",
            "coordinate",
            "mensuration",
            "lpp",
            "bar-chart",
            "pie-chart",
            "pictogram",
            "inclined-plane",
            "projectile",
            "convex-lens",
            "magnetic-flux",
            "lr-circuit",
            "current-time",
            "transformer-circuit",
            "coupled-coils",
            "refraction",
            "chemical-reaction",
        ]
    ] = Field(default_factory=list, max_length=10)
    persist: bool = False
    max_attempts: int = Field(default=5, ge=1, le=5)
