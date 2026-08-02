# Knowledge Pipeline

Transform raw educational books (PDF / TXT / MD) into **assessment-ready, embedding-ready
knowledge assets**. The pipeline runs 14 phases and emits normalized JSON repositories. The
knowledge assets. The pipeline runs 14 phases and emits normalized JSON repositories. The
included ingestion script then embeds the semantic chunks into Qdrant for quiz generation,
explanation generation, personalized/adaptive learning, competency assessment, knowledge
graphs, educational search, and RAG systems.
The analysis pipeline itself does not create embeddings. `scripts/ingest_pdf.py` runs the
analysis and store-loading steps together, including local embeddings and Qdrant upserts.

## Key properties

- **Local or hosted LLMs.** Set `KP_PROVIDER=local` to use Qwen or another model through an
  OpenAI-compatible Ollama, vLLM, LM Studio, or llama.cpp server. Droid, OpenAI, Anthropic,
  and deterministic mock modes remain available. `auto` preserves the existing
  `droid -> openai -> anthropic -> mock` priority.
- **Runs offline too.** With no LLM reachable, a deterministic heuristic extractor (`mock`) runs
  with no network, fully reproducible. Any LLM failure falls back to it, so the pipeline never
  breaks.
- **Never fakes difficulty.** Content *level* (beginner ... JEE Advanced ... expert) is a semantic
  judgment made only by an LLM. Offline, concepts are marked `unrated` and no competitive items
  are fabricated.
- **Provider-agnostic phases.** Only genuinely semantic steps call a backend; scoring, Bloom
  objectives, competency mapping, graph centrality, assessment classification, validation,
  chunking and composite assembly are reproducible rules.

## Static STEM diagrams and validation

Question generation uses a typed diagram specification and deterministic SVG renderer as its
production source of truth. It does not execute model-authored SVG, TikZ, or animation code.
Concept-aware builders cover mathematical plots and geometry plus magnetic flux, LR circuits,
current-time graphs, transformers, coupled coils, inclined-plane free-body diagrams, refraction,
and chemical reactions. TikZ, PGFPlots, CircuitikZ, pyfreebody, mhchem, and ChemFig are recorded
as optional static export recommendations only; they are never required for runtime rendering.

Each candidate passes metadata, answer-key, formula, concept-to-diagram, required-object,
label/unit, graph, SVG, layout, placeholder, and LaTeX checks. The API returns a scored report in
`question_validation_reports`, including `decision`, `critical_failures`, and deterministic
`repair_instructions`. Only questions with `decision: "accept"` can be returned or persisted;
failed candidates are retried with the repair instructions and are never stored.

## The 14 phases

| Phase | Name | Output |
|------:|------|--------|
| 1 | Content Discovery | `knowledge_inventory.json` (subject/curriculum/domain, chapter/topic/subtopic, book overlap) |
| 2 | Content Quality Analysis | `page_quality.json` (HIGH/MEDIUM/LOW + Content Value Score per page) |
| 3 | Noise Removal | `clean_corpus.json` (duplicates, copyright, references, marketing removed) |
| 4 | Knowledge Distillation | `knowledge_repository.json` (topic/subtopic/concept/definition/examples/frameworks/processes/formulae/case_studies/facts) |
| 5 | Concept Extraction | `concept_repository.json` (id, type, difficulty, importance, confidence, prerequisites, dependencies, related) |
| 6 | Learning Objectives | `learning_objective_repository.json` (Bloom: Remember→Create; competency; assessment type) |
| 7 | Misconceptions | `misconception_repository.json` (misconception, explanation, correction) |
| 8 | Competency Mapping | `competency_repository.json` (concept→skill→outcome→assessment) |
| 9 | Knowledge Graph | `knowledge_graph.json` (typed edges, node/edge weight, degree/betweenness/pagerank) |
| 10 | Assessment Preparation | `assessment_repository.json` (MCQ/Scenario/Problem/Case/Short/Essay/Practical suitability) |
| 11 | Quality Validation | `quality_validation.json` (relevance/educational/assessment/embedding/completeness/accuracy/confidence; rejects below threshold) |
| 12 | Embedding Preparation | `embedding_ready.json` (embedding units; no embeddings are created) |
| 13 | Semantic Chunking | `chunk_repository.json` (concept-complete chunks; never page/token based) |
| 14 | Final Output | all repositories + `vectordb_dataset.json` + `manifest.json` |

