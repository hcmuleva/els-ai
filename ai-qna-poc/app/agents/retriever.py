"""Retriever agent.

Locates a CBSE paper PDF for the requested class + subject from the Hugging
Face dataset and downloads its bytes. Falls back to a bundled sample corpus
when configured or when the network is unavailable.
"""
from __future__ import annotations

import random
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

import httpx

from app.config import settings

_TREE_API = "https://huggingface.co/api/datasets/{ds}/tree/main/{path}"
_RESOLVE = "https://huggingface.co/datasets/{ds}/resolve/main/{path}"

_SUBJECT_SYNONYMS = {
    "physics": ["physics"],
    "chemistry": ["chemistry"],
    "mathematics": ["mathematics", "maths", "math"],
    "biology": ["biology"],
}
# Class 10 frequently stores PCM/B under "Science".
_CLASS10_FALLBACK = ["science"]

# Top-level year buckets in the dataset (a request shuffles these so different
# calls can draw from different papers).
_YEARS = ["2025", "2024", "2023", "2022", "2020", "2019", "2018", "2017",
          "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009"]

# Recursion / pool limits when crawling a subject subtree for PDFs.
_MAX_DEPTH = 3
_MAX_TRIES = 6  # candidate PDFs to attempt before giving up on a year

_SAMPLE_DIR = Path(__file__).resolve().parent.parent / "data" / "sample_corpus"


@dataclass
class RetrievedSource:
    mode: str  # live | sample
    dataset: Optional[str] = None
    pdf_path: Optional[str] = None
    pdf_url: Optional[str] = None
    pdf_bytes: Optional[bytes] = None
    sample_text: Optional[str] = None
    note: Optional[str] = None


def _subject_keys(class_level: str, subject: str) -> List[str]:
    keys = list(_SUBJECT_SYNONYMS.get(subject, [subject]))
    if class_level == "10":
        keys += _CLASS10_FALLBACK
    return keys


def _get_json(client: httpx.Client, path: str):
    url = _TREE_API.format(ds=settings.hf_dataset, path=path)
    resp = client.get(url)
    if resp.status_code != 200:
        return None
    return resp.json()


def _collect_pdfs(client: httpx.Client, path: str, syns: List[str], depth: int) -> List[str]:
    """Recursively gather .pdf paths under ``path``.

    Returns the PDFs from the first directory that has any, preferring
    subdirectories whose name matches a subject synonym (the dataset nests the
    real papers under e.g. ``PHYSICS/PHYSICS`` or ``physics.zip_extracted``,
    sometimes alongside unrelated subjects).
    """
    listing = _get_json(client, path)
    if not listing:
        return []

    pdfs: List[str] = []
    matching_dirs: List[str] = []
    other_dirs: List[str] = []
    for entry in listing:
        epath = entry.get("path", "")
        name = epath.split("/")[-1].strip().lower()
        if entry.get("type") == "file" and epath.lower().endswith(".pdf"):
            pdfs.append(epath)
        elif entry.get("type") == "directory":
            (matching_dirs if any(s in name for s in syns) else other_dirs).append(epath)

    if pdfs:
        return pdfs
    if depth <= 0:
        return []
    for sub in matching_dirs + other_dirs:
        found = _collect_pdfs(client, sub, syns, depth - 1)
        if found:
            return found
    return []


def _find_live_pdf(
    client: httpx.Client, class_level: str, subject: str, rng: random.Random
) -> Optional[RetrievedSource]:
    class_folder = f"Class_{class_level}"
    syns = _subject_keys(class_level, subject)

    years = _YEARS[:]
    rng.shuffle(years)  # randomize which paper a request draws from
    for year in years:
        listing = _get_json(client, f"{year}/{class_folder}")
        if not listing:
            continue
        # find a subject directory by case-insensitive synonym match
        subject_dir = None
        for entry in listing:
            if entry.get("type") != "directory":
                continue
            name = entry["path"].split("/")[-1].strip().lower()
            if any(syn in name for syn in syns):
                subject_dir = entry["path"]
                break
        if not subject_dir:
            continue

        pdfs = _collect_pdfs(client, subject_dir, syns, _MAX_DEPTH)
        if not pdfs:
            continue
        rng.shuffle(pdfs)
        for pdf_path in pdfs[:_MAX_TRIES]:
            pdf_url = _RESOLVE.format(ds=settings.hf_dataset, path=pdf_path)
            blob = client.get(pdf_url, follow_redirects=True)
            if blob.status_code == 200 and blob.content[:4] == b"%PDF":
                return RetrievedSource(
                    mode="live",
                    dataset=settings.hf_dataset,
                    pdf_path=pdf_path,
                    pdf_url=pdf_url,
                    pdf_bytes=blob.content,
                )
    return None


def _load_sample(class_level: str, subject: str, note: str) -> RetrievedSource:
    candidates = [
        _SAMPLE_DIR / f"{subject}_class{class_level}.txt",
        _SAMPLE_DIR / f"{subject}.txt",
    ]
    for path in candidates:
        if path.exists():
            return RetrievedSource(mode="sample", sample_text=path.read_text(encoding="utf-8"), note=note)
    generic = (
        f"CBSE Class {class_level} {subject} sample paper. "
        f"This is bundled fallback text used because no live PDF was retrieved. "
        f"Topics typically covered in {subject} at this level are assessed below."
    )
    return RetrievedSource(mode="sample", sample_text=generic, note=note + " (generic text)")


def retrieve(class_level: str, subject: str, seed: Optional[int] = None) -> RetrievedSource:
    mode = settings.pdf_source_mode
    # Randomize paper choice per request unless an explicit seed is supplied.
    rng = random.Random(seed) if seed is not None else random.Random()

    if mode in ("live", "both"):
        try:
            with httpx.Client(timeout=settings.hf_timeout_seconds, follow_redirects=True) as client:
                found = _find_live_pdf(client, class_level, subject, rng)
                if found:
                    return found
            if mode == "live":
                return RetrievedSource(mode="live", dataset=settings.hf_dataset,
                                       note="No matching live PDF found for this class/subject.")
        except Exception as exc:  # network / timeout / parse issues
            if mode == "live":
                return RetrievedSource(mode="live", dataset=settings.hf_dataset,
                                       note=f"Live fetch failed: {exc}")
            return _load_sample(class_level, subject, note=f"Live fetch failed, used sample: {exc}")

        # mode == both and nothing found
        return _load_sample(class_level, subject, note="No live PDF matched; used bundled sample.")

    return _load_sample(class_level, subject, note="PDF_SOURCE_MODE=sample")
