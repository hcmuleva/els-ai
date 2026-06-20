# ai-qna-poc

Proof-of-concept service that generates **book-format** exam questions for
CBSE **Class 10 / Class 12** in **Physics, Chemistry, Mathematics, Biology**.

You pick selectors (class, subject, difficulty, count, question types). The
service finds a real CBSE paper PDF from a Hugging Face dataset, extracts its
text, infers the topic, generates similar questions, validates them, and returns
strict JSON. Every stem, option, and explanation is written in
**markdown + LaTeX** so your app can render it with a markdown + KaTeX/MathJax
renderer and the formulas look like they came out of a textbook.

> The "LLM" in this POC is a Droid-authored question bank plus parametrised
> numerical generators. A real OpenAI-compatible provider can be plugged in via
> environment variables without touching the pipeline.

---

## Pipeline

```
Selector input
      │
      ▼
[Retriever]  → Hugging Face dataset (AdithyaSNair/cbse-papers-2009-2025)
      │         finds Class_XX / Subject / *.pdf, downloads bytes
      │         (falls back to bundled sample text when offline)
      ▼
[Parser]     → pypdf text extraction + keyword-based topic detection
      │
      ▼
[Generator]  → active provider produces book-format raw questions
      │         (Droid-authored bank + parametrised numericals)
      ▼
[Validator]  → normalises to strict schema, checks answer keys,
      │         dedupes, verifies balanced $...$ / $$...$$ math
      ▼
JSON response
```

Each stage lives in `app/agents/` and is orchestrated by `app/pipeline.py`.

---

## Project layout

```
ai-qna-poc/
├── app/
│   ├── main.py                 # FastAPI app + routes
│   ├── config.py               # env-driven settings
│   ├── schemas.py              # request + book-format response models
│   ├── pipeline.py             # Retriever → Parser → Generator → Validator
│   ├── agents/
│   │   ├── retriever.py        # live HF fetch + sample fallback
│   │   ├── parser.py           # PDF→text + topic detection
│   │   ├── generator.py        # provider wrapper
│   │   └── validator.py        # normalise + validate + dedupe
│   ├── providers/
│   │   ├── base.py             # LLMProvider interface
│   │   ├── droid_authored.py   # the POC "LLM" (bank + numerical generators)
│   │   └── external_llm.py     # optional OpenAI-compatible provider
│   ├── formatting/book_format.py
│   └── data/
│       ├── authored_bank.py    # curated book-format questions
│       └── sample_corpus/      # offline fallback paper text
├── samples/
│   ├── sample_request.json
│   └── sample_output_physics_class12.json
├── tests/test_pipeline.py
├── requirements.txt
├── run.sh
└── .env.example
```

---

## Setup & run

```bash
cd ai-qna-poc
cp .env.example .env          # optional; defaults are fine

# one command (creates venv, installs, runs with reload)
./run.sh

# or manually
python3 -m venv .venv
./.venv/bin/python -m pip install -r requirements.txt
./.venv/bin/python -m uvicorn app.main:app --reload --port 4500
```

Server: `http://localhost:4500` — interactive docs at `/docs`.

Run tests (offline, sample mode):

```bash
PDF_SOURCE_MODE=sample ./.venv/bin/python -m pytest -q
```

---

## API

### `GET /health`
Service status and active modes.

### `GET /options`
Selector values for the client UI:

```json
{
  "class_level": ["10", "12"],
  "subject": ["physics", "chemistry", "mathematics", "biology"],
  "difficulty": ["easy", "medium", "hard"],
  "types": ["sc", "mcq", "tf"],
  "count": { "min": 1, "max": 30, "default": 10 }
}
```

### `POST /generate`

Request:

```json
{
  "class_level": "12",
  "subject": "physics",
  "difficulty": "medium",
  "count": 10,
  "types": ["sc", "mcq", "tf"],
  "topic": null,
  "seed": 42
}
```

| Field         | Type     | Notes                                              |
|---------------|----------|----------------------------------------------------|
| `class_level` | enum     | `10` or `12`                                       |
| `subject`     | enum     | `physics`, `chemistry`, `mathematics`, `biology`   |
| `difficulty`  | enum     | `easy`, `medium`, `hard`                           |
| `count`       | int      | 1–30 (default 10)                                  |
| `types`       | string[] | any of `sc` / `mcq` / `tf` (or full names)         |
| `topic`       | string?  | optional hint; inferred from the paper if omitted  |
| `seed`        | int?     | optional, for reproducible output                  |

