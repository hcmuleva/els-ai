# Local LLM and HTTP API

This guide runs the knowledge pipeline with a local OpenAI-compatible model server and exposes document ingestion and validated RAG question generation through FastAPI.

## Completed baseline

The current implementation provides:

- An OpenAI-compatible local client for `GET /v1/models` and `POST /v1/chat/completions`
- Ollama, vLLM, LM Studio, and other compatible server support through one configuration
- Background ingestion for PDF, TXT, MD, and Markdown uploads
- Persistent local job records and immutable pipeline run output
- Document, chunk-quality, and semantic-retrieval gates before store loading
- Qdrant retrieval plus relational concept lookup for question generation
- Exact-count question validation and target-schema adaptation
- A browser administration page and FastAPI OpenAPI documentation

This is a local baseline. Authentication, durable distributed workers, production rate limiting, and the other production work listed in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) remain future phases.

## Architecture

```text
Browser / curl.exe
        |
        v
FastAPI: scripts/api_server.py
  | GET / and /docs
  | GET /api/health
  | POST /api/documents
  | GET /api/jobs/{job_id}
  | POST /api/questions
  |
  +--> IngestionJobManager --> scripts/ingest_pdf.py
  |       | extraction and analysis through configured LLM
  |       | document integrity gate
  |       | chunk quality gate
  |       | semantic retrieval gate
  |       +--> load approved data
  |              +--> Qdrant: vectors and chunk metadata
  |              +--> PostgreSQL or SQLite: concepts and relations
  |
  +--> QuestionGenerationService
          | concept lookup in relational store
          | filtered semantic retrieval from Qdrant
          | generation through configured LLM
          +--> exact-count, option, answer, explanation,
               LaTeX, and target-schema validation

Local model server
  Ollama recommended for quick start
  vLLM / LM Studio supported through OpenAI-compatible endpoints
```

The API and command-line paths share `PipelineConfig`, the local LLM adapter, ingestion pipeline, stores, and question service. See the implementation in:

- [`../../src/knowledge_pipeline/serving/openai_compatible.py`](../../src/knowledge_pipeline/serving/openai_compatible.py)
- [`../../src/knowledge_pipeline/api/app.py`](../../src/knowledge_pipeline/api/app.py)
- [`../../src/knowledge_pipeline/api/jobs.py`](../../src/knowledge_pipeline/api/jobs.py)
- [`../../src/knowledge_pipeline/serving/question_service.py`](../../src/knowledge_pipeline/serving/question_service.py)
- [`../../scripts/ingest_pdf.py`](../../scripts/ingest_pdf.py)

## Prerequisites

- Windows PowerShell
- Python 3.10 or newer
- Ollama for the recommended quick start
- Qdrant, with the included Docker Compose service being the simplest option
- PostgreSQL, or SQLite for a server-free relational store
- Docker Desktop if using `docker compose` for Qdrant
- Tesseract available on `PATH` when scanned PDFs require its OCR fallback

The first use of the default FastEmbed model can download model files. Ollama model downloads also require network access.

## Quick start with Ollama and Qwen

Run commands from the repository root:

```powershell
Set-Location "C:\personal\work\ai-agent-work-qna-pdf"
```

### 1. Install Python dependencies

```powershell
py -3.10 -m venv .venv
& ".\.venv\Scripts\python.exe" -m pip install --upgrade pip
& ".\.venv\Scripts\python.exe" -m pip install -r requirements.txt
```

If `.venv` already exists, use it and run only the final install command.

### 2. Install and prepare Ollama

Install Ollama from its official distribution, then pull the recommended model:

```powershell
ollama pull qwen3.6:35b
ollama list
```

The Ollama application normally starts its service automatically. If it is not running:

```powershell
ollama serve
```

Keep that terminal open.

### 3. Start Qdrant

```powershell
docker compose up -d qdrant
```

For the quickest local setup, use SQLite instead of requiring PostgreSQL:

```powershell
$env:KP_POSTGRES_DSN = "sqlite:data/local-kp.db"
```

The setting name remains `KP_POSTGRES_DSN` for compatibility, but a value beginning with `sqlite:` selects the SQLite store.

### 4. Select the local provider

Set variables in the same PowerShell session used to start the API:

```powershell
$env:KP_PROVIDER = "local"
$env:KP_LOCAL_LLM_BASE_URL = "http://127.0.0.1:11434/v1"
$env:KP_LOCAL_LLM_MODEL = "qwen3.6:35b"
$env:KP_LOCAL_LLM_API_KEY = "ollama"
$env:KP_LOCAL_LLM_TIMEOUT = "240"
$env:KP_LOCAL_LLM_TEMPERATURE = "0.2"
$env:KP_LOCAL_LLM_MAX_TOKENS = "4096"
$env:KP_QDRANT_URL = "http://127.0.0.1:6333"
$env:KP_QDRANT_COLLECTION = "kp_chunks"
$env:KP_POSTGRES_DSN = "sqlite:data/local-kp.db"
```

The API settings are:

```powershell
$env:KP_API_HOST = "127.0.0.1"
$env:KP_API_PORT = "8000"
$env:KP_API_MAX_UPLOAD_MB = "200"
```

`KP_API_MAX_UPLOAD_MB` is interpreted as an integer number of MiB. Keep `KP_API_HOST=127.0.0.1` unless network exposure has been reviewed and protected.

Alternatively, copy [`.env.example`](../../.env.example) to `.env` and edit non-secret local values:

```powershell
Copy-Item ".env.example" ".env"
```

Environment variables already present in the process take precedence over `.env`.

### 5. Start the API

```powershell
& ".\.venv\Scripts\python.exe" ".\scripts\api_server.py"
```

Open:

- Administration UI: <http://127.0.0.1:8000/>
- Interactive OpenAPI UI: <http://127.0.0.1:8000/docs>
- OpenAPI JSON: <http://127.0.0.1:8000/openapi.json>

The administration UI is served from [`../../web/pipeline_admin.html`](../../web/pipeline_admin.html).

## Verify health

```powershell
curl.exe -sS "http://127.0.0.1:8000/api/health"
```

Example with Ollama reachable and the model installed:

```json
{
  "status": "ok",
  "provider": "local",
  "llm": {
    "reachable": true,
    "configured_model": "qwen3.6:35b",
    "available_models": [
      "qwen3.6:35b"
    ],
    "model_available": true,
    "base_url": "http://127.0.0.1:11434/v1"
  },
  "qdrant": {
    "url": "http://127.0.0.1:6333",
    "collection": "kp_chunks"
  },
  "relational_backend": "sqlite"
}
```

`status: "ok"` confirms the API process is responding. For the local provider, separately check `llm.reachable` and `llm.model_available`. This endpoint reports configured store information but does not currently probe Qdrant or the relational store.

## End-to-end API flow

### 1. Upload a document

Accepted filename extensions are `.pdf`, `.txt`, `.md`, and `.markdown`.

```powershell
curl.exe -sS -X POST "http://127.0.0.1:8000/api/documents" `
  -F "file=@C:\books\calculus.pdf;type=application/pdf"
```

The API returns HTTP `202 Accepted`. Example:

```json
{
  "job_id": "ingest-a18f6b2f8c594d10",
  "type": "document_ingestion",
  "status": "queued",
  "filename": "calculus.pdf",
  "source_path": "C:\\personal\\work\\ai-agent-work-qna-pdf\\data\\uploads\\ingest-a18f6b2f8c594d10\\source.pdf",
  "run_id": "document-71a4f07c749b4e21",
  "output_dir": "C:\\personal\\work\\ai-agent-work-qna-pdf\\data\\output\\runs\\document-71a4f07c749b4e21",
  "provider": "local",
  "created_at": "2026-07-21T12:00:00Z",
  "started_at": null,
  "finished_at": null,
  "error": null,
  "log_tail": ""
}
```

Save the identifiers:

```powershell
$upload = curl.exe -sS -X POST "http://127.0.0.1:8000/api/documents" `
  -F "file=@C:\books\calculus.pdf;type=application/pdf" | ConvertFrom-Json
$jobId = $upload.job_id
$runId = $upload.run_id
```

Empty files, missing filenames, unsupported extensions, and uploads over the configured limit are rejected.

### 2. Poll ingestion

```powershell
curl.exe -sS "http://127.0.0.1:8000/api/jobs/$jobId"
```

Possible status values are:

| Status | Meaning |
| --- | --- |
| `queued` | The job record and upload exist, and the worker thread has not started. |
| `running` | The ingestion subprocess is active. |
| `completed` | Ingestion, gates, and store loading exited successfully. |
| `failed` | The subprocess or worker failed. Check `error` and `log_tail`. |
| `interrupted` | The API restarted while a previously persisted job was queued or running. |