Level-aware extension (LLM-driven):

| Phase | Name | Output |
|------:|------|--------|
| L | Level Calibration | `level_repository.json` (LLM `level_band`: beginner→jee_advanced→expert, or `unrated` offline; prerequisite depth, confidence) |
| C | Composite Assembly | `composite_repository.json` (graph-built multi-concept bundles for competitive/JEE-style items) |
| 15 | Question Generation | `question_repository.json` (level-calibrated items: single-concept for lower bands, multi-concept for JEE+; MCQ options, answer, distractors from misconceptions, worked solution) |

Level band is also written into every chunk/embedding record's `metadata`, so you can retrieve or
filter by difficulty in the vector store.

## Project structure

```
.
├── config/settings.yaml          # thresholds, paths, provider, stores, identity (env vars override)
├── docker-compose.yml            # Qdrant + Postgres (local dev)
├── deploy/postgres/schema.sql    # relational schema (metadata + relations)
├── data/input/                   # put your PDF/TXT/MD books here
├── data/output/                  # generated JSON assets
├── scripts/make_sample_pdf.py    # generate demo educational PDFs
├── scripts/ingest_pdf.py         # analyze one file, embed chunks, and load stores
├── scripts/generate_questions.py # retrieve chunks and generate RAG questions
├── scripts/api_server.py         # local upload, job-status, and question API/UI
├── scripts/load_stores.py        # load JSON assets into Qdrant + Postgres
├── scripts/register_mcp.py       # write .factory/mcp.json for Droid
├── scripts/run_workflow.py       # trigger a LangGraph workflow from the CLI
├── src/knowledge_pipeline/
│   ├── config.py                 # config loading + env overrides
│   ├── models.py                 # pydantic schemas for every asset
│   ├── ingestion.py              # PDF/TXT/MD loading + chapter detection
│   ├── extractors/               # heuristic (offline) + droid (default) + openai/anthropic
│   ├── phases/                   # p01_discovery ... p14_output + p_levels, p_composite, p15_generation
│   ├── stores/                   # fastembed embedder, Qdrant store, Postgres store
│   ├── diagram/                  # math-diagram DSL + builders (function/coordinate/LPP/circle/...)
│   ├── rendering/                # deterministic SVG renderer
│   ├── quizschema/               # target quiz JSON schema + adapter (svg on question + options)
│   ├── generation/               # parametric math templates + question generator
│   ├── serving/                  # RAG workflows, retrievers, and provider-neutral LLM clients
│   ├── api/                      # upload, ingestion-job, health, and question APIs
│   ├── mcp_server/               # kp-workflows MCP server (Droid triggers LangGraph)
│   ├── pipeline.py               # phase orchestrator
│   └── cli.py                    # command-line interface
├── tests/                        # pytest suite
├── web/pipeline_admin.html       # local ingestion and question-generation UI
├── run.py                        # convenience runner (no install needed)
└── pyproject.toml
```

## Installation

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
# optional (demo PDFs + LLM providers + tests):
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

## Simple file-to-questions workflow

This is the shortest end-to-end flow when you have one PDF.

### 1. Install dependencies

Run the installation commands above from the repository root:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

### 2. Choose local stores

The commands below use an on-disk Qdrant database, SQLite for metadata, and hash embeddings.
This requires no Docker, Postgres server, or model download:

```powershell
$env:KP_QDRANT_URL = "$PWD\data\qdrant_local"
$env:KP_POSTGRES_DSN = "sqlite:$PWD\data\kp.sqlite"
$env:KP_EMBEDDING_MODEL = "hash"
```

For better semantic retrieval, replace `hash` with the default fastembed model:
`BAAI/bge-small-en-v1.5`. A Qdrant server can also be used by setting
`KP_QDRANT_URL=http://localhost:6333`.

### 3. Extract, analyze, chunk, embed, and index the PDF

Pass the PDF path as the first argument. The script runs the analysis pipeline, writes the
intermediate JSON repositories to `data/output`, embeds each semantic chunk, and upserts it
into Qdrant:

```powershell
.\.venv\Scripts\python.exe scripts\ingest_pdf.py `
  "C:\path\to\your\book.pdf" `
  --provider mock `
  --recreate
