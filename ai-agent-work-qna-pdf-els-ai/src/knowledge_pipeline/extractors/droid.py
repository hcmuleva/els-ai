"""Droid-backed extractor: uses `droid exec` headlessly as the LLM.

This is the default LLM for the project. Each call writes the prompt to a temp
file and runs `droid exec` in read-only autonomy, then parses strict JSON from
stdout. On any failure it delegates to the heuristic extractor.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import tempfile

from ..config import PipelineConfig
from . import prompts
from .prompt_base import PromptExtractor

_JSON_ONLY = "\n\nRespond with ONLY a single valid JSON object. No prose, no markdown fences."


def run_droid(
    prompt: str,
    cli: str = "droid",
    autonomy: str = "low",
    model: str | None = None,
    timeout: int = 240,
    cwd: str | None = None,
) -> str:
    """Run `droid exec` headlessly and return stdout. Reusable by the serving plane."""
    resolved = shutil.which(cli) or cli
    fd, path = tempfile.mkstemp(suffix=".txt", prefix="kp_droid_")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(prompt)
        cmd = [resolved, "exec", "-o", "text", "--auto", autonomy, "-f", path]
        if model:
            cmd += ["-m", model]
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            cwd=cwd,
        )
        if proc.returncode != 0:
            raise RuntimeError(f"droid exec failed ({proc.returncode}): {proc.stderr[:500]}")
        return proc.stdout
    finally:
        try:
            os.remove(path)
        except OSError:
            pass


class DroidExtractor(PromptExtractor):
    def __init__(self, config: PipelineConfig) -> None:
        super().__init__()
        self.config = config
        self.name = "droid"
        self.cli = shutil.which(config.droid_cli_path) or config.droid_cli_path
        self.model = config.droid_model
        self.autonomy = config.droid_autonomy
        self.timeout = config.droid_timeout_s

    @staticmethod
    def available(cli_path: str = "droid") -> bool:
        return shutil.which(cli_path) is not None

    def _complete(self, user_prompt: str) -> str:
        combined = f"{prompts.SYSTEM}\n\n{user_prompt}{_JSON_ONLY}"
        return run_droid(
            combined,
            cli=self.cli,
            autonomy=self.autonomy,
            model=self.model,
            timeout=self.timeout,
            cwd=str(self.config.base_dir),
        )