Example completion:

```json
{
  "job_id": "ingest-a18f6b2f8c594d10",
  "type": "document_ingestion",
  "status": "completed",
  "filename": "calculus.pdf",
  "source_path": "C:\\personal\\work\\ai-agent-work-qna-pdf\\data\\uploads\\ingest-a18f6b2f8c594d10\\source.pdf",
  "run_id": "document-71a4f07c749b4e21",
  "output_dir": "C:\\personal\\work\\ai-agent-work-qna-pdf\\data\\output\\runs\\document-71a4f07c749b4e21",
  "provider": "local",
  "created_at": "2026-07-21T12:00:00Z",
  "started_at": "2026-07-21T12:00:01Z",
  "finished_at": "2026-07-21T12:08:42Z",
  "error": null,
  "log_tail": "[ingest] chunks embedded and upserted"
}
```

Wait for `completed` before generating questions from that run.

### 3. Generate validated questions

Create a request file to avoid PowerShell quoting problems:

```powershell
@'
{
  "topic": "Applications of Derivatives",
  "query": "increasing functions and local maxima",
  "level_band": "jee_main",
  "count": 1,
  "source_run_id": "document-71a4f07c749b4e21",
  "persist": false,
  "max_attempts": 3
}
'@ | Set-Content -Encoding utf8 ".\question-request.json"

curl.exe -sS -X POST "http://127.0.0.1:8000/api/questions" `
  -H "Content-Type: application/json" `
  --data-binary "@question-request.json"
```

Request fields:

| Field | Required | Constraints and behavior |
| --- | --- | --- |
| `topic` | Yes | Non-empty, at most 200 characters. Used for relational concept lookup and generation. |
| `query` | No | Retrieval detail, at most 1000 characters. Default is empty. |
| `level_band` | No | `beginner`, `intermediate`, `advanced`, `jee_main`, `jee_advanced`, or `expert`. |
| `count` | No | 1 through 50. Default is 5. The service returns the exact count or fails. |
| `source_run_id` | No | Filters Qdrant retrieval by one ingestion run. |
| `persist` | No | Default is `false`. When true, the shared persistence workflow is invoked. |
| `max_attempts` | No | 1 through 5. Default is 3. |

An abbreviated example response with one complete option set:

```json
{
  "quiz_id": "quiz-10bf92671b85",
  "quiz_title": "Applications of Derivatives Questions",
  "topic": "Applications of Derivatives",
  "query": "increasing functions and local maxima",
  "level_band": "jee_main",
  "subject": "Mathematics",
  "class_level": "Class 12",
  "provider": "local",
  "model": "qwen2.5:7b-instruct",
  "source_run_id": "document-71a4f07c749b4e21",
  "count": 1,
  "context_used": true,
  "source_chunk_ids": [
    "document-71a4f07c749b4e21:chunk-001"
  ],
  "source_pages": [
    42
  ],
  "validation": {
    "passed": true,
    "attempts": 1,
    "accepted": 1,
    "rejected": 0,
    "rules": [
      "exact_count",
      "non_empty_stem",
      "exactly_four_unique_options",
      "exactly_one_correct_option",
      "explanation_required",
      "latex_balanced",
      "target_schema_valid"
    ]
  },
  "questions": [
    {
      "question": {
        "id": "6aab7b27-ea8e-5d44-b9d8-00d46c667e65",
        "quiz_id": "quiz-10bf92671b85",
        "quiz_title": "Applications of Derivatives Questions",
        "class_level": "Class 12",
        "subject": "Mathematics",
        "quiz_type": "single_choice",
        "question_type": "single_choice",
        "question_title": "For which interval is \\(f(x)=x^2-4x\\) increasing?",
        "question_instruction": "Choose one correct option.",
        "explanation": "Since \\(f'(x)=2x-4\\), the function is increasing for \\(x>2\\).",
        "question_audio": null,
        "time_limit_seconds": 30,
        "points": 10,
        "sort_order": 1,
        "question_data": {
          "_meta": {
            "subject": "Mathematics",
            "creatorId": null,
            "classLevel": "Class 12",
            "organizationId": null,
            "level_band": "jee_main",
            "bloom_level": "Apply",
            "topic": "Applications of Derivatives",
            "concept_ids": [],
            "source": null,
            "source_run_id": "document-71a4f07c749b4e21",
            "source_book_id": null,
            "source_pages": [
              42
            ],
            "source_chunk_ids": [
              "document-71a4f07c749b4e21:chunk-001"
            ]
          },
          "options": [
            {
              "id": "x_2_1",
              "label": "\\(x>2\\)",
              "is_correct": true,
              "slot_position": 1,
              "svg": null,
              "diagram": null,
              "rationale": "The derivative is positive."
            },
            {
              "id": "x_2_2",
              "label": "\\(x<2\\)",
              "is_correct": false,
              "slot_position": 2,
              "svg": null,
              "diagram": null,
              "rationale": "The derivative is negative there."
            },
            {
              "id": "x_2_3",
              "label": "\\(x=2\\)",
              "is_correct": false,
              "slot_position": 3,
              "svg": null,
              "diagram": null,
              "rationale": "The derivative is zero at one point."
            },
            {
              "id": "all_real_x_4",
              "label": "All real \\(x\\)",
              "is_correct": false,
              "slot_position": 4,
              "svg": null,
              "diagram": null,
              "rationale": "The derivative changes sign."
            }
          ],
          "variant": "single_choice",
          "diagram": null
        },
        "created_at": "2026-07-21T12:10:00Z",
        "question_svg": null
      }
    }
  ]
}
```

