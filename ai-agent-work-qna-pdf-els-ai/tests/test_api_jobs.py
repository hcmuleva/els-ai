import io
from pathlib import Path

from knowledge_pipeline.api import jobs as jobs_module
from knowledge_pipeline.api.jobs import IngestionJobManager, _progress_for_line
from knowledge_pipeline.config import PipelineConfig


class _Process:
    def __init__(self, lines: str, return_code: int = 0) -> None:
        self.stdout = io.StringIO(lines)
        self.return_code = return_code
        self.args = ["ingest_pdf.py"]

    def poll(self):
        return None

    def wait(self):
        return self.return_code

    def kill(self):
        return None


def _manager(tmp_path: Path) -> IngestionJobManager:
    config = PipelineConfig(provider="mock")
    config.output_dir = tmp_path / "runs"
    return IngestionJobManager(
        config,
        upload_root=tmp_path / "uploads",
        jobs_root=tmp_path / "jobs",
    )


def test_progress_markers_map_pipeline_phases():
    assert _progress_for_line("[ phase4] 3 distilled knowledge units") == (
        42,
        "distilling",
        "Distilling knowledge units",
    )
    assert _progress_for_line("[load] done.") == (
        100,
        "completed",
        "Ingestion completed",
    )
    assert _progress_for_line("ordinary diagnostic output") is None


def test_job_streams_logs_and_progress(tmp_path, monkeypatch):
    manager = _manager(tmp_path)
    source = manager.upload_root / "source.md"
    source.write_text("# Test", encoding="utf-8")
    job_id = "ingest-stream-test"
    manager._save(
        {
            "job_id": job_id,
            "status": "queued",
            "source_path": str(source),
            "run_id": "document-test",
            "provider": "mock",
            "progress_percent": 0,
            "log_tail": "",
        }
    )
    output = "\n".join(
        [
            "[ingest] source=source.md",
            "[ phase4] 3 distilled knowledge units",
            "[phase14] wrote 26 files",
            "[retrieval] accepted 2/3 concepts and approved 8/10 chunks; status=partial",
            "[load] Qdrant upserted 3 points",
            "[load] done.",
        ]
    )
    monkeypatch.setattr(
        jobs_module.subprocess,
        "Popen",
        lambda *_args, **_kwargs: _Process(output),
    )

    manager._run(job_id)

    job = manager.get(job_id)
    assert job["status"] == "completed"
    assert job["progress_percent"] == 100
    assert job["stage"] == "completed"
    assert job["stage_label"] == "Completed with invalid concepts excluded"
    assert job["accepted_concepts"] == 2
    assert job["rejected_concepts"] == 1
    assert job["approved_chunks"] == 8
    assert "[ phase4] 3 distilled knowledge units" in job["log_tail"]
    assert job["last_message"] == "[load] done."
