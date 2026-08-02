# Project Transfer and Local Ollama Setup

This transfer contains the project source, generated assets, a PostgreSQL backup, and an
embedded Qdrant backup. Secrets, virtual environments, caches, and machine-specific runtime
files are intentionally excluded.

## Included backups

- `transfer/postgres/kp-full.dump`: PostgreSQL 16 custom-format dump containing books,
  concepts, chunks, quizzes, questions, and options.
- `transfer/qdrant/qdrant-local.tar.gz`: embedded Qdrant collection `kp_chunks`.
- `transfer/.env.example`: sanitized local configuration template.

Backup verification values:

- Questions: 170
- Question options: 680
- Qdrant collection: `kp_chunks`
- Qdrant points: 1288
- Embedding model: `BAAI/bge-small-en-v1.5`
- Embedding dimension: 384

## Prerequisites

Install:

1. Python 3.10 or newer.
2. PostgreSQL 16 or a compatible newer version.
3. Ollama.
4. Git and `tar` are optional but useful.

Tesseract OCR is optional. It is needed only when ingesting scanned documents, not when
restoring and using the existing question and vector data.

## 1. Extract the project

```powershell
tar -xzf ai-agent-work-qna-pdf-transfer-20260722.tar.gz
Set-Location ai-agent-work-qna-pdf
```

Linux or macOS:

```bash
tar -xzf ai-agent-work-qna-pdf-transfer-20260722.tar.gz
cd ai-agent-work-qna-pdf
```

## 2. Create the Python environment

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Linux or macOS:

```bash
python3 -m venv .venv
./.venv/bin/python -m pip install --upgrade pip
./.venv/bin/python -m pip install -r requirements.txt
```

For tests and optional hosted providers:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

## 3. Restore PostgreSQL

Create a local user and empty database. Replace `CHOOSE_A_PASSWORD` with a new password.

```powershell
psql -U postgres -c "CREATE ROLE kp LOGIN PASSWORD 'CHOOSE_A_PASSWORD';"
createdb -U postgres -O kp kp
pg_restore --exit-on-error --no-owner --no-privileges `
  -U kp -d kp transfer/postgres/kp-full.dump
```

If the `kp` role or database already exists, do not recreate it. Restore into an empty
database. On Windows, PostgreSQL tools may need their full path, for example:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\pg_restore.exe" `
  --exit-on-error --no-owner --no-privileges `
  -U kp -d kp transfer/postgres/kp-full.dump
```

Verify:

```powershell
psql -U kp -d kp -c "SELECT COUNT(*) AS questions FROM questions;"
psql -U kp -d kp -c "SELECT COUNT(*) AS options FROM options;"
```

Expected values are 170 questions and 680 options.

## 4. Restore embedded Qdrant

The transferred configuration uses embedded Qdrant, so Docker is not required.

```powershell
New-Item -ItemType Directory -Force data/qdrant_local | Out-Null
tar -xzf transfer/qdrant/qdrant-local.tar.gz -C data/qdrant_local
```

Linux or macOS:

```bash
mkdir -p data/qdrant_local
tar -xzf transfer/qdrant/qdrant-local.tar.gz -C data/qdrant_local
```

Do not run two application processes against the embedded Qdrant directory simultaneously.
For multi-process or remote access, use the Qdrant server image in `docker-compose.yml` and
reindex the included generated assets.

## 5. Configure the project

Windows:

```powershell
Copy-Item transfer/.env.example .env
```

Linux or macOS:

```bash
cp transfer/.env.example .env
```

Edit `.env` and set `POSTGRES_PASSWORD` to the password created above. Keep:

```dotenv
KP_PROVIDER=local
KP_LOCAL_LLM_BASE_URL=http://127.0.0.1:11434/v1
KP_LOCAL_LLM_MODEL=qwen2.5:7b-instruct
KP_QDRANT_URL=data/qdrant_local
KP_QDRANT_COLLECTION=kp_chunks
KP_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
KP_EMBEDDING_DIM=384
```

Never commit or share `.env`.

## 6. Install and run Ollama

Install Ollama from <https://ollama.com/download>, then download the configured model:

```powershell
ollama pull qwen3.6:35b
ollama list
```

Start Ollama if it is not already running:

```powershell
ollama serve
```

The project uses Ollama's OpenAI-compatible endpoint at
`http://127.0.0.1:11434/v1`.

Machines with more memory can use a larger model by running `ollama pull MODEL_NAME` and
changing `KP_LOCAL_LLM_MODEL` in `.env`.

## 7. Start the application

Windows:

```powershell
.\.venv\Scripts\python.exe scripts\api_server.py
```

Linux or macOS:

```bash
./.venv/bin/python scripts/api_server.py
```

Open:

- Main application: <http://127.0.0.1:8000/>
- Question player: <http://127.0.0.1:8000/player>
- Diagram library: <http://127.0.0.1:8000/diagrams>
- API documentation: <http://127.0.0.1:8000/docs>

## 8. Validate the restored system

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

Check the API:

```powershell
curl.exe http://127.0.0.1:8000/api/health
curl.exe "http://127.0.0.1:8000/api/player?subject=Mathematics&limit=5"
```

If PostgreSQL authentication fails, confirm the `.env` password and that PostgreSQL accepts
local password authentication. If Ollama generation fails, confirm `ollama list`, verify the
configured model name, and ensure port 11434 is reachable.