Generated values vary by model and retrieved context. A validation or generation failure returns HTTP `502` rather than a partial question list. Invalid request values return HTTP `400` or FastAPI's request-validation response.

## Validation gates

### Ingestion gates

The upload worker calls [`../../scripts/ingest_pdf.py`](../../scripts/ingest_pdf.py), which:

1. Extracts and analyzes the document into a new run directory.
2. Runs document integrity validation as part of the pipeline.
3. Runs chunk quality validation. Chunks are checked for sufficient content, required sections, provenance metadata, valid source pages, uniqueness, truncation, and malformed text. At least 80 percent must be approved.
4. Runs semantic retrieval validation with the configured FastEmbed model. Recall, precision, mean reciprocal rank, nDCG, and context-length thresholds must pass.
5. Calls store loading only after the prior commands succeed.
6. Store loading rechecks document, chunk, and retrieval reports before writing approved chunks and metadata.

The HTTP path does not enable the scripts' unvalidated-loading escape hatch.

### Question gates

The service retries up to `max_attempts` and accepts only questions with:

- A non-empty stem
- Exactly four non-empty, unique option labels
- Exactly one correct option
- A non-empty explanation
- Balanced, valid LaTeX delimiters and commands according to the project validator
- A unique stem within the generated set
- Successful adaptation to the target question schema

The response must contain exactly `count` adapted questions. Otherwise, the entire request fails with HTTP `502`.

## Storage and data flow

| Data | Current location |
| --- | --- |
| Uploaded source | `data/uploads/{job_id}/source.{extension}` |
| Job record | `data/api-jobs/{job_id}.json` |
| Immutable pipeline artifacts | `data/output/runs/{run_id}/` |
| Approved chunk vectors and retrieval metadata | Configured Qdrant collection |
| Concepts, graph relations, level profiles, and metadata | Configured PostgreSQL or SQLite store |

Uploaded jobs run in daemon threads. Each thread starts `scripts/ingest_pdf.py` as a subprocess with a 24-hour timeout. Job JSON survives process restarts, but a queued or running job is marked `interrupted` after restart and is not automatically resumed.

Question generation looks up topic concepts in the relational store, retrieves semantically relevant Qdrant chunks, optionally applies `source_run_id` as a retrieval filter, then asks the configured model for candidate items. `persist: false` only returns the generated result. `persist: true` additionally invokes the existing persistence workflow.

## Other OpenAI-compatible servers

The local adapter requires:

- `GET {base_url}/models`
- `POST {base_url}/chat/completions`
- Non-streaming OpenAI-style JSON responses

For vLLM or LM Studio, start the server separately and point the variables at its OpenAI-compatible `/v1` base URL:

```powershell
$env:KP_PROVIDER = "local"
$env:KP_LOCAL_LLM_BASE_URL = "http://127.0.0.1:1234/v1"
$env:KP_LOCAL_LLM_MODEL = "the-model-id-returned-by-models"
$env:KP_LOCAL_LLM_API_KEY = "local"
```