Example:

```bash
curl -X POST http://localhost:4500/generate \
  -H 'Content-Type: application/json' \
  -d @samples/sample_request.json
```

---

## Output schema (book format)

```jsonc
{
  "meta": {
    "class_level": "12",
    "subject": "physics",
    "difficulty": "medium",
    "requested_count": 10,
    "returned_count": 10,
    "topic": "current_electricity",
    "allowed_types": ["single_choice", "multi_choice", "true_false"],
    "provider": "droid-authored",
    "format": "book-markdown-latex",
    "generated_at": "..."
  },
  "source": {
    "mode": "live",                 // live | sample
    "dataset": "AdithyaSNair/cbse-papers-2009-2025",
    "pdf_path": "2020/Class_12/Physics/....pdf",
    "pdf_url": "https://huggingface.co/datasets/.../resolve/main/....pdf",
    "detected_topic": "current_electricity",
    "text_chars": 13369,
    "note": null
  },
  "validation": {
    "passed": true,
    "checks": ["..."],
    "warnings": [],
    "deduped": 0
  },
  "questions": [
    {
      "id": "q1",
      "type": "single_choice",      // single_choice | multi_choice | true_false
      "title_markdown": "A wire of resistivity $\\rho$ ... resistance is:",
      "instruction": "Choose the one correct option.",
      "difficulty": "medium",
      "points": 10,
      "sort_order": 1,
      "options": [
        { "id": "q1_opt_1", "slot_position": 1, "label_markdown": "$4R$", "is_correct": true },
        { "id": "q1_opt_2", "slot_position": 2, "label_markdown": "$2R$", "is_correct": false }
      ],
      "answer_key": ["q1_opt_1"],
      "explanation_markdown": "Resistance is $R = \\rho\\dfrac{L}{A}$ ... $$R' = 4R.$$",
      "source_style_ref": "CBSE Class 12 Physics, Current Electricity (2-mark)"
    }
  ]
}
```

### Rendering on the client (book style)

`title_markdown`, every `options[].label_markdown`, and `explanation_markdown`
are markdown with LaTeX:

- inline math: `$...$`  → e.g. `$R = \rho\dfrac{L}{A}$`
- display math: `$$...$$` → centered block formula

Use a markdown renderer with a math plugin so formulas render like a textbook:

- React / web: `react-markdown` + `remark-math` + `rehype-katex`
- React Native: `react-native-markdown-display` + a KaTeX/MathJax view

The validator guarantees `$` / `$$` delimiters are balanced before returning.

---

## Configuration (`.env`)

| Variable             | Default                              | Purpose                                   |
|----------------------|--------------------------------------|-------------------------------------------|
| `PORT`               | `4500`                               | Server port                               |
| `PDF_SOURCE_MODE`    | `both`                               | `live` \| `sample` \| `both`              |
| `HF_DATASET`         | `AdithyaSNair/cbse-papers-2009-2025` | Source dataset                            |
| `HF_TIMEOUT_SECONDS` | `20`                                 | Network timeout                           |
| `GENERATION_PROVIDER`| `droid`                              | `droid` \| `external`                     |
| `OPENAI_API_KEY`     | _(empty)_                            | Required only for `external`              |
| `OPENAI_BASE_URL`    | `https://api.openai.com/v1`          | OpenAI-compatible endpoint                |
| `OPENAI_MODEL`       | `gpt-4o-mini`                        | Model name                                |

When `GENERATION_PROVIDER=external`, the external provider is used and falls
back to the Droid-authored bank on any error, so the POC always returns output.

---

## Extending

- **Add a topic/questions:** edit `app/data/authored_bank.py` (use the `sc`,
  `mcq`, `tf` builders). Add keywords in `app/agents/parser.py` so it is detected.
- **Add a numerical generator:** add a function in
  `app/providers/droid_authored.py` and register it in `_generators_for`.
- **Swap the LLM:** implement `LLMProvider.generate` (see `external_llm.py`).

---

## Limitations (POC scope)

- Subject coverage is curated for the four PCM/Biology subjects above.
- Live PDFs are large (2–3 MB); text extraction reads the first pages only.
- Generation does not yet mine the parsed paper text verbatim; the source paper
  conditions the **topic**, while content comes from the provider. Wiring a real
  LLM provider closes that gap.
