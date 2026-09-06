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

All color-contrast violations app-wide are fixed (see `CLIENT_PLAN.md` §4 item 6). The non-color findings from that same sweep were closed out in a follow-up pass (git now exists as a safety net, and none of them needed a product decision):

- ~~`aria-progressbar-name` on `ActivityIndicator` — 165 occurrences app-wide.~~ ✅ Fixed — scripted sweep added `accessibilityLabel="Loading"` to all 165 (43 files); `tsc --noEmit` 0 new errors.
- ~~Settings screen's missing form `label`s — 3 nodes, reproduced across every role.~~ ✅ Fixed — `accessibilityLabel`/`accessibilityHint` added to the 3 `<Switch>` rows in `settings.tsx`.
- ~~Student Reports screen's `scrollable-region-focusable`.~~ ✅ Fixed — web-only `tabIndex={0}` added to `ParentReports`'s tab-content `ScrollView` in `reports.tsx`.
- ~~`subject.tsx`'s skip-nav `bypass` finding.~~ ✅ Fixed — added `accessibilityRole="header"` to the subject-list and topic-detail screen titles (this route hides the tab bar and had no other heading/landmark).
- ~~`aria-hidden-focus` — a "needs manual review" (incomplete, not a confirmed violation) finding seen on admin/teacher screens.~~ ✅ Fixed and generalized — root-caused to a React Navigation web stack-transition artifact (outgoing screens stay mounted `aria-hidden="true"` but keep `tabindex="0"` on their buttons). New `src/hooks/useInertAriaHidden.ts` hook syncs the native `inert` attribute onto any `aria-hidden="true"` element app-wide; wired into `app/_layout.tsx`.
- `JigsawRenderer.tsx`'s empty-slot placeholder number ("1", "2", …, `#CBD5E1` on `#F0F5FF`, ~1.4:1) — flagged as "needs manual review" (incomplete), not a confirmed violation. Looks like an intentional faint watermark (covered once a piece is placed, redundant with the visible grid layout), so left as-is rather than guessing at a design change. **Still open.**

---

## 5. "Proof of pattern" passes that are intentionally incomplete

These backlog items were shipped as a working example on a subset of the codebase rather than a full sweep, because this repo has **no git history** (`git status` → "not a git repository") and bulk changes across files this size have no revert safety net without one.

- **Design tokens (P0-2):** `CustomTabBar.tsx`, `NotificationBell.tsx`, `ProfileMenu.tsx`, `RoleSwitcher.tsx`, `app/(tabs)/_layout.tsx` migrated onto `theme/index.ts`. `manage.tsx`, `planner.tsx`, `QuestionDumpTab.tsx`, and others still have local hardcoded hex/color consts.
- **`Card` component (P0-3):** one instance each migrated in Planner and Manage. Both files (~2,400 and ~6,000 lines) have dozens more ad hoc card sites.
- **React Query (P1-5):** Planner's classroom list and Manage's subject catalog converted to `useQuery`. Both files still have many more hand-rolled `useState` + `apiFetch` flows (content items, quizzes, questions list, bookmarks, activity counts, etc.).

---

## 6. Longer-standing infra items (carried over, still unaddressed)

- ~~No git repository initialized anywhere in this checkout — every change made this session has no revert/checkpoint safety net.~~ ✅ Done — `git init`, `.gitignore` verified correct (already excluded `node_modules`/`.env*`/secrets/dumps/logs), initial baseline commit made on `main` (~2,250 files, 62MB). All work from this point on has a real revert safety net.
- 38 `npm audit` vulnerabilities, unaddressed.
- 59 pre-existing frontend TypeScript errors (tracked as a stable baseline throughout — confirmed not growing, but not fixed either; the "67" figure quoted earlier in this doc was an imprecise early reading, superseded by a clean re-measurement).
- Plaintext secrets in the backend `.env`.
- CI/GitOps workflow exists but is untested end-to-end.
- Ollama isn't running; `OLLAMA_BASE_URL` is a placeholder — AI chat isn't wired to a real LLM instance yet.

---

## 7. New bug found during the a11y follow-up pass — not fixed

### `NotificationContext.tsx` — intermittent crash on direct URL navigation
Reproduced on both `/settings` and `/reports`, on more than one role: navigating straight to the URL (a hard refresh or a deep link, not in-app navigation) intermittently throws an uncaught error from Ably's `stopRealtime()` — "Connection closed" / "only close a connection that's actually still live" — which surfaces as a full dev-mode error overlay. There is already a connection-state guard in `stopRealtime()` intended to prevent exactly this, but it doesn't fully close the race: on a fresh page load, the realtime connection can still be mid-setup (or mid-teardown from a fast-refresh) when something else calls `stopRealtime()`, and the guard's state check doesn't cover that window.

This wasn't hit by chance — it reproduced on repeat, independent attempts, on two different screens. Since real users do refresh browsers and open bookmarked/shared links directly, this is a genuine production risk, not just a dev-server quirk (though dev mode's error overlay makes it more visible than production's silent error boundary would). Not fixed here because it surfaced as a side effect of unrelated a11y testing and needs proper root-causing (likely an async guard/cleanup-ordering issue in the Ably connection lifecycle, not a one-line fix) rather than a quick patch.

---

## 8. Responsive multi-column layouts for large screens — done

User-requested: Reports (teacher/admin/parent) and Planner's Analytics tab were rendering strictly single-column even on wide laptop/monitor viewports, wasting horizontal space. Investigated first whether this was a container-width bug (grepped for `maxWidth`, checked computed styles/`getBoundingClientRect` at 1600px) — it wasn't; content already spans the full viewport width. The real issue was that comparable sections (paired charts, stat cards) were stacked one under another instead of using the available width.

Reused the codebase's existing `useWindowDimensions()` + `width >= N` breakpoint convention (already used in ~9 other files at a 768px "tablet" threshold for modals) with a new `1024` threshold for "laptop/monitor" — additive only, mobile/tablet layouts are byte-for-byte unchanged since the new row wrappers only activate `flexDirection: "row"` above 1024px.

- **`ParentReports`** (parent + student Reports Overview, `app/(tabs)/reports.tsx`): "Time Spent per Day" and "Daily Completion Rate" bar charts now render side-by-side on large screens (new `chartsGridRow`/`chartsGridCol` styles).
- **`ReportsScreen`** (teacher/admin Dashboard, same file): the 4 top-line stat cards render 4-across instead of 2×2; "Class Performance" and "Topic Gaps" cards render side-by-side. "Student Activity" (a variable-length list) stays full-width — lists don't compress well into narrow columns.
- **`ClassDetailsScreen`** (Planner → classroom "Details" → Analytics tab, `src/components/classroom/ClassDetailsScreen.tsx`): the 3 `MiniBarChart` summary sections (Avg Teacher Score, Quizzes Completed, Assignments Submitted) render side-by-side. "Student Breakdown" (a data table) stays full-width for the same reason.

Verified via `tsc --noEmit` (steady at the 59-error baseline, zero new/resolved) and live `agent-browser` checks at 1600×950 (large) and 390×844 (mobile) for all three screens — row layout activates correctly on large screens, mobile stacking is unaffected.

Not yet covered (candidates for a follow-up if the user wants a broader pass): any other dashboard-style screen not explicitly called out (e.g. `manage.tsx`'s content/question list views), and non-layout "professional styling" polish (typography, spacing, shadows) beyond column/row restructuring.
