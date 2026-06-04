#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".avif"}
VIDEO_EXTS = {".mp4", ".mov", ".webm", ".m4v"}
MIN_BYTES = 20 * 1024


def board_name_from_url(url: str) -> str:
  parsed = urlparse(url)
  parts = [p for p in parsed.path.split("/") if p]
  if not parts:
    return "pinterest-board"
  slug = parts[-1]
  slug = re.sub(r"[^a-zA-Z0-9._-]+", "-", slug).strip("-").lower()
  return slug or "pinterest-board"


def file_hash(path: Path) -> str:
  h = hashlib.sha256()
  with path.open("rb") as f:
    while True:
      chunk = f.read(1024 * 1024)
      if not chunk:
        break
      h.update(chunk)
  return h.hexdigest()


def gallery_dl_bin() -> str:
  user_bin = Path.home() / "Library/Python/3.9/bin/gallery-dl"
  if user_bin.exists():
    return str(user_bin)
  found = shutil.which("gallery-dl")
  if found:
    return found
  raise FileNotFoundError("gallery-dl not found. Install with: python3 -m pip install --user gallery-dl")


def run_extraction(url: str, raw_dir: Path) -> tuple[int, str]:
  raw_dir.mkdir(parents=True, exist_ok=True)
  cmd = [
    gallery_dl_bin(),
    "-R", "3",
    "--sleep-request", "0.3",
    "--sleep", "0.1",
    "--write-log", str(raw_dir / "gallery-dl.log"),
    "-D", str(raw_dir),
    url,
  ]
  proc = subprocess.run(cmd, text=True, capture_output=True)
  stderr = (proc.stderr or "").strip()
  stdout = (proc.stdout or "").strip()
  tail = "\n".join([x for x in [stdout, stderr] if x][-20:]) if (stdout or stderr) else ""
  return proc.returncode, tail


def classify(ext: str) -> str:
  e = ext.lower()
  if e in IMAGE_EXTS:
    return "image"
  if e in VIDEO_EXTS:
    return "video"
  return "other"


def normalize_downloads(raw_dir: Path, final_dir: Path) -> dict:
  final_dir.mkdir(parents=True, exist_ok=True)
  seen_hashes: set[str] = set()
  images = 0
  videos = 0
  skipped = 0
  total_found = 0
  errors = []

  files = [p for p in raw_dir.rglob("*") if p.is_file()]
  files.sort(key=lambda p: p.name.lower())

  for src in files:
    if src.name == "gallery-dl.log":
      continue
    total_found += 1
    kind = classify(src.suffix)
    if kind == "other":
      skipped += 1
      continue
    try:
      size = src.stat().st_size
      if kind == "image" and size < MIN_BYTES:
        skipped += 1
        continue
      digest = file_hash(src)
      if digest in seen_hashes:
        skipped += 1
        continue
      seen_hashes.add(digest)
      if kind == "image":
        images += 1
        dst = final_dir / f"image_{images:03d}{src.suffix.lower()}"
      else:
        videos += 1
        dst = final_dir / f"video_{videos:03d}{src.suffix.lower()}"
      shutil.copy2(src, dst)
    except Exception as exc:
      skipped += 1
      errors.append(f"{src}: {exc}")

  return {
    "totalFound": total_found,
    "imagesDownloaded": images,
    "videosDownloaded": videos,
    "skipped": skipped,
    "errors": errors,
  }


def main() -> int:
  parser = argparse.ArgumentParser(description="Pinterest media extractor/downloader")
  parser.add_argument("--url", required=True, help="Pinterest board/page URL")
  parser.add_argument("--downloadPath", required=True, help="Base local output path")
  parser.add_argument("--clean", action="store_true", help="Remove raw temp files after completion")
  args = parser.parse_args()

  board = board_name_from_url(args.url)
  base_dir = Path(args.downloadPath).expanduser().resolve()
  board_dir = base_dir / board
  raw_dir = board_dir / "_raw"
  board_dir.mkdir(parents=True, exist_ok=True)

  status = "success"
  extraction_error = ""
  try:
    rc, logs = run_extraction(args.url, raw_dir)
    if rc != 0:
      status = "partial_success"
      extraction_error = logs or "gallery-dl extraction command failed"
  except Exception as exc:
    status = "error"
    extraction_error = str(exc)
    result = {
      "status": status,
      "totalFound": 0,
      "imagesDownloaded": 0,
      "videosDownloaded": 0,
      "skipped": 0,
      "downloadPath": str(board_dir),
      "error": extraction_error,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1

  normalized = normalize_downloads(raw_dir, board_dir)
  if args.clean:
    shutil.rmtree(raw_dir, ignore_errors=True)

  if normalized["imagesDownloaded"] == 0 and normalized["videosDownloaded"] == 0:
    status = "error"

  output = {
    "status": status,
    "totalFound": normalized["totalFound"],
    "imagesDownloaded": normalized["imagesDownloaded"],
    "videosDownloaded": normalized["videosDownloaded"],
    "skipped": normalized["skipped"],
    "downloadPath": str(board_dir) + "/",
  }
  if extraction_error:
    output["extractionWarning"] = extraction_error
  if normalized["errors"]:
    output["errors"] = normalized["errors"][:20]

  print(json.dumps(output, ensure_ascii=False, indent=2))
  return 0 if status != "error" else 2


if __name__ == "__main__":
  sys.exit(main())
