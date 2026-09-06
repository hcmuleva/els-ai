# tbd/ — to-be-decided

Everything here was moved out of the active repository tree because it has **zero
references** from any build script, Kubernetes manifest, CI workflow, or source
file (verified by repo-wide grep before each move). Nothing was deleted; this is
a holding area for review. If anything here turns out to still be needed,
move it back to its original location.

## What's here and why

- **`ai-qna-poc/`** — standalone Python proof-of-concept (CBSE Q&A generator).
  Not wired into the Node/TS backend, `package.json` workspaces, or any Dockerfile.
- **`question-factory/`** — standalone Python offline question-generation tool.
  Same story: no references from the backend, frontend, or build scripts.
- **`transfer/`** — one-off demo-analytics migration artifacts
  (`demo-analytics-migration.sql`, generator script, accounts JSON). Only
  referenced by its own README with manual commands; not run by any script.
- **`k8s-legacy-per-service/`** — the 11 individual per-service Kubernetes
  manifests (`auth-service.yaml`, `quiz-service.yaml`, `classroom-service.yaml`,
  `achievement-service.yaml`, `question-bank-service.yaml`, `content-service.yaml`,
  `topic-service.yaml`, `assignment-service.yaml`, `org-service.yaml`,
  `notification-service.yaml`, `story-service.yaml`) that used to live in
  `k8s-els-ai/`. They were superseded by the consolidated `core-api.yaml` /
  `workers.yaml` deployment and are no longer listed in
  `k8s-els-ai/kustomization.yaml` or `kustomization-consolidated.yaml`.
- **`k8s-config-repo-legacy-per-service/`** — the same 11 manifests' counterparts
  that lived in `k8s-config-repo/` (the CI-tracked GitOps mirror). Moved here
  once `k8s-config-repo/` was updated to the consolidated 6-unit
  `kustomization.yaml` (`core-api.yaml`, `workers.yaml`, `migrations-job.yaml`,
  `media-service.yaml`, `ai-service.yaml`, `gateway.yaml`, `frontend.yaml`) to
  match what `k8s-els-ai/` already deploys and what the rewritten
  `.github/workflows/build-and-push.yml` now builds/pushes.
- **`backend-legacy-services/`** — the 11 original per-service backend folders
  (`auth-service`, `org-service`, `topic-service`, `content-service`,
  `question-bank-service`, `quiz-service`, `classroom-service`,
  `assignment-service`, `achievement-service`, `story-service`,
  `notification-service`). Their `src/` code was physically relocated into
  `backend/core-api/src/services/<name>/` (all cross-service imports were
  already limited to shared `@els-ai/*` packages, so this was a pure move, not
  a rewrite). What's left in each folder here is inert: `dist/`, `package.json`,
  `.env`, `tsconfig.json`, `README.md`, and the standalone `src/server.ts` that
  is no longer executed by anything.
- **`legacy-scripts/`** — `build-all-images.sh` and `push-all-images.sh`
  (superseded by `build-els-images.sh` / `push-els-images.sh`, which build the
  consolidated image set instead of 14 per-service images), plus one-off root
  scripts (`alter_db.cjs`, `check_youtube.cjs`, `fetch_best_youtube.js`,
  `fix_youtube_links.js`, `patch_fetch.cjs`, `patch_quizzes.cjs`,
  `test_search.js`, `test_yt.js`) with no callers anywhere in the repo. The
  active, still-used equivalents (e.g. `scripts/lkg_fix_youtube_links.cjs`,
  `scripts/migrate.cjs`, `scripts/manage-services.js`) were left in place.
- **`legacy-assets/`** — `EmptyPicolo.jpg`, `EmptyPicoloFrame`,
  `teacher_report.png`, `logo.png`, `bader_list.csv`, `karnataka_bader.xlsx`.
  Unreferenced by any code, doc, or config.
- **`legacy-docs/`** — `KPI_Implemnetation_Guide`, `Roadmap.md` (empty file),
  `Youtube.md`, `Funfacts.md`. Reference material, not linked from any README
  or code.
- **`legacy-data/`** — `Shivir_any.json`. Note: `Shivir_part1.json` is still
  actively used by `scripts/create_sanskar_shivir_content.cjs`,
  `scripts/create_sanskar_shivir_classroom.cjs`, and
  `scripts/prod_kothnuru_sanskar_shivir.cjs`, so it was **not** moved.
  `Shivir_any.json` only referenced itself and had no external callers.

## Flagged for attention: `sensitive-review/server-b.yaml`

This is a raw kubeconfig containing an **embedded client certificate and
private key** for a live cluster endpoint (`13.55.203.78:6443`). It had no
references anywhere in the repo (no script sets `KUBECONFIG` to it). Recommend
you either delete it or, if the credential is still valid and unrelated to
decommissioned infrastructure, **rotate/revoke it** rather than leaving it
sitting in a repository. It was moved here rather than left at the repo root,
but moving a credential does not reduce its exposure if this repository is
ever pushed anywhere it has been before.

## Explicitly NOT moved (still in active use)

- `k8s-config-repo/` — this is the directory the GitHub Actions workflow
  (`.github/workflows/build-and-push.yml`) checks out and commits updated
  image tags into (`cd config-repo/k8s-config-repo`) on every push to `main`.
  It is live GitOps state, not a stale duplicate. It now mirrors the
  consolidated 6-unit manifest set (see `k8s-config-repo-legacy-per-service/`
  above for what was removed from it).
- `k8s-els-ai/` — gitignored, used by the manual `deploy-k8s.sh` (rsync + ssh)
  deployment path; this is where the consolidated `core-api`/`workers`/
  `media-api`/`education-ai-api` manifests now live.
- `backend/core-api/`, `backend/workers/`, `backend/gateway/`,
  `backend/media-service/`, `backend/ai-service/` — the 5 backend units that
  now contain all backend source code and are what CI builds/pushes and what
  `k8s-els-ai/` and `k8s-config-repo/` deploy.
- `scripts/` — active content-authoring toolkit (referenced by `package.json`
  scripts and cross-referenced by other scripts in the same folder).
- `Dockerfile.all-in-one` — explicitly documented in
  `docs/els-ai-v2/ELS_BACKEND_ARCHITECTURE.md` as a supported local-demo
  option.
