# Pending / Deferred Items

A running list of things found during the `CLIENT_PLAN.md` backlog work that were **intentionally not fixed** — either because they need a product decision, are out of scope for the item that surfaced them, or were explicitly scoped down. Nothing here is forgotten; it's parked until someone decides to act on it.

---

## 1. Needs a product decision

### Fake XP/points data in `app/(tabs)/reports.tsx`
Real users are shown made-up numbers today:
- `STUDENT_SUMMARY.totalXp` / `weeklyXp` — hardcoded fallback constants, not read from any database column.
- Per-activity XP values (50 for a quiz, 20 for content, 35 for practice, etc.) — fixed literals, not computed from anything.
- Fake relative timestamps in the "recent activity" list (`"Today · 10 min ago"`) when no real classroom data is available.

This looks like legacy scaffolding from before the real, backend-driven analytics (`analytics.summary.*`, `/achievements/my`) existed elsewhere in the app (e.g. `index.tsx`'s home screen, which is fully real). Streaks and achievements are **not** affected — those are already real and backend-computed (see §3).

Options, not yet decided:
- Remove/hide the XP section — showing fabricated numbers to real users is misleading.
- Build a real XP system: a backend column (e.g. `student_analytics.xp_total` or similar) plus a per-activity-type XP rule, computed the same way streaks already are.
- Leave it as-is for now (this entry exists so it isn't lost).

---

## 2. Dark mode (P1-7)

Deferred entirely per explicit decision — **light mode only for now**. No theme engine, no toggle, no dark palette. Revisit if/when there's appetite for it; `theme/index.ts` would need a parallel dark palette (contrast-verified the same way the light palette was) and a `ThemeProvider`/context, since `Colors` is currently a static export consumed directly by ~26 files.

---

## 3. Gamification (P1-8) — confirmed done, no action needed

Checked and closed: streaks (`student_analytics.streak_days`, computed server-side) and achievements (teacher-granted via `/achievements/grant`, listed via `/achievements/my`) are both fully real and already rendered on the student home screen. Recorded here only so it isn't re-opened as "needs new backend fields" — it doesn't.

---

## 4. Accessibility — deferred, non-color-contrast findings

All color-contrast violations app-wide are fixed (see `CLIENT_PLAN.md` §4 item 6). These remaining `agent-browser a11y` findings are unrelated to color and were explicitly left out of that pass:

- `aria-progressbar-name` on `ActivityIndicator` — 165 occurrences app-wide.
- Settings screen's missing form `label`s — 3 nodes, reproduced across every role.
- Student Reports screen's `scrollable-region-focusable`.
- `subject.tsx`'s skip-nav `bypass` finding.
- `aria-hidden-focus` — a "needs manual review" (incomplete, not a confirmed violation) finding seen on admin/teacher screens; likely a decorative/portal element, not yet root-caused.
- `JigsawRenderer.tsx`'s empty-slot placeholder number ("1", "2", …, `#CBD5E1` on `#F0F5FF`, ~1.4:1) — flagged as "needs manual review" (incomplete), not a confirmed violation. Looks like an intentional faint watermark (covered once a piece is placed, redundant with the visible grid layout), so left as-is rather than guessing at a design change.

---

## 5. "Proof of pattern" passes that are intentionally incomplete

These backlog items were shipped as a working example on a subset of the codebase rather than a full sweep, because this repo has **no git history** (`git status` → "not a git repository") and bulk changes across files this size have no revert safety net without one.

- **Design tokens (P0-2):** `CustomTabBar.tsx`, `NotificationBell.tsx`, `ProfileMenu.tsx`, `RoleSwitcher.tsx`, `app/(tabs)/_layout.tsx` migrated onto `theme/index.ts`. `manage.tsx`, `planner.tsx`, `QuestionDumpTab.tsx`, and others still have local hardcoded hex/color consts.
- **`Card` component (P0-3):** one instance each migrated in Planner and Manage. Both files (~2,400 and ~6,000 lines) have dozens more ad hoc card sites.
- **React Query (P1-5):** Planner's classroom list and Manage's subject catalog converted to `useQuery`. Both files still have many more hand-rolled `useState` + `apiFetch` flows (content items, quizzes, questions list, bookmarks, activity counts, etc.).

---

## 6. Longer-standing infra items (carried over, still unaddressed)

- No git repository initialized anywhere in this checkout — every change made this session has no revert/checkpoint safety net.
- 38 `npm audit` vulnerabilities, unaddressed.
- 67 pre-existing frontend TypeScript errors (tracked as a stable baseline throughout — confirmed not growing, but not fixed either).
- Plaintext secrets in the backend `.env`.
- CI/GitOps workflow exists but is untested end-to-end.
- Ollama isn't running; `OLLAMA_BASE_URL` is a placeholder — AI chat isn't wired to a real LLM instance yet.
