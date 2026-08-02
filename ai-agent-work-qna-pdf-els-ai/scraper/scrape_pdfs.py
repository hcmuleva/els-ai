#!/usr/bin/env python3
"""PDF Web Scraper

Given a web page URL or a direct PDF URL, this script downloads all associated PDF files.

Usage:
    python3 scraper/scrape_pdfs.py "https://example.com/documents"
    python3 scraper/scrape_pdfs.py "https://example.com/document.pdf"
    python3 scraper/scrape_pdfs.py "https://example.com/documents" --output-dir scraper/downloads
"""
import argparse
import html.parser
import os
import re
import sys
import urllib.parse
import urllib.request


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}


class PDFLinkParser(html.parser.HTMLParser):
    def __init__(self, base_url: str):
        super().__init__()
        self.base_url = base_url
        self.pdf_urls: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]):
        attr_dict = {k.lower(): v for k, v in attrs if v}
        target_url = None

        if tag in ("a", "area"):
            target_url = attr_dict.get("href")
        elif tag in ("iframe", "embed", "source"):
            target_url = attr_dict.get("src")
        elif tag == "object":
            target_url = attr_dict.get("data")

        if target_url:
            full_url = urllib.parse.urljoin(self.base_url, target_url.strip())
            parsed = urllib.parse.urlparse(full_url)
            if parsed.path.lower().endswith(".pdf") or ".pdf" in full_url.lower():
                self.pdf_urls.add(full_url)


def extract_pdf_urls(page_url: str, html_content: str) -> set[str]:
    parser = PDFLinkParser(page_url)
    try:
        parser.feed(html_content)
    except Exception:
        pass

    # Regex fallback to find any raw PDF URLs in scripts or unparsed text
    raw_matches = re.findall(
        r'https?://[^\s"\'<>]+\.pdf(?:\?[^\s"\'<>]*)?',
        html_content,
        re.IGNORECASE,
    )
    for match in raw_matches:
        parser.pdf_urls.add(match)

    # Relative regex fallback
    relative_matches = re.findall(
        r'href=["\']([^"\']+\.pdf(?:\?[^"\']*)?)["\']',
        html_content,
        re.IGNORECASE,
    )
    for match in relative_matches:
        full_url = urllib.parse.urljoin(page_url, match)
        parser.pdf_urls.add(full_url)

    return parser.pdf_urls


def is_direct_pdf_url(url: str, content_type: str = "") -> bool:
    if "application/pdf" in content_type.lower():
        return True
    parsed = urllib.parse.urlparse(url)
    return parsed.path.lower().endswith(".pdf")


def sanitize_filename(raw_name: str) -> str:
    # Decode URL encoding like %20 -> space
    decoded = urllib.parse.unquote(raw_name)
    # Remove query string parameters or hash fragments
    clean = decoded.split("?")[0].split("#")[0]
    # Keep alphanumeric, spaces, dots, hyphens, underscores
    clean = re.sub(r"[^\w\s\.-]", "_", clean).strip()
    if not clean.lower().endswith(".pdf"):
        clean += ".pdf"
    return clean or "document.pdf"


def download_pdf(url: str, output_dir: str) -> tuple[bool, str, int]:
    parsed = urllib.parse.urlparse(url)
    raw_name = os.path.basename(parsed.path) or "download.pdf"
    filename = sanitize_filename(raw_name)
    filepath = os.path.join(output_dir, filename)

    # Handle duplicate filenames by appending counter
    counter = 1
    base, ext = os.path.splitext(filename)
    while os.path.exists(filepath):
        filepath = os.path.join(output_dir, f"{base}_{counter}{ext}")
        counter += 1

    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=30) as response, open(filepath, "wb") as out_file:
            data = response.read()
            out_file.write(data)
            return True, os.path.basename(filepath), len(data)
    except Exception as exc:
        return False, str(exc), 0


def scrape_page_pdfs(page_url: str, output_dir: str) -> list[dict]:
    os.makedirs(output_dir, exist_ok=True)
    print(f"🔍 Inspecting URL: {page_url}")

    req = urllib.request.Request(page_url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            content_type = response.headers.get("Content-Type", "").lower()
            final_url = response.geturl()

            # Case A: URL is directly a PDF file
            if is_direct_pdf_url(final_url, content_type) or is_direct_pdf_url(page_url, content_type):
                print("📄 URL points directly to a PDF file. Downloading file...\n")
                data = response.read()
                raw_name = os.path.basename(urllib.parse.urlparse(final_url).path) or "document.pdf"
                filename = sanitize_filename(raw_name)
                filepath = os.path.join(output_dir, filename)

                counter = 1
                base, ext = os.path.splitext(filename)
                while os.path.exists(filepath):
                    filepath = os.path.join(output_dir, f"{base}_{counter}{ext}")
                    counter += 1

                with open(filepath, "wb") as out_file:
                    out_file.write(data)

                size_mb = len(data) / (1024 * 1024)
                info = os.path.basename(filepath)
                print(f"   ✅ Saved: {info} ({size_mb:.2f} MB)")
                print(f"\n🎉 Finished! Downloaded 1 PDF to '{output_dir}'.")
                return [{"url": final_url, "file": info, "size_bytes": len(data)}]

            # Case B: URL is an HTML web page
            html_content = response.read().decode("utf-8", errors="ignore")
    except Exception as exc:
        print(f"❌ Error loading web page: {exc}")
        sys.exit(1)

    pdf_urls = extract_pdf_urls(page_url, html_content)
    if not pdf_urls:
        print("⚠️ No PDF files found on the given page.")
        return []

    print(f"📄 Found {len(pdf_urls)} PDF file link(s). Starting downloads...\n")
    results = []

    for index, pdf_url in enumerate(sorted(pdf_urls), start=1):
        print(f"[{index}/{len(pdf_urls)}] Downloading: {pdf_url}")
        success, info, size_bytes = download_pdf(pdf_url, output_dir)
        if success:
            size_mb = size_bytes / (1024 * 1024)
            print(f"   ✅ Saved: {info} ({size_mb:.2f} MB)")
            results.append({"url": pdf_url, "file": info, "size_bytes": size_bytes})
        else:
            print(f"   ❌ Failed: {info}")

    print(f"\n🎉 Finished! Downloaded {len(results)} of {len(pdf_urls)} PDFs to '{output_dir}'.")
    return results


def main():
    parser = argparse.ArgumentParser(description="Scrape and download all PDF files from a web page or direct PDF URL.")
    parser.add_argument("url", nargs="?", default=None, help="Web page or PDF URL to scrape")
    parser.add_argument(
        "--output-dir",
        "-o",
        default=os.path.join(os.path.dirname(__file__), "downloads"),
        help="Directory to save downloaded PDFs (default: scraper/downloads)",
    )
    args = parser.parse_args()

    url = args.url
    if not url:
        try:
            url = input("🔗 Enter web page or PDF URL to scrape: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nOperation cancelled.")
            sys.exit(0)

    if not url:
        print("❌ Error: No URL provided.")
        sys.exit(1)

    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    scrape_page_pdfs(url, args.output_dir)


if __name__ == "__main__":
    main()
