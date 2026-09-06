# Pending / Deferred Items

A running list of things found during the `CLIENT_PLAN.md` backlog work that were **intentionally not fixed** — either because they need a product decision, are out of scope for the item that surfaced them, or were explicitly scoped down. Nothing here is forgotten; it's parked until someone decides to act on it.

---

## 1. Fake XP/points data in `app/(tabs)/reports.tsx` — resolved (removed)

**Decision:** remove the fake XP section entirely (no real backend-driven XP system needed).

Investigating this turned up something better than a simple "hide the numbers" patch: the entire code path serving the fake XP (`STUDENT_SUMMARY.totalXp`/`weeklyXp`, the 50/20/35-point per-activity literals, and the fake `"Today · 10 min ago"` timestamps) lived in a `ReportsScreen` fallback render branch guarded by `role` checks that **can never be true** — `UserRole` only ever takes `student | teacher | parent | admin | superadmin`, and each of those is already handled by an earlier `return` (parent/student roles return `<ParentReports mode=... />`, teacher/admin/superadmin return the real teacher dashboard). This was orphaned scaffolding from before `ParentReports` gained `mode="student"` support — it hadn't rendered in production for a while, but it was still costing a real, wasted `/classrooms/student` fetch on every focus for parent/student roles (whose result was then discarded).

Removed, all confirmed to have no other callers first:
- The unreachable "STUDENT VIEW" render branch and its `stats`/`recentActivity`/`chartData`/`todayIdx`/`activeSubject`/`period`/`classroom` state and derived values.
- Its exclusive helper components: `AnimatedBar`, `BarChart` (+ `bc` styles), `ScoreSparkline`, `SubjectModal` (+ `m` styles) — none were used anywhere reachable.
- The now-fully-unused `src/data/studentMockData.ts` (its own header comment: *"Replace individual fields with real API calls as endpoints become available"*) and its imports (`CHART_DATA`, `SUBJECT_DETAILS`, `STUDENT_SUMMARY`, `BADGES_DATA`, plus now-unused `react-native-reanimated`/`react-native-svg` imports and the `Star`/`Flame` icons).
- Simplified `loadData`'s parent/student branch to a no-op comment, since `ParentReports` fetches its own data independently — removing one redundant network round-trip per screen focus for those roles.

Real gamification data (streaks, achievements) was never affected — see §3. Verified via `tsc --noEmit` (steady at the pre-existing 59-error baseline, zero new/resolved) and live checks of teacher Dashboard and student Overview after the removal — both render identically to before.

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

