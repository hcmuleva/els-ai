"""Helpers for book-format markdown (markdown + LaTeX math).

Inline math uses ``$...$`` and display math uses ``$$...$$``. These helpers let
the validator confirm the output will render cleanly in a markdown + KaTeX /
MathJax renderer on the client.
"""
from __future__ import annotations

import re

_DISPLAY = re.compile(r"\$\$.*?\$\$", re.DOTALL)


def math_delimiters_balanced(md: str) -> bool:
    """Return True if ``$$`` blocks are paired and remaining ``$`` are even."""
    if md.count("$$") % 2 != 0:
        return False
    without_display = _DISPLAY.sub("", md)
    return without_display.count("$") % 2 == 0


def has_math(md: str) -> bool:
    return "$" in md
