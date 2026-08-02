"""Load source books (PDF / TXT / MD) into per-page text and detect chapters."""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path

from .utils import normalize_ws, stable_id

_SUPPORTED = {".pdf", ".txt", ".md", ".markdown"}
_REPO_ROOT = Path(__file__).resolve().parents[2]
_OCR_ENGINE = None
_OCR_DOCUMENT = None
_OCR_BACKEND = ""
_OCR_SCALE = 1.5
_OCR_MIN_CONFIDENCE = 0.45
_CHAPTER_RE = re.compile(
    r"^\s*(chapter|unit|section|module|lesson)\s*([0-9IVXLC]+)\b[:.\s-]*(.*)$",
    re.IGNORECASE,
)
_MD_HEADING_RE = re.compile(r"^\s*#\s+(.*\S)\s*$")
_CHARS_PER_TXT_PAGE = 2500


@dataclass
class RawChapter:
    index: int
    title: str
    page_start: int
    page_end: int


@dataclass
class RawBook:
    book_id: str
    filename: str
    title: str
    pages: list[str] = field(default_factory=list)
    chapters: list[RawChapter] = field(default_factory=list)
    source_path: str = ""
    source_sha256: str = ""
    page_extraction_methods: list[str] = field(default_factory=list)
    page_confidences: list[float] = field(default_factory=list)

    @property
    def num_pages(self) -> int:
        return len(self.pages)

    def sample_text(self, max_chars: int = 6000) -> str:
        buf: list[str] = []
        total = 0
        for page in self.pages:
            buf.append(page)
            total += len(page)
            if total >= max_chars:
                break
        return normalize_ws(" ".join(buf))[:max_chars]

    def chapter_text(self, chapter: RawChapter) -> str:
        return "\n".join(self.pages[chapter.page_start : chapter.page_end + 1])


def load_documents(input_dir: Path) -> list[RawBook]:
    input_dir = Path(input_dir)
    books: list[RawBook] = []
    paths = [input_dir] if input_dir.is_file() else sorted(input_dir.rglob("*"))
    for path in paths:
        if not path.is_file() or path.suffix.lower() not in _SUPPORTED:
            continue
        pages, methods, confidences = _extract_pages(path)
        if not any(p.strip() for p in pages):
            continue
        title = _guess_title(path, pages)
        book = RawBook(
            book_id=stable_id("book", path.name),
            filename=path.name,
            title=title,
            pages=pages,
            source_path=str(path.resolve()),
            source_sha256=_file_sha256(path),
            page_extraction_methods=methods,
            page_confidences=confidences,
        )
        book.chapters = _detect_chapters(pages, title)
        books.append(book)
    return books


def _extract_pages(path: Path) -> tuple[list[str], list[str], list[float]]:
    if path.suffix.lower() == ".pdf":
        return _extract_pdf_pages(path)
    text = path.read_text(encoding="utf-8", errors="ignore")
    pages = _paginate_text(text)
    return pages, ["embedded_text"] * len(pages), [1.0] * len(pages)


def _extract_pdf_pages(path: Path) -> tuple[list[str], list[str], list[float]]:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    pages: list[str] = []
    for page in reader.pages:
        try:
            pages.append(page.extract_text() or "")
        except Exception:
            pages.append("")
    methods = ["embedded_text" if _usable_pdf_text(text) else "unreadable" for text in pages]
    confidences = [1.0 if method == "embedded_text" else 0.0 for method in methods]
    weak_pages = [i for i, text in enumerate(pages) if not _usable_pdf_text(text)]
    if weak_pages:
        ocr_pages = _extract_ocr_pages(path, weak_pages, len(pages))
        for page_no, (text, confidence) in ocr_pages.items():
            if text:
                pages[page_no] = text
                methods[page_no] = "ocr"
                confidences[page_no] = confidence
    return pages, methods, confidences


def _usable_pdf_text(text: str) -> bool:
    clean = normalize_ws(text)
    if len(clean) < 80:
        return False
    visible = [char for char in clean if not char.isspace()]
    if not visible:
        return False
    alphanumeric = sum(char.isalnum() for char in visible)
    return alphanumeric / len(visible) >= 0.45