**Follow-up survey** (user confirmed "similarly other also" applies — check other dashboard-style screens for the same issue): checked `admin.tsx` (only a `logoGrid` picker + tab-based CRUD tables, no stat-dashboard stacking issue), `manage.tsx` (only option pills, not dashboard cards), `counseling.tsx` (single summary card, not multi-section), `index.tsx` (student home's `tilesGrid` subject tiles — already a multi-column grid, not a candidate). Found one more genuine case:

- **`TrendAnalysisTab`** ("Growth Trends" tab within Reports, `src/components/reports/TrendAnalysisTab.tsx`) — a 16-section holistic student analytics report that stacked every section full-width, single-column, regardless of viewport. Added the same `useWindowDimensions()` + `isLargeScreen = width >= 1024` pattern and paired 4 more section-groups into responsive rows (new `a.rowItem` style, `flex: 1, minWidth: 0`, only applied above 1024px):
  - Academic Performance (3) + Non-Academic Development (4)
  - Teacher Feedback (6) + Parent Feedback (7)
  - Risk Prediction (11) + Benchmark Comparison (12)
  - Growth Milestones (13) + Future Projection (14)

  Left untouched: Growth Summary (1, hero card), Journey Timeline (2, wide table), Attendance & Participation (5, dense strip), Counseling Impact (8), Strengths/Focus Areas (9+10, already had a pre-existing unconditional `splitRow` side-by-side layout), Personalized Recommendations (15), Executive Summary (16).

  Verified via `tsc --noEmit` (59, 0 new/resolved) and live `agent-browser` checks at 1600×950 and 390×844 using a seeded demo account with real data (`rahul@els.ai`, the multi-child demo student) — 3 of the 4 pairs were visually/DOM-position confirmed side-by-side on desktop and single-column on mobile; the 4th pair's second section ("Future Projection") didn't render for this student (pre-existing data-sufficiency guard, `academicAligned` needs ≥2 points — unrelated to this change) but uses the identical wrapper pattern as the other 3 confirmed pairs.

  Incidentally reproduced the known intermittent `NotificationContext.tsx`/Ably "Connection closed" crash (see §7) once during this verification pass — confirms it's a real, reproducible issue, still not investigated/fixed.

Not yet covered (candidates for a follow-up if the user wants a broader pass): non-layout "professional styling" polish (typography, spacing, shadows) beyond column/row restructuring.

---

## 9. P2 item 9 — multi-agent AI router — done (Ollama-only, extensible)

Before writing any code, checked what Factory's public API (`api.factory.ai`, the `FACTORY_API_KEY` the user added to `backend/core-api/.env`) actually exposes: platform-management endpoints only (CI automations, Droid Computers, Organization/Service-Account admin, AutoWiki, and a **Droid Sessions API** for driving coding-agent sessions — gated to select orgs). There is no general chat/completion endpoint. Wiring "Factory AI" to the Sessions API would mean spinning up a real coding-agent session (shell/file access, billable compute) per chat message — not an appropriate fit for a student/teacher/parent tutor chat. Flagged via `AskUser` rather than guessing; user confirmed:
1. Skip Factory AI for now (revisit if Factory ships a plain completion API).
2. Skip Microsoft Copilot too (no credentials provided).
3. Build the router abstraction (provider interface, fallback, permissions, cost/usage log) with Ollama as the only working provider, ready to plug in real providers later. No frontend provider-selector UI yet (explicitly out of scope per the user's answer).

**What shipped**, all in `backend/ai-service/src/agents/`:
- `types.ts` — the `AgentProvider` interface (`id`, `label`, `isAvailable()`, `stream()`) every provider implements, plus the event types the router emits.
- `ollamaProvider.ts` — wraps the existing Ollama wire client (`chat/ollamaClient.ts`, which now also surfaces `prompt_eval_count`/`eval_count` token counts from Ollama's final `done` chunk) in that interface.
- `router.ts` — `AgentRouter`: builds a fallback chain (explicitly-requested provider first, then the rest in registration order), a per-role provider allowlist (`ROLE_PROVIDER_ALLOWLIST`, permissive today since there's one free provider and nothing to gate), and falls over to the next candidate **only if the current one fails before yielding any content** — once a provider starts streaming text back, a failure is surfaced as an error rather than silently splicing in a different provider's reply mid-response.
- Cost/audit trail: new `ai_provider_usage` table in `core-api` (`services/aichat/db.ts`) + `POST /ai-usage` (called by `ai-service` after every chat request, success or failure) + `GET /ai-usage/summary` (admin/superadmin-only, per-provider request/success/token/duration aggregates) — gateway-proxied at `/ai-usage` alongside `/ai-conversations`.
- `routes/chat.ts`: now runs every chat request through `agentRouter.run()` instead of calling Ollama directly; accepts an optional `provider` field (validated, unused by any UI yet); records usage via the new endpoint; adds `GET /ai/chat/providers` (role-filtered registered-provider list) for whenever a selector UI is built.

Verified: `tsc --noEmit` clean across `ai-service`, `core-api`, and `gateway` (0 errors in each). Restarted the local dev stack (`npm run services:restart`) and live-tested end-to-end via curl: `GET /ai/chat/providers` returns `[{id: "ollama", ...}]`; a chat request with Ollama unreachable surfaces the same graceful "Could not reach Ollama" error as v1, now attributed correctly to `provider: "ollama"` in `ai_provider_usage` (fixed a real bug caught during this testing — see below); requesting an unknown provider id returns a clean error instead of a crash; a non-admin hitting `/ai-usage/summary` gets 403; user-message persistence is unaffected by an AI failure. Deleted the 3 test conversations created during this pass.

**Bug found and fixed during verification:** the router originally only learned which provider it was using from the events that provider yielded — so a provider that failed before yielding anything (e.g., Ollama unreachable) logged as `provider: "unknown"` in the usage table, making the audit trail useless for exactly the failure case it exists to capture. Fixed by having the router yield an `{ type: 'attempt', providerId }` marker immediately before trying each candidate, so the usage log always attributes correctly even on an instant failure.

**Unrelated side-effect found and fixed during verification:** logging in as the seeded `teacher@els.ai` account returned `role: "student"` in the JWT — its `active_role` column had been left on "student" from this session's earlier `agent-browser` role-switcher testing (before this conversation was compacted) and never switched back. Restored via the app's own `PATCH /users/:id/active-role` endpoint (as `super@els.ai`) rather than a raw DB edit. Not a bug in this session's code — a leftover test-data artifact from manual UI testing — but worth restoring since it's a shared demo account.

**Deferred, by decision:** Factory AI and Microsoft Copilot providers (no working API/credentials — see above); a frontend provider-selector UI (the wire contract exists via the optional `provider` field and `/ai/chat/providers`, but no chat-panel dropdown was built).

---

## 10. P2 item 10 — Teacher/Admin AI analytics (weak-student identification, risk detection, forecasts) — done

Surveyed what already existed before writing anything: the teacher Dashboard already had a per-student quiz-average list (`Student Activity`) with no flagging or sort-by-need; the parent/student Growth Trends report (`TrendAnalysisTab`) already had a working risk-classification and linear-forecast pattern, but only for one student at a time, defined inline and not reused anywhere; the Admin Dashboard had no analytics section at all. Used `AskUser` to pin down methodology and scope before building:
1. Risk definition — clarified with the user, then confirmed: extract the existing single-student heuristics so they're reusable everywhere instead of reimplementing a second definition of "risk."
2. Teacher UI — enhance the existing Student Activity list (sort worst-first, add a risk badge), not a separate new section.
3. Admin scope — build a full new "School Analytics" section now (risk distribution, at-risk roster, performance trend + forecast), since none existed.
4. Forecast method — the same linear-trend projection already used for the single-student forecast, extended to class/school level, until a dedicated forecasting service exists. Per the user: a separate analytics/forecast API/service is expected to be built and deployed later; today's heuristic is written behind the same endpoint/function boundary specifically so that service can replace it without any caller changes (same pattern as the Ollama-only `AgentProvider` router in §9).

**What shipped:**
- `frontend/src/utils/riskForecast.ts` (new) — `riskFromScore`, `worstRisk`, `projectNext`, `forecastSeries` extracted out of `TrendAnalysisTab.tsx` verbatim (zero behavior change there, confirmed via `tsc` + identical error baseline). One shared definition of "risk" and "forecast" now backs all three surfaces.
- Teacher `Student Activity` list (`app/(tabs)/reports.tsx`): now sorted worst-first (highest risk band first, lowest score as tiebreak) via a `useMemo`, with a Low/Medium/High risk badge next to each student's name using the same colors as the parent report's `RiskRow`. Runs entirely on data already fetched — no new backend calls for the teacher side.
- Admin "Analytics" tab (new, `frontend/src/components/admin/SchoolAnalyticsTab.tsx`, wired into `app/(tabs)/admin.tsx`): risk distribution donut + counts, an at-risk roster sorted worst-first, and a weekly performance-trend line chart with a dashed forecast leg and a plain-language projection sentence. Backed by a new `GET /quizzes/admin/analytics` (admin/superadmin-only, `backend/core-api/src/services/quiz/routes/quizzes.ts`) returning raw per-student and weekly aggregates; all risk/forecast math happens client-side via the shared util.
- Exported `RISK_CLR` from `frontend/src/components/reports/charts.tsx` (was module-private) so the teacher list and the new Admin tab use the exact same badge colors as the parent report.

**Bug found and fixed during verification (real, not cosmetic):** the first version of `GET /quizzes/admin/analytics` scored students from `student_attempts.score`/`total_points`, matching `/teacher/overview`'s existing summary formula. Live-testing against seed data caught it producing `averageScorePct: 0` for students with clearly non-zero real performance (confirmed against `/quizzes/teacher/class-activity` and a specific attempt's question-level detail for "Yashwant Seervi": real average 38.55%, not 0%). Root cause: `student_attempts.score/total_points` is unreliable in this dataset — many real attempts have `total_points = 0`, and `NULLIF(...,0)` silently drops them from the average instead of counting them as 0%. Switched to scoring from `question_attempts.is_correct` (matching `/teacher/class-activity`'s already-correct approach). That in turn exposed a *second*, different gap: the synthetic students seeded by `seed-demo-trends.ts` for Growth Trends testing have `student_attempts` rows with **no** `question_attempts` at all, so they scored a false 0% under the new formula too — and would have been wrongly promoted to the very top of both the new Admin roster and the now-worst-first-sorted teacher list. Fixed with a fallback: score from `question_attempts` when present, else fall back to `student_attempts.score/total_points`, else exclude the attempt. Applied identically to both `/quizzes/admin/analytics` and `/quizzes/teacher/class-activity` (the latter's existing `score_pct` computation gets the same fallback) so the two stay consistent. Re-verified via curl against the restarted `core-api` — "Yashwant Seervi" now correctly shows 38.55%, and the previously-false 0% synthetic students dropped out of the "needs attention" view entirely.

**Pre-existing issue found, left alone (out of scope for this item):** `/quizzes/teacher/overview`'s `summary.average_score_pct` and `classPerformance` stats still use the unreliable `student_attempts.score/total_points` formula described above, so that stat card likely overstates the org-wide average by silently excluding zero-`total_points` attempts rather than counting them as 0%. Not fixed here — it's a different, already-shipped surface (the top-line stat cards on the Teacher Dashboard) outside this item's brief, and changing its formula is a decision of its own since some other business logic might intend `total_points = 0` to mean "not gradable" rather than "score 0." Flagging for a decision if/when it's prioritized.

Verified via `tsc --noEmit` (frontend steady at the pre-existing 59-error baseline, 0 new/resolved; `core-api` 0 errors) and live `agent-browser` checks at 1600×950 and 390×844 as both `super@els.ai` (Admin Analytics tab: donut + roster + forecast chart all rendering with real seed data, correctly sorted, forecast math hand-verified against the raw series) and `teacher@els.ai` (Student Activity list re-sorted worst-first with risk badges, no layout regressions on mobile).
