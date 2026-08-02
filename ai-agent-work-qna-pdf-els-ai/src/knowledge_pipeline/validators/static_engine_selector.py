"""Static-only renderer selection for detected STEM concepts."""
from __future__ import annotations

import importlib.util
import shutil
from typing import Any

from .common import ConceptMatch

CONCEPT_ENGINE_MAP = {
    "free_body_incline": ("pyfreebody", "tikz", "deterministic_svg"),
    "lr_current_growth": ("pgfplots", "circuitikz", "deterministic_svg"),
    "transformer_ac_load": ("circuitikz", "deterministic_svg"),
    "magnetic_flux_loop": ("tikz", "deterministic_svg"),
    "mutual_induction": ("circuitikz", "tikz", "deterministic_svg"),
    "optics_refraction": ("tikz", "deterministic_svg"),
    "mathematical_function_plot": (
        "pgfplots",
        "matplotlib",
        "deterministic_svg",
    ),
    "chemical_reaction": ("mhchem", "deterministic_svg"),
    "molecular_structure": ("chemfig", "deterministic_svg"),
}


def _available(engine: str) -> bool:
    if engine == "deterministic_svg":
        return True
    if engine == "pyfreebody":
        return importlib.util.find_spec("pyfreebody") is not None
    if engine == "matplotlib":
        return importlib.util.find_spec("matplotlib") is not None
    if engine in {"tikz", "pgfplots", "circuitikz", "mhchem", "chemfig"}:
        return bool(shutil.which("pdflatex") or shutil.which("lualatex"))
    return False


def select_static_engine(concept: ConceptMatch) -> dict[str, Any]:
    candidates = CONCEPT_ENGINE_MAP.get(
        concept.concept, ("deterministic_svg",)
    )
    return {
        "selected_static_engine": "deterministic_svg",
        "recommended_export_engine": candidates[0],
        "preferred_engines": list(candidates),
        "available_engines": [
            engine for engine in candidates if _available(engine)
        ],
        "animations_allowed": False,
    }
