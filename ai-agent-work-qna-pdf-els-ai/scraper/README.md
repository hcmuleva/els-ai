# PDF Web Scraper

This tool scrapes a web page URL, locates all PDF download links embedded in HTML (`<a>`, `<embed>`, `<iframe>`, `<object>`, and raw text URLs), and downloads all PDFs automatically into `scraper/downloads/`.

## Usage Options

### 1. Pass the URL directly in terminal:
```bash
./scraper/scrape.sh "https://example.com/documents-page"
```
*or*
```bash
python3 scraper/scrape_pdfs.py "https://example.com/documents-page"
```

### 2. Interactive Mode (prompts for URL):
```bash
./scraper/scrape.sh
```

### 3. Custom output folder:
```bash
./scraper/scrape.sh "https://example.com/documents-page" --output-dir /path/to/custom_dir
```

All downloaded PDF files are saved to `scraper/downloads/` by default.

---

## Chunking & Embedding PDFs in a Folder

To process, chunk, and embed all PDFs downloaded in a folder into the vector database & relational store using the local LLM (`qwen3.6:35b`):

### Chunk and Embed default downloaded PDFs:
```bash
./embed_folder.sh scraper/downloads
```
*or directly inside the scraper folder*:
```bash
./scraper/embed_folder.sh
```

### Chunk and Embed any custom folder containing PDFs:
```bash
./embed_folder.sh /path/to/your/pdf_folder
```