```

Use `--provider local` when a local OpenAI-compatible server is configured, or
`--provider droid` when Droid is configured. `--recreate` clears the configured Qdrant
collection before indexing; omit it when adding another file.

Useful overrides:

```powershell
.\.venv\Scripts\python.exe scripts\ingest_pdf.py "C:\path\to\book.pdf" `
  --output-dir data\output `
  --qdrant-url "$PWD\data\qdrant_local" `
  --collection kp_chunks `
  --embedding-model hash `
  --postgres-dsn "sqlite:$PWD\data\kp.sqlite"
```

The important outputs are `data/output/chunk_repository.json`,
`data/output/vectordb_dataset.json`, and the indexed Qdrant collection.

### 4. Generate questions from the indexed PDF

Question generation uses retrieved chunks and the configured LLM. Set the provider before
running it:

```powershell
$env:KP_PROVIDER = "local"
.\.venv\Scripts\python.exe scripts\generate_questions.py `
  --topic "Kinematics" `
  --query "velocity acceleration and equations of motion" `
  --level intermediate `
  --count 5 `
  --out data\output\kinematics_questions.json
```

The generated quiz JSON is saved to the path supplied by `--out`. Unless `--no-persist` is
provided, the questions are also saved in the configured Postgres or SQLite relational store.
`--topic` should match a topic extracted from the source file. Use `--no-persist` if only the
JSON file is needed.

## Quick start (offline demo)

```powershell
# 1) generate sample educational PDFs into data/input
.\.venv\Scripts\python.exe scripts\make_sample_pdf.py

# 2) run the full pipeline (heuristic/offline mode)
.\.venv\Scripts\python.exe run.py --provider mock
```

JSON assets are written to `data/output/`. (`--provider mock` keeps it offline; the default
`auto` uses Droid, which calls `droid exec` per concept and is slower/metered.)

## Run on your own books

Drop `.pdf`, `.txt`, or `.md` files into `data/input/` and run:

```powershell
.\.venv\Scripts\python.exe run.py --input data\input --output data\output
```

## Enable an LLM backend

For a local Qwen model through Ollama:

```powershell
ollama pull qwen3.6:35b
$env:KP_PROVIDER = "local"
$env:KP_LOCAL_LLM_BASE_URL = "http://127.0.0.1:11434/v1"
$env:KP_LOCAL_LLM_MODEL = "qwen3.6:35b"
```

The same OpenAI-compatible settings work with vLLM, LM Studio, and llama.cpp server.
See [`docs/local-llm-api/README.md`](docs/local-llm-api/README.md) for the full local server,
upload API, validation, indexing, and question-generation flow.

### Droid

Priority is `droid -> openai -> anthropic -> mock`. The default LLM is **Droid**, called
headlessly with `droid exec`. If the `droid` CLI is on PATH, `auto` uses it:

```powershell
.\.venv\Scripts\python.exe run.py --provider droid
```

Tune via env (see `.env.example`): `KP_DROID_MODEL` (blank = Droid default), `KP_DROID_AUTONOMY`
(`low` is enough for generation), `KP_DROID_TIMEOUT`.

### Optional hosted API fallback

Copy `.env.example` to `.env` and set `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`). With **no** LLM
available, the pipeline runs in `mock` mode: valid assets are still produced, levels are
`unrated`, and no competitive questions are fabricated.

## Configuration

Edit `config/settings.yaml` (validation thresholds, page-value weights, chunk size, paths,
`droid`, `identity`, `stores`). Environment variables override YAML: `KP_PROVIDER`,
`KP_LOCAL_LLM_BASE_URL`, `KP_LOCAL_LLM_MODEL`, `KP_LOCAL_LLM_API_KEY`,
`KP_LOCAL_LLM_TIMEOUT`, `KP_LOCAL_LLM_TEMPERATURE`, `KP_LOCAL_LLM_MAX_TOKENS`,
`KP_DROID_MODEL`, `KP_DROID_AUTONOMY`, `KP_DROID_TIMEOUT`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
`KP_CREATOR_ID`, `KP_ORG_ID`, `KP_SUBJECT`, `KP_CLASS_LEVEL`, `KP_EMBEDDING_MODEL`,
`KP_QDRANT_URL`, `KP_QDRANT_COLLECTION`, `KP_POSTGRES_DSN`.

**Identity fields** (`KP_CREATOR_ID`, `KP_ORG_ID`, `KP_SUBJECT`, `KP_CLASS_LEVEL`) are never
hardcoded; supply them via env or `.env` and they flow into the quiz schema `_meta`.

## Output: VectorDB-ready dataset

`vectordb_dataset.json` is a list of `{id, text, metadata}` records built from semantic chunks.
Each `text` is self-contained and answers: what it is, why it matters, how it works, an example,
and an assessment opportunity - ready to embed and upsert into any vector store.

## Serving plane (local LLM or Droid + LangGraph + Qdrant/Postgres)

Two planes:

- **Ingestion (offline):** the 14-phase pipeline emits JSON, then `load_stores.py` loads it into
  **Qdrant** (chunk vectors, via local **fastembed**) and **Postgres** (concepts, chunks,
  `concept_edges`, level profiles; relations traversed with recursive CTEs - no Neo4j).
- **Serving (runtime):** **LangGraph** workflows retrieve **through MCP**, build context, and call
  the **Droid** LLM to produce quiz / explanation / learning-path. **Droid triggers LangGraph**
  through the custom `kp-workflows` MCP server.

```
Droid CLI  (dev interface + LLM via `droid exec`)
   ├─ Qdrant MCP    -> Vector Retrieval
   └─ Postgres MCP  -> Metadata + Relations (recursive CTE)     + Filesystem MCP
        v  Context Builder  ->  configured LLM  ->  Quiz | Explanation | Learning Path  (+ SVG diagrams)