def _extract_ocr_pages(
    path: Path, page_numbers: list[int], total_pages: int
) -> dict[int, tuple[str, float]]:
    try:
        import fitz  # noqa: F401
    except ImportError as exc:
        raise RuntimeError(
            f"{path.name} has image-only pages. Install PyMuPDF to enable OCR."
        ) from exc

    cache_path = _ocr_cache_path(path)
    cached = _load_ocr_cache(cache_path, path, total_pages)
    extracted = {
        page_no: (
            cached[str(page_no)]["text"],
            float(cached[str(page_no)].get("confidence", 0.0)),
        )
        for page_no in page_numbers
        if str(page_no) in cached and cached[str(page_no)].get("text")
    }
    remaining = [page_no for page_no in page_numbers if page_no not in extracted]
    if not remaining:
        return extracted

    workers = max(1, int(os.getenv("KP_OCR_WORKERS", min(3, os.cpu_count() or 1))))
    scale = float(os.getenv("KP_OCR_SCALE", _OCR_SCALE))
    min_confidence = float(os.getenv("KP_OCR_MIN_CONFIDENCE", _OCR_MIN_CONFIDENCE))
    print(
        f"[ocr] {path.name}: {len(remaining)} image page(s), "
        f"{workers} worker(s), cache={cache_path}"
    )

    completed = 0
    with ProcessPoolExecutor(
        max_workers=workers,
        initializer=_init_ocr_worker,
        initargs=(str(path), scale, min_confidence),
    ) as pool:
        futures = {pool.submit(_ocr_worker_page, page_no): page_no for page_no in remaining}
        for future in as_completed(futures):
            page_no = futures[future]
            text, confidence = future.result()
            cached[str(page_no)] = {"text": text, "confidence": confidence}
            if text:
                extracted[page_no] = (text, confidence)
            completed += 1
            if completed % 10 == 0 or completed == len(remaining):
                _write_ocr_cache(cache_path, path, total_pages, cached)
                print(f"[ocr] {path.name}: {completed}/{len(remaining)} pages complete")
    return extracted


def _init_ocr_worker(path: str, scale: float, min_confidence: float) -> None:
    global _OCR_BACKEND, _OCR_DOCUMENT, _OCR_ENGINE, _OCR_SCALE, _OCR_MIN_CONFIDENCE

    import fitz

    _OCR_DOCUMENT = fitz.open(path)
    _OCR_SCALE = scale
    _OCR_MIN_CONFIDENCE = min_confidence
    tesseract = _find_tesseract()
    requested_backend = os.getenv("KP_OCR_BACKEND", "auto").strip().lower()
    if requested_backend not in {"auto", "tesseract", "rapidocr"}:
        raise ValueError("KP_OCR_BACKEND must be auto, tesseract, or rapidocr")
    if requested_backend != "rapidocr" and tesseract:
        import pytesseract

        pytesseract.pytesseract.tesseract_cmd = tesseract
        _OCR_ENGINE = pytesseract
        _OCR_BACKEND = "tesseract"
        return
    if requested_backend == "tesseract":
        raise RuntimeError("KP_OCR_BACKEND=tesseract but no Tesseract executable was found")

    try:
        from rapidocr_onnxruntime import RapidOCR
    except ImportError as exc:
        raise RuntimeError(
            "No OCR engine is available. Install Tesseract or rapidocr-onnxruntime."
        ) from exc
    _OCR_ENGINE = RapidOCR(intra_op_num_threads=2, inter_op_num_threads=1)
    _OCR_BACKEND = "rapidocr"


def _ocr_worker_page(page_no: int) -> tuple[str, float]:
    import fitz
    import numpy as np

    if _OCR_DOCUMENT is None or _OCR_ENGINE is None:
        raise RuntimeError("OCR worker was not initialized")
    page = _OCR_DOCUMENT[page_no]
    matrix = fitz.Matrix(_OCR_SCALE, _OCR_SCALE)
    pixmap = page.get_pixmap(matrix=matrix, colorspace=fitz.csRGB, alpha=False)
    image = np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(
        pixmap.height, pixmap.width, pixmap.n
    )
    if _OCR_BACKEND == "tesseract":
        return _tesseract_page(image)

    result, _ = _OCR_ENGINE(image, use_cls=False, text_score=_OCR_MIN_CONFIDENCE)
    rows = result or []
    accepted = [row for row in rows if len(row) >= 3 and float(row[2]) >= _OCR_MIN_CONFIDENCE]
    text = "\n".join(str(row[1]).strip() for row in accepted if str(row[1]).strip())
    confidence = (
        sum(float(row[2]) for row in accepted) / len(accepted) if accepted else 0.0
    )
    return text, round(confidence, 4)


def _tesseract_page(image) -> tuple[str, float]:
    from pytesseract import Output

    data = _OCR_ENGINE.image_to_data(
        image,
        config="--oem 3 --psm 3 -c preserve_interword_spaces=1",
        output_type=Output.DICT,
    )
    lines: dict[tuple[int, int, int, int], list[str]] = {}
    confidences: list[float] = []
    for i, raw_text in enumerate(data["text"]):
        text = str(raw_text).strip()
        confidence = float(data["conf"][i])
        if not text or confidence < _OCR_MIN_CONFIDENCE * 100:
            continue
        key = (
            int(data["page_num"][i]),
            int(data["block_num"][i]),
            int(data["par_num"][i]),
            int(data["line_num"][i]),
        )
        lines.setdefault(key, []).append(text)
        confidences.append(confidence / 100)
    text = "\n".join(" ".join(words) for words in lines.values())
    confidence = sum(confidences) / len(confidences) if confidences else 0.0
    return text, round(confidence, 4)


