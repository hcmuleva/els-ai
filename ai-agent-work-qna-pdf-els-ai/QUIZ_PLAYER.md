# Quiz Player

An interactive, local web app to **play the generated quizzes**: it renders the
question and option SVG diagrams, lets you attempt each question, then reveals
**correct/incorrect** feedback with the explanation. Quizzes are read
dynamically from **either** the JSON files in `data/output/` **or** the
PostgreSQL database.

No extra dependencies - it uses the Python standard library only.

---

## Run it (one command)

From the repository root (`C:\personal\work\ai-agent-work-qna-pdf`):

```powershell
.\scripts\play_quiz.ps1 -Open
```

- Starts the server on **http://127.0.0.1:8000**
- `-Open` also opens your browser automatically
- Best-effort starts the local Postgres so the `[DB]` source works
- Press **Ctrl+C** in the terminal to stop the server

Options:

```powershell
.\scripts\play_quiz.ps1 -Port 8080   # different port
.\scripts\play_quiz.ps1 -NoDb        # JSON quizzes only (don't touch Postgres)
```

## Run it (manual, if you prefer)

```powershell
$env:PYTHONPATH="src"
$env:KP_POSTGRES_DSN="postgresql://postgres@localhost:5432/kp"
.\.venv\Scripts\python.exe scripts\quiz_server.py --port 8000
```

Then open **http://127.0.0.1:8000**.

---

## How to play

1. **Pick a quiz** from the dropdown at the top. Entries are tagged:
   - `[DB]`  - loaded from PostgreSQL
   - `[JSON]` - loaded from a file in `data/output/`
2. **Choose an answer** - a radio button for single-answer questions, or
   checkboxes for "select all that apply".
3. Click **Submit answer**. The correct option turns **green**, a wrong pick
   turns **red**, per-option notes appear, and the **explanation** opens.
4. Click **Next** to continue (use **Prev** / the progress bar to move around).
5. At the end you get a **score + review**; **Retake quiz** resets it.

---

## Where the quizzes come from

| Source | Location | Notes |
|--------|----------|-------|
| `[JSON]` | `data/output/*.json` | Any target-schema quiz file (e.g. `jee_math_quiz.json`) |
| `[DB]`   | PostgreSQL `kp` database | `quizzes` / `questions` / `options` tables |

Generate / refresh the JEE quiz any time:

```powershell
$env:PYTHONPATH="src"; $env:KP_POSTGRES_DSN="postgresql://postgres@localhost:5432/kp"
$env:KP_SUBJECT="Mathematics"; $env:KP_CLASS_LEVEL="Class 12"
.\.venv\Scripts\python.exe scripts\make_jee_quiz.py --level jee_main    # or --level jee_advanced
```

This writes `data/output/jee_math_quiz.json` **and** persists it to Postgres, so
it appears under both sources.

---

## Troubleshooting

- **Dropdown shows only `[JSON]` items** - Postgres isn't running. Start it with
  `.\scripts\pg.ps1 start`, then click **Reload list**.
- **"Port already in use"** - run with `-Port 8080` and open that port.
- **Nothing in the list at all** - generate a quiz first (see command above);
  quiz JSON files live in `data/output/`.
- **Diagrams look blank** - the SVG is embedded in the quiz data; regenerate the
  quiz if a file was edited by hand.

## API (used by the page)

- `GET /api/quizzes` - lists available quizzes from DB and JSON
- `GET /api/quiz?source=json&id=<file.json>` - one quiz from a JSON file
- `GET /api/quiz?source=db&id=<quiz_id>` - one quiz from PostgreSQL