Use the exact model identifier returned by that server. The API key is sent as a bearer token when non-empty. Some local servers ignore it, while others require a configured value.

## Troubleshooting

### `llm.reachable` is false

- Confirm Ollama is running with `ollama list`.
- Test its compatible endpoint:

  ```powershell
  curl.exe -sS "http://127.0.0.1:11434/v1/models"
  ```

- Confirm `KP_LOCAL_LLM_BASE_URL` includes `/v1`.
- Increase `KP_LOCAL_LLM_TIMEOUT` for slow hardware.

### `model_available` is false

Pull the configured model and ensure the names match exactly:

```powershell
ollama pull qwen3.6:35b
ollama list
```

### Upload returns `400` or `413`

- Use PDF, TXT, MD, or Markdown.
- Ensure the file is not empty.
- Check `KP_API_MAX_UPLOAD_MB`.
- Restart the API after changing environment variables.

### Ingestion status is `failed`

Inspect `error` and `log_tail` from `GET /api/jobs/{job_id}`. Common causes include:

- Local model timeout, unavailable model, or malformed model output
- Qdrant not running or configured at the wrong URL
- PostgreSQL credentials or SQLite path problems
- FastEmbed model download or initialization failure
- Document, chunk approval, or retrieval validation gate failure
- OCR dependencies missing for a scanned document

Each retry through the upload endpoint creates a new job and run. Existing immutable run artifacts are not overwritten.

### Ingestion status is `interrupted`

The API process stopped while the job was queued or running. Current jobs do not resume automatically. Upload the document again to create a new job.

### Question generation returns `400`

Check that `topic` is non-empty, `level_band` is one of the supported values, `count` is from 1 through 50, and `max_attempts` is from 1 through 5.

### Question generation returns `502`

The LLM failed or did not produce the requested number of valid items within `max_attempts`. Check:

- The local model is reachable and has enough context and output capacity.
- `KP_LOCAL_LLM_MAX_TOKENS` is sufficient.
- The requested `source_run_id` completed and its approved chunks were loaded.
- The topic and query match ingested content.
- The model consistently emits four unique options, one correct answer, an explanation, and balanced LaTeX.

### No retrieval context is used

- Confirm ingestion completed successfully.
- Confirm the API uses the same `KP_QDRANT_URL`, collection, embedding model, embedding dimension, and relational DSN used during ingestion.
- Remove `source_run_id` temporarily to test retrieval across all loaded runs.
- Use a topic that exists in the ingested concept metadata.

## Configuration reference

| Variable | Default | Purpose |
| --- | --- | --- |
| `KP_PROVIDER` | `auto` | Set to `local` for the OpenAI-compatible local adapter. |
| `KP_LOCAL_LLM_BASE_URL` | `http://127.0.0.1:11434/v1` | Compatible API base URL. |
| `KP_LOCAL_LLM_MODEL` | `qwen3.6:35b` | Model identifier sent to the server. |
| `KP_LOCAL_LLM_API_KEY` | `ollama` | Optional bearer token value. |
| `KP_LOCAL_LLM_TIMEOUT` | `240` | Request timeout in seconds. |
| `KP_LOCAL_LLM_TEMPERATURE` | `0.2` | Chat completion temperature. |
| `KP_LOCAL_LLM_MAX_TOKENS` | `4096` | Maximum completion tokens requested. |
| `KP_API_HOST` | `127.0.0.1` | API bind host. |
| `KP_API_PORT` | `8000` | API bind port. |
| `KP_API_MAX_UPLOAD_MB` | `200` | Integer upload limit in MiB. |
| `KP_QDRANT_URL` | `http://localhost:6333` | Qdrant URL. |
| `KP_QDRANT_COLLECTION` | `kp_chunks` | Qdrant collection. |
| `KP_POSTGRES_DSN` | `postgresql://kp@127.0.0.1:5432/kp` | PostgreSQL DSN or `sqlite:` selector. |
| `KP_EMBEDDING_MODEL` | `BAAI/bge-small-en-v1.5` | FastEmbed model shared by loading and retrieval. |
| `KP_EMBEDDING_DIM` | `384` | Embedding dimension shared by loading and retrieval. |

Do not commit credentials in `.env`. The Ollama quick-start value is a local placeholder, not a hosted service secret.