def _find_tesseract() -> str | None:
    configured = os.getenv("KP_TESSERACT_CMD")
    candidates = [
        configured,
        shutil.which("tesseract"),
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return str(candidate)
    return None


def _ocr_cache_path(path: Path) -> Path:
    cache_dir = Path(os.getenv("KP_OCR_CACHE_DIR", _REPO_ROOT / "data" / "ocr_cache"))
    key = hashlib.sha1(str(path.resolve()).encode("utf-8")).hexdigest()[:12]
    return cache_dir / f"{path.stem}-{key}.json"


def _source_signature(path: Path) -> dict[str, int]:
    stat = path.stat()
    return {"size": stat.st_size, "mtime_ns": stat.st_mtime_ns}


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _load_ocr_cache(cache_path: Path, source: Path, total_pages: int) -> dict[str, dict]:
    if not cache_path.exists():
        return {}
    try:
        payload = json.loads(cache_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if (
        payload.get("source") != _source_signature(source)
        or payload.get("total_pages") != total_pages
    ):
        return {}
    pages = payload.get("pages", {})
    return pages if isinstance(pages, dict) else {}


def _write_ocr_cache(
    cache_path: Path,
    source: Path,
    total_pages: int,
    pages: dict[str, dict],
) -> None:
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": _source_signature(source),
        "total_pages": total_pages,
        "pages": pages,
    }
    temporary = cache_path.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    temporary.replace(cache_path)


def _paginate_text(text: str) -> list[str]:
    if "\f" in text:
        return list(text.split("\f"))
    # Start a new page at chapter/heading boundaries, and split oversized blocks.
    lines = text.splitlines()
    pages: list[str] = []
    current: list[str] = []
    size = 0

    def flush() -> None:
        nonlocal current, size
        if current:
            pages.append("\n".join(current))
            current, size = [], 0

    for line in lines:
        is_boundary = bool(_CHAPTER_RE.match(line) or _MD_HEADING_RE.match(line))
        if is_boundary and size > 0:
            flush()
        current.append(line)
        size += len(line) + 1
        if size >= _CHARS_PER_TXT_PAGE:
            flush()
    flush()
    return pages or [text]


def _guess_title(path: Path, pages: list[str]) -> str:
    for page in pages[:2]:
        for line in page.splitlines():
            md = _MD_HEADING_RE.match(line)
            if md:
                return normalize_ws(md.group(1))
            clean = normalize_ws(line)
            if 8 <= len(clean) <= 90 and clean[0].isupper():
                return clean
    return path.stem.replace("_", " ").replace("-", " ").title()


def _detect_chapters(pages: list[str], book_title: str) -> list[RawChapter]:
    chapter_candidates: list[tuple[int, str, str]] = []
    for page_no, page in enumerate(pages):
        lines = page.splitlines()
        matches: list[tuple[int, re.Match[str]]] = []
        for line_index, line in enumerate(lines):
            m = _CHAPTER_RE.match(line)
            if m:
                matches.append((line_index, m))
        if len(matches) == 1:
            line_index, match = matches[0]
            number = match.group(2).upper()
            chapter_candidates.append(
                (page_no, number, _chapter_heading_text(lines, line_index, match))
            )

    title_by_number: dict[str, str] = {}
    for page in pages:
        lines = page.splitlines()
        for line_index, line in enumerate(lines):
            match = _CHAPTER_RE.match(line)
            if not match:
                continue
            number = match.group(2).upper()
            title = _chapter_heading_text(lines, line_index, match)
            if _heading_score(title) > _heading_score(title_by_number.get(number, "")):
                title_by_number[number] = title

    marks = [
        (
            page_no,
            f"Chapter {number}: {title_by_number.get(number, title)}".rstrip(": "),
        )
        for page_no, number, title in chapter_candidates
    ]

    if not marks:
        for page_no, page in enumerate(pages):
            for line in page.splitlines()[:12]:
                md = _MD_HEADING_RE.match(line)
                if md:
                    marks.append((page_no, normalize_ws(md.group(1))))
                    break

    if not marks:
        return [RawChapter(index=1, title=book_title, page_start=0, page_end=len(pages) - 1)]

    chapters: list[RawChapter] = []
    for i, (start, title) in enumerate(marks):
        end = (marks[i + 1][0] - 1) if i + 1 < len(marks) else len(pages) - 1
        chapters.append(
            RawChapter(index=i + 1, title=title, page_start=start, page_end=max(start, end))
        )
    return chapters


def _chapter_heading_text(
    lines: list[str], line_index: int, match: re.Match[str]
) -> str:
    inline = normalize_ws(match.group(3)).strip(" .:-")
    if inline:
        return _clean_heading_spacing(inline)

    following: list[str] = []
    for line in lines[line_index + 1 : line_index + 7]:
        clean = normalize_ws(line).strip(" .:")
        if not clean or re.match(r"^\d+\.\d+\b", clean):
            break
        if len(clean) > 100 or not any(char.isalpha() for char in clean):
            break
        following.append(clean)
    heading = ""
    for part in following:
        if heading.endswith("-"):
            heading = heading[:-1] + part
        else:
            heading = f"{heading} {part}".strip()
    return _clean_heading_spacing(normalize_ws(heading))


def _heading_score(title: str) -> tuple[int, int]:
    return (title.count(" "), len(title))


def _clean_heading_spacing(title: str) -> str:
    return re.sub(r"(?<=[a-z])(?=[A-Z])", " ", title)