```

### 1. Start stores

```powershell
docker compose up -d          # Qdrant (6333) + Postgres (5432)
```

#### No-Docker local mode (Windows, no admin)

Runs everything server-less: **Qdrant embedded** (on-disk, in-process) and **PostgreSQL in
user space** (via `initdb`/`pg_ctl`, no Windows service). SQLite is also supported as a drop-in
relational backend (`KP_POSTGRES_DSN=sqlite:data/kp.sqlite`).

```powershell
# one-time: initialize a user-space Postgres cluster (installed via `winget install PostgreSQL.PostgreSQL.16`)
& 'C:\Program Files\PostgreSQL\16\bin\initdb.exe' -D data\pgdata -U postgres --auth=trust --encoding=UTF8
.\scripts\pg.ps1 start                                   # start it (again after each reboot)
& 'C:\Program Files\PostgreSQL\16\bin\createdb.exe' -h localhost -U postgres kp

# point the pipeline at the local stores (embedded Qdrant = a filesystem path)
$env:KP_POSTGRES_DSN = "postgresql://postgres@localhost:5432/kp"
$env:KP_QDRANT_URL   = "$PWD\data\qdrant_local"          # non-http path => embedded Qdrant
```

pgAdmin (optional GUI) connects to `localhost:5432`, user `postgres`, no password, database `kp`.

### 2. Load assets into the stores

```powershell
$env:PYTHONPATH="src"
.\.venv\Scripts\python.exe scripts\load_stores.py --recreate
```

Set `KP_EMBEDDING_MODEL=hash` to skip the fastembed model download (offline, lexical vectors).

### 3. Register MCP servers with Droid

```powershell
.\.venv\Scripts\python.exe scripts\register_mcp.py       # writes .factory/mcp.json
```

Registers `qdrant`, `postgres`, `filesystem`, and `kp-workflows`. Droid can then call
`generate_quiz`, `generate_explanation`, `generate_learning_path` as MCP tools.

### 4. Trigger workflows

From Droid (via the `kp-workflows` MCP tools) or the CLI:

```powershell
.\.venv\Scripts\python.exe scripts\run_workflow.py quiz --topic "Linear Programming" --level jee_main --count 3
.\.venv\Scripts\python.exe scripts\run_workflow.py explanation --query "distance between two points"
.\.venv\Scripts\python.exe scripts\run_workflow.py learning_path --topic "Integrals" --target-level advanced
```

Add `--no-mcp` to bypass MCP and use direct store SDKs (useful without MCP servers running).

### Quiz output schema

Questions are emitted in the supplied target schema (a `{"question": {...}}` envelope with
`question_data._meta`, `options`, `variant`). Additive fields: `question_svg` and
`question_data.diagram` on the stem, and `svg` + `diagram` + `rationale` on each option, so
diagrams (function plots, coordinate/LPP, circle, triangle, angles, mensuration) render
deterministically on both the question and its options. `single_choice` vs `multi_choice` is
auto-detected. See `data/output/sample_quiz.json` for an example.

## Testing

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```
