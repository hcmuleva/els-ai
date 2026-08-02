"""Persistent background jobs for uploaded document ingestion."""
from __future__ import annotations

import json
import os
import queue
import re
import subprocess
import sys
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..config import PipelineConfig

_ROOT = Path(__file__).resolve().parents[3]
_ALLOWED_SUFFIXES = {".pdf", ".txt", ".md", ".markdown"}
_MAX_LOG_CHARS = 50_000
_JOB_TIMEOUT_SECONDS = 24 * 60 * 60
_PROGRESS_MARKERS = (
    ("[ingest] source=", 2, "starting", "Starting ingestion"),
    ("[ output]", 4, "initializing", "Creating immutable run"),
    ("[  setup]", 6, "initializing", "Configuring extraction provider"),
    ("[ ingest]", 10, "extracting", "Reading source pages"),
    ("[ phase0]", 15, "validating_document", "Validating document integrity"),
    ("[ phase1]", 22, "discovering", "Discovering chapters and topics"),
    ("[phase2-3]", 32, "cleaning", "Scoring and cleaning pages"),
    ("[ phase4]", 42, "distilling", "Distilling knowledge units"),
    ("[ phase5]", 48, "extracting_concepts", "Extracting concepts"),
    ("[phase11]", 55, "validating_concepts", "Validating concepts"),
    ("[phase6-7]", 62, "enriching", "Generating learning metadata"),
    ("[phase8-9]", 68, "building_graph", "Building the knowledge graph"),
    ("[phase9.5]", 72, "validating_graph", "Validating graph structure"),
    ("[ phaseL]", 78, "calibrating", "Calibrating difficulty levels"),
    ("[ phaseC]", 80, "composing", "Assembling composite concepts"),
    ("[phase12-13]", 84, "chunking", "Building retrieval chunks"),
    ("[phase15]", 88, "generating", "Generating assessment items"),
    ("[phase14]", 91, "writing", "Writing run artifacts"),
    ("[ingest] analysis complete", 92, "validating_chunks", "Validating chunk quality"),
    ("[ingest] chunk quality", 94, "validating_retrieval", "Validating retrieval"),
    ("[ingest] semantic retrieval", 96, "loading_stores", "Loading data stores"),
    ("[load] init relational", 97, "loading_postgres", "Loading PostgreSQL"),
    ("[load] Postgres", 98, "loading_qdrant", "Preparing vector store"),
    ("[load] Qdrant upserted", 99, "finalizing", "Finalizing ingestion"),
    ("[load] done", 100, "completed", "Ingestion completed"),
)
_RETRIEVAL_RESULT_RE = re.compile(
    r"\[retrieval\] accepted (?P<accepted>\d+)/(?P<total>\d+) concepts "
    r"and approved (?P<chunks>\d+)/(?P<total_chunks>\d+) chunks; "
    r"status=(?P<status>[a-z]+)"
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _progress_for_line(line: str) -> tuple[int, str, str] | None:
    for marker, percent, stage, label in _PROGRESS_MARKERS:
        if marker in line:
            return percent, stage, label
    return None


class IngestionJobManager:
    def __init__(
        self,
        config: PipelineConfig,
        upload_root: Path | None = None,
        jobs_root: Path | None = None,
    ) -> None:
        self.config = config
        self.upload_root = upload_root or (_ROOT / "data" / "uploads")
        self.jobs_root = jobs_root or (_ROOT / "data" / "api-jobs")
        self.upload_root.mkdir(parents=True, exist_ok=True)
        self.jobs_root.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._jobs: dict[str, dict[str, Any]] = {}
        self._load_existing()

    def create(self, filename: str, content: bytes) -> dict[str, Any]:
        suffix = Path(filename).suffix.lower()
        if suffix not in _ALLOWED_SUFFIXES:
            raise ValueError("file must be PDF, TXT, MD, or Markdown")
        if not content:
            raise ValueError("uploaded file is empty")
        job_id = f"ingest-{uuid.uuid4().hex[:16]}"
        upload_dir = self.upload_root / job_id
        upload_dir.mkdir()
        source = upload_dir / f"source{suffix}"
        source.write_bytes(content)
        run_id = f"document-{uuid.uuid4().hex[:16]}"
        job = {
            "job_id": job_id,
            "type": "document_ingestion",
            "status": "queued",
            "filename": Path(filename).name,
            "source_path": str(source),
            "run_id": run_id,
            "output_dir": str(self.config.output_dir / run_id),
            "provider": self.config.resolved_provider(),
            "created_at": _now(),
            "started_at": None,
            "finished_at": None,
            "error": None,
            "log_tail": "",
            "progress_percent": 0,
            "stage": "queued",
            "stage_label": "Waiting to start",
            "last_message": "",
            "updated_at": _now(),
        }
        self._save(job)
        threading.Thread(
            target=self._run,
            args=(job_id,),
            daemon=True,
            name=f"kp-{job_id}",
        ).start()
        return self.get(job_id)

    def get(self, job_id: str) -> dict[str, Any]:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                raise KeyError(job_id)
            return dict(job)

    def _load_existing(self) -> None:
        for path in self.jobs_root.glob("*.json"):
            try:
                job = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                continue
            if job.get("status") in {"queued", "running"}:
                job["status"] = "interrupted"
                job["finished_at"] = _now()
                job["error"] = "API process stopped before the ingestion job completed."
            status = job.get("status")
            if status == "completed":
                job.setdefault("progress_percent", 100)
                job.setdefault("stage", "completed")
                job.setdefault("stage_label", "Ingestion completed")
            else:
                job.setdefault("progress_percent", 0)
                job.setdefault("stage", status or "unknown")
                job.setdefault("stage_label", str(status or "Unknown").title())
            job.setdefault("last_message", "")
            job.setdefault("updated_at", job.get("finished_at") or job.get("created_at") or _now())
            if job.get("job_id"):
                self._jobs[job["job_id"]] = job

    def _save(self, job: dict[str, Any]) -> None:
        path = self.jobs_root / f"{job['job_id']}.json"
        temporary = path.with_suffix(".json.tmp")
        with self._lock:
            self._jobs[job["job_id"]] = dict(job)
            temporary.write_text(
                json.dumps(job, indent=2, ensure_ascii=False), encoding="utf-8"
            )
            temporary.replace(path)

    def _run(self, job_id: str) -> None:
        job = self.get(job_id)
        job["status"] = "running"
        job["started_at"] = _now()
        job["stage"] = "starting"
        job["stage_label"] = "Starting ingestion"
        job["progress_percent"] = max(1, int(job.get("progress_percent", 0)))
        job["updated_at"] = _now()
        self._save(job)
        command = [
            sys.executable,
            "-u",
            str(_ROOT / "scripts" / "ingest_pdf.py"),
            job["source_path"],
            "--output-dir",
            str(self.config.output_dir),
            "--run-id",
            job["run_id"],
            "--provider",
            job["provider"],
        ]
        try:
            process = subprocess.Popen(
                command,
                cwd=_ROOT,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
                env={**os.environ, "PYTHONUNBUFFERED": "1"},
            )
            self._stream_output(job, process)
            return_code = process.wait()
            if return_code == 0:
                job["status"] = "completed"
                job["stage"] = "completed"
                job["stage_label"] = (
                    "Completed with invalid concepts excluded"
                    if job.get("validation_status") == "partial"
                    else "Ingestion completed"
                )
                job["progress_percent"] = 100
            else:
                job["status"] = "failed"
                job["stage"] = "failed"
                job["stage_label"] = "Ingestion failed"
                job["error"] = f"Ingestion exited with code {return_code}."
        except subprocess.TimeoutExpired:
            job["status"] = "failed"
            job["stage"] = "failed"
            job["stage_label"] = "Ingestion timed out"
            job["error"] = "Ingestion exceeded the 24-hour timeout."
        except Exception as exc:
            job["status"] = "failed"
            job["stage"] = "failed"
            job["stage_label"] = "Ingestion failed"
            job["error"] = str(exc)
        job["finished_at"] = _now()
        job["updated_at"] = job["finished_at"]
        self._save(job)

    def _stream_output(
        self,
        job: dict[str, Any],
        process: subprocess.Popen[str],
    ) -> None:
        output_queue: queue.Queue[str | None] = queue.Queue()

        def read_output() -> None:
            if process.stdout is not None:
                for line in process.stdout:
                    output_queue.put(line)
            output_queue.put(None)

        reader = threading.Thread(target=read_output, daemon=True)
        reader.start()
        deadline = time.monotonic() + _JOB_TIMEOUT_SECONDS
        while True:
            if time.monotonic() >= deadline:
                process.kill()
                raise subprocess.TimeoutExpired(process.args, _JOB_TIMEOUT_SECONDS)
            try:
                line = output_queue.get(timeout=0.5)
            except queue.Empty:
                if process.poll() is not None and not reader.is_alive():
                    break
                continue
            if line is None:
                break
            self._record_output(job, line)
        reader.join(timeout=1)

    def _record_output(self, job: dict[str, Any], line: str) -> None:
        clean = line.rstrip()
        if not clean:
            return
        job["log_tail"] = f"{job.get('log_tail', '')}\n{clean}".lstrip()[-_MAX_LOG_CHARS:]
        job["last_message"] = clean
        retrieval_result = _RETRIEVAL_RESULT_RE.search(clean)
        if retrieval_result:
            accepted = int(retrieval_result.group("accepted"))
            total = int(retrieval_result.group("total"))
            job["validation_status"] = retrieval_result.group("status")
            job["accepted_concepts"] = accepted
            job["rejected_concepts"] = total - accepted
            job["approved_chunks"] = int(retrieval_result.group("chunks"))
        progress = _progress_for_line(clean)
        if progress is not None:
            percent, stage, label = progress
            if percent >= int(job.get("progress_percent", 0)):
                job["progress_percent"] = percent
                job["stage"] = stage
                job["stage_label"] = label
        job["updated_at"] = _now()
        self._save(job)
