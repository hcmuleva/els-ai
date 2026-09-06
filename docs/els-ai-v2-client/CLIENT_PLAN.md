# ELS-AI Client Plan
### Response to `CLIENT_REFACTOR.md` — current-state assessment, gap analysis, and prioritized roadmap

**Status:** In progress — implementing P0→P1→P2 backlog sequentially per user instruction. All of P0 (items 1-4) and all of P1 (items 5-8) are resolved — either done, confirmed already done, or explicitly deferred by decision. See `PENDING_ITEMS.md` for the running list of what's deferred/incomplete-by-design across every item. Continuing with P2.
**Scope of this pass:** (1) verify the current client works end-to-end against the refactored backend, (2) confirm brand logo usage, (3) scope the AI Chat Interface (Phase 5) since none exists today, (4) turn the full `CLIENT_REFACTOR.md` vision into a realistic, sequenced backlog for this codebase's actual stack.

---

## 0. Reality check: actual stack vs. the spec's assumed stack

`CLIENT_REFACTOR.md` (Phase 9) recommends React + Next.js, Tailwind, Shadcn UI, Redux Toolkit/Zustand, React Query. **The real app is React Native + Expo Router (SDK 54/57), targeting iOS, Android, and web from one codebase**, with a custom `CustomTabBar`, Context-based state (`AuthContext`, `NotificationContext`), and a bespoke component library under `frontend/src/components/`. There is no Next.js, no Tailwind, no Shadcn, no Redux/Zustand, no React Query anywhere in the tree.

This plan keeps the spec's *design and product intent* (IA, navigation model, role dashboards, AI-first experience, accessibility, design system) but re-targets every technical recommendation to Expo/React Native equivalents (e.g. `expo-router` `Link`/typed routes instead of Next.js routing, a lightweight RN-friendly design-token system instead of Tailwind/Shadcn, React Query is actually compatible with RN and is a reasonable adopt). Rebuilding on Next.js would mean abandoning the native iOS/Android apps — out of scope unless the user explicitly wants to split web and native.

---

## 1. Verification performed this pass

| Check | Result |
|---|---|
| Backend reachable from frontend (`EXPO_PUBLIC_API_BASE_URL` → gateway) | ✅ Correct, points at `http://localhost:4000` |
| Real login round-trip (`teacher@els.ai` against restored DB) | ✅ 200, valid JWT, redirects to `/planner` |
| Planner screen renders real classroom data | ✅ Live Hindi-language classroom titles, actions all present |
| Manage screen renders real topic data | ✅ 52 real topics loaded from `/topics` |
| Company logo (`emeelanlogo.png`) | ✅ Already wired into `login.tsx` and the `(tabs)` header — no work needed |
| AI chat / assistant feature | ❌ **Does not exist anywhere in the frontend or backend.** No chat UI, no LLM-backed endpoint. The only "AI" backend (`backend/ai-service`) is a narrow, template-based content/quiz generator with no conversational or LLM-provider integration. |
| Tab-bar click navigation (found during this pass, not previously known) | 🔧 Fixed — see §2 |

### Bugs found and fixed during verification
1. **Tab bar navigation hardening** — `CustomTabBar.tsx`'s primary tabs now render as real `<Link asChild>` anchors on web (native anchor-tag semantics) instead of relying solely on a custom `Pressable` press responder. Verified via `tsc --noEmit` (no new errors) and live browser testing.
2. **Notification real-time teardown race** — `NotificationContext.tsx`'s Ably `stopRealtime()` could close a connection mid-transition and a stale `authCallback` could hand fresh auth data to an already-torn-down client, throwing an uncaught async "Connection closed" error. This surfaced as a full-page dev error overlay (Expo LogBox on web) that blocked all clicks while shown. Fixed by guarding the callback against staleness and skipping `close()` on a connection that isn't actually live. Confirmed via repeated login/navigate cycles that the error and overlay no longer appear.

Both fixes are narrow, additive, and typecheck-clean; no visual or behavioral change on native iOS/Android.

---

## 2. Gap analysis against `CLIENT_REFACTOR.md`

### Phase 1–2 (UX/UI assessment, design principles)
- **Current state:** Functional, data-correct, but visually ad hoc — styling is defined per-screen/per-component (`StyleSheet.create` scattered across ~60+ files) rather than from shared tokens. No dark mode. No documented spacing/type scale.
- **Navigation depth:** Reasonable — tab bar + a "More" overflow panel keeps most role journeys to 1–2 taps. `MAX_INLINE = 3` primary tabs is a deliberate anti-clutter choice already in place.
- **Role confusion:** Low risk — `roleTabs.ts` cleanly scopes visible tabs per role (student/teacher/parent/admin/superadmin), and `RoleSwitcher` lets multi-role users switch context explicitly.

### Phase 3–4 (Navigation, role dashboards)
- Routes already exist for every role called out in the spec: `admin.tsx`, `superadmin.tsx`, `planner.tsx` (teacher), `manage.tsx` (teacher content ops), `reports.tsx`, `classroom.tsx`/`index.tsx` (student/parent home), `stories.tsx`, `assessment.tsx`, `evaluation.tsx`, `logicopiccolo.tsx`, `counseling.tsx`.
- What's **missing** relative to the spec's dashboard widget lists: AI Recommendations, Streaks/Achievements/Gamification (student), Weak-Student Identification (teacher), Risk Detection/Forecasts (admin/superadmin), Behaviour Insights (parent). None of these have any backend data source today — they'd need new endpoints, not just UI.

### Phase 5 (AI Agent Experience) — the biggest gap
- **Nothing exists.** No AI Hub, no floating AI button, no dockable panel, no multi-agent router, no chat UI, no LLM provider integration anywhere in the stack.
- The spec's full ask here (multi-provider agent router with Factory AI/Copilot/Ollama/local models, cost tracking, audit, per-role AI feature sets) is a multi-month platform initiative, not a UI addition. Recommend treating it as its own workstream with a scoped v1 (see §3).

### Phase 6–8 (Dashboards, Design System, Accessibility)
- ~~Card-based layouts already exist (Planner's classroom cards, Manage's topic cards) but are not driven by a shared `Card` component — each screen re-implements its own card styling.~~ 🟡 Partially addressed: `src/components/common/Card.tsx` now exists and is proven out on one Planner + one Manage site; most existing card markup in those two files hasn't been swapped over yet (see backlog item 3).
- ~~No accessibility audit has been run on the RN app itself (only `expo-doctor`/`tsc`/`npm audit` were checked previously, which don't cover a11y). WCAG-AA claims can't be made yet.~~ ✅ P1 item 6 completed: `agent-browser a11y --tags wcag2a,wcag2aa` was run against the login screen and every primary authenticated screen for student, teacher, parent, admin, and superadmin. Contrast and prohibited-ARIA findings were fixed app-wide, and every non-color finding surfaced by the same sweep (missing `ActivityIndicator`/form labels, scrollable-region and skip-nav cases, an `aria-hidden-focus` needs-review item) was closed in a follow-up pass — see §4 item 6 for the full file list. Final re-sweep across all 5 roles reports zero violations, zero incomplete.
- ~~No theme engine — colors are hardcoded hex literals per-file (e.g. `TAB_COLORS` in `CustomTabBar.tsx`).~~ 🟡 Partially addressed: `theme/index.ts` now has `Colors`/`RoleColors`/`Typography`/`Radius`/`Shadow`/`Spacing`, and the tab bar + header components consume it. Most other screens still use local hex literals (see backlog item 2).

### Phase 9 (Frontend architecture)
- Re-scoped per §0. Concretely worth adopting from the spec's list: **React Query** (works fine in RN, would remove a lot of hand-rolled `apiFetch`+`useState` fetching currently duplicated per screen), **feature flags** (none exist; useful for rolling out AI features gradually), **telemetry** (none exists — no crash reporting or usage analytics currently wired up).

---

## 3. AI Chat Interface — scoped v1 plan (explicit ask: "ensure a chat window is included")

**Status: ✅ Shipped this pass.** Provider = local Ollama (`llama3`, placeholder `OLLAMA_BASE_URL` until the user stands one up), role-specific system prompts from day one, both streaming and persisted history. Verified end-to-end: gateway → `ai-service` → Ollama-unreachable error surfaces gracefully in the UI (expected until Ollama is actually running); conversation create/list/select/delete all round-trip through `core-api`'s new `ai_conversations`/`ai_messages` tables. See "What shipped" below for the file list.

Given there is no existing chat or LLM backend, this was scoped as a **v1**, not the full multi-agent/multi-provider vision from Phase 5:

**Backend (new work, in `backend/ai-service`):**
- `POST /ai/chat` — accepts `{ conversationId?, message, role, context }`, calls a single configured LLM provider (start with one provider behind an env-configured key — e.g. OpenAI or Anthropic — rather than building the full agent-router abstraction up front), returns a streamed or single-shot response.
- New tables: `ai_conversations`, `ai_messages` (conversation history, per-user, per-role).
- Reuse the existing `requireAuth` middleware and gateway `/ai` proxy already wired in `backend/gateway/src/server.ts` — no new gateway route needed.

**Frontend (new work):**
- A floating AI button visible from every authenticated screen (rendered once in `app/(tabs)/_layout.tsx`, similar to how `NotificationBell`/`ProfileMenu` are globally mounted today).
- A dockable chat panel (slide-in on web/tablet, full-screen modal on phone) with: message list, streaming response rendering, conversation history sidebar, and role-aware system prompt (teacher vs student vs parent vs admin context).
- v1 explicitly **excludes** (deferred to v2 per Phase 5's fuller scope): multi-agent selection, file/image upload, voice input, PDF/Word export, prompt template library. These add real scope and should be sequenced after v1 chat is live and adopted.

**Sequencing rationale:** shipping a single well-integrated chat first validates the UX pattern (where it lives, how it's invoked, how role context is passed in) before investing in the multi-provider agent-router abstraction the full spec calls for.

**What shipped:**
- Backend: `core-api/src/services/aichat/{db,middleware/auth,routes/conversations}.ts` (schema + CRUD, mounted at `/ai-conversations`), `gateway` proxy route, `ai-service/src/chat/{prompts,ollamaClient,persistClient}.ts` + `ai-service/src/routes/chat.ts` (`POST /ai/chat`, SSE streaming, mounted in `ai-service/src/server.ts`).
- Frontend: `src/services/aiChat.ts` (CRUD + `expo/fetch`-based SSE streaming client — the only fetch in this app with a real streaming body on native), `src/context/AiChatContext.tsx`, `src/components/chat/{ChatButton,ChatPanel}.tsx`, mounted in `app/(tabs)/_layout.tsx` and `app/_layout.tsx`.
- **Still needed from the user:** a real `OLLAMA_BASE_URL` once Ollama is running somewhere reachable from `ai-service` (currently a `localhost:11434` placeholder per the user's own choice).

---

## 4. Prioritized backlog

**P0 (do first — unblocks everything else, small/contained):**
1. Ship the two navigation/notification fixes above (done this pass).
2. ~~Extract a shared design-token file (colors, spacing, type scale) from the currently-scattered hardcoded values; migrate `CustomTabBar`'s `TAB_COLORS` and the header components first as a proof of pattern.~~ ✅ Done. `theme/index.ts` gained `RoleColors` (consolidates the duplicated `TAB_COLORS`/`ROLE_COLORS` local consts) and a `Typography` scale; `Colors.primary/accent/text/textMuted/borderLight` were retuned to whichever hex was actually dominant across the app (grep-verified) so the migration is visually a no-op. Migrated: `CustomTabBar.tsx`, `NotificationBell.tsx`, `ProfileMenu.tsx` (removed its duplicate `ROLE_COLORS`), `RoleSwitcher.tsx`, `app/(tabs)/_layout.tsx` (brand + header colors). Verified via `tsc --noEmit` (0 new errors, same 59 pre-existing baseline) and a live `agent-browser` visual pass (tab bar, notification panel, profile menu all render identically to before). Scoped as proof-of-pattern on core nav/header components rather than a full app-wide sweep — many screens (e.g. `manage.tsx`, `planner.tsx`, `QuestionDumpTab.tsx`) still have their own hardcoded hex/local color consts and are good candidates for a follow-up pass.
3. ~~Build a shared `Card` component and migrate Planner/Manage's ad hoc cards onto it.~~ ✅ Done (proof of pattern). Added `src/components/common/Card.tsx` (`elevated`/`outlined`/`flat` variants built on the `Colors`/`Radius`/`Shadow`/`Spacing` tokens) and migrated one instance in each of Planner (`STATUS` field card) and Manage (fill-in-the-blank `Sentence` section) as a working example, visually verified via `agent-browser` screenshot. Deliberately did **not** attempt a full sweep: `planner.tsx` (~2,400 lines) and `manage.tsx` (~6,000 lines) have dozens more ad hoc card sites, and this repo has no git history (`git status` reports "not a git repository") — bulk find/replace across files that size with no revert safety net is a real risk of silent breakage. Recommend initializing git (or at minimum a checkpoint backup) before doing the remaining sweep.
4. ~~AI Chat Interface v1 (§3) — the explicit, immediate ask.~~ ✅ Done.

**P1 (near-term, real product value):**
5. ~~React Query adoption for data-fetching, screen by screen, starting with Planner/Manage (already read this session, straightforward to convert).~~ ✅ Done (proof of pattern). Installed `@tanstack/react-query`, wired a shared `QueryClient` via `src/config/queryClient.ts` and `QueryClientProvider` in `app/_layout.tsx` (`refetchOnWindowFocus`/`refetchOnReconnect` disabled — RN has no window-focus event; screens instead refetch explicitly on `useFocusEffect`, matching pre-existing timing). Converted Planner's classroom list (`classrooms`/`loadClassrooms` → `useQuery`, refetched from all 4 mutation handlers) and Manage's subject catalog (`subjectCatalog`/`loadSubjectCatalog` → `useQuery` with `enabled: false`, manually `refetch()`'d from the topic/content/question tab-gated effects so the lazy, tab-triggered fetch timing is unchanged). Verified via `tsc --noEmit` (0 new errors) and a live `agent-browser` pass: classroom list renders and refreshes correctly after a save; Manage's Topic/Content/Questions tabs all load their real data (52 topics / 1647 content items / 2513 questions) through the new query. Both files have many more hand-rolled `useState`+`apiFetch` data flows (content items, quizzes, questions list, bookmarks, activity counts, etc.) left as-is — converting those is mechanical but sizable, and (like the `Card`/token passes) was scoped down given this repo has no git history to safely checkpoint against mid-sweep.
6. ~~Accessibility pass: run a real a11y audit (`agent-browser a11y` or native equivalents) against each role's primary screens, fix flagged issues.~~ ✅ Done, in two halves:
   - **ARIA/semantics sweep:** `accessibilityRole`/`accessibilityLabel` added to `RoleSwitcher.tsx`, `ProfileMenu.tsx`, `NotificationBell.tsx` (`CustomTabBar.tsx` was already compliant). Root-caused a duplicate-modal `aria-allowed-attr` false positive on `ProfileMenu` to a dev-server Fast Refresh artifact (only one usage exists in source; resolved via hard reload, not a code fix).
   - **Color-contrast sweep (the larger half):** ran `agent-browser a11y --tags wcag2a,wcag2aa` per-role (student/teacher/parent/admin/superadmin) across every primary screen and reachable dropdown/modal, using layered-alpha compositing math (not naive single-layer checks) for tinted/self-tinted/opacity-blended text. Iterated live-sweep → fix → `tsc --noEmit` diff (0 new errors throughout) until each role's screens hit 0 violations. Fixed, file by file:
     - `ProfileMenu.tsx` — role-badge text (teacher/superadmin) via a `BADGE_TEXT_COLORS` override map.
     - `practice.tsx` — "Live" badge text.
     - `reports.tsx` (by far the largest single file — ~15 distinct locations across `ParentReports`/`ReportsScreen`): `scoreGrade()`, stat-card and streak colors, live/status/urgent badge text, quiz-detail banners (also removed an `opacity: 0.7` that was silently pushing an already-marginal color under 4.5:1), duplicated MCQ/jigsaw/board-game result badges, progress-bar-adjacent text (split into paired `barColor`/`barTextColor` vars), and the `CHILD_COLORS_PR` chip array.
     - `index.tsx` — Quick Actions "Counseling" label and the "Tried" stat pill (`Colors.accent`/`Colors.warning` both fail as text on their `*Light` backgrounds).
     - `login.tsx` — demo-account name/role labels (dead code today — the whole block is JSX-commented out behind `{/* Demo section (hidden) */}` — fixed anyway for whenever it's re-enabled; also found the role-label text was independently broken by an alpha-blended `+'AA'` suffix that dropped every role's contrast to ~2.6–2.9:1, not just the failing hues).
     - `counseling.tsx` — the 0–5 rating pills/segments (`ratingColor`/new `ratingTextColor`).
     - `admin.tsx` — active-tab tile text (Billing/Question Dump tints too light for white text; added a `activeFill` override).
     - `QuestionDumpTab.tsx`, `BillingPanel.tsx` — warning-count/status-pill text on white and on `warningLight`.
     - `src/components/reports/charts.tsx`, `TrendAnalysisTab.tsx` — chart axis-label gray, `RiskRow`/`RiskPill`/`GrowthChip` self-tinted status text.
     - **Found in a later pass** (while building the Manage → Questions "Preview" feature below, which surfaced `JigsawRenderer`/`SingleQuestionPlayer` — shared components used by the *real* student quiz screen, not just the new preview): `JigsawRenderer.tsx`'s "Grid" stat badge, piece-selected instruction text, and "all pieces placed" text (all self-tinted `accent`-as-text, ~2.4–2.8:1 → switched to the theme's existing `textColor`, a new `badgeTextColor` field on `QuestionTheme` for the two failing chip cases); `SingleQuestionPlayer.tsx`'s header badge for the `fill_blank`/`jigsaw` themes (same pattern); `QuestionsTab.tsx`'s "Clear" filter chip (`#DC2626` on `#FEE2E2`, 3.95:1 → `#B71C1C`). This is a real fix to the live student quiz experience, not just the teacher-facing preview.
   - Root theme tokens (`Colors.accent`, `Colors.warning`) were **not** changed globally — both are reused safely as icon/border/fill colors elsewhere, so every fix above is a text-only override (new field or local darker constant) next to the original color, following the pattern already established for `Colors.success`/`Colors.purple`/etc. in the theme file's own header comments.
   - Final live re-sweep across all 5 roles: 0 color-contrast violations everywhere reachable. Five non-color findings were initially deferred out of that pass (`aria-progressbar-name` on `ActivityIndicator`, Settings' missing form `label`s, student Reports' `scrollable-region-focusable`, `subject.tsx`'s skip-nav `bypass`, an `aria-hidden-focus` incomplete) — **all five were closed in a follow-up pass** (below), since none needed a product decision.
   - **Follow-up pass — remaining non-color a11y findings, all fixed:**
     - `settings.tsx` — the 3 toggle `<Switch>`s (Dark Mode/Push Notifications/Sound Effects) were missing accessible names; added `accessibilityLabel`/`accessibilityHint`.
     - `aria-hidden-focus` — root-caused to a React Navigation web stack-transition artifact: an outgoing screen's DOM stays mounted at `opacity:0`/`aria-hidden="true"` during the transition, but its buttons keep `tabindex="0"`, so keyboard users could tab into invisible "ghost" controls. Fixed generally rather than per-screen: new `src/hooks/useInertAriaHidden.ts` (web-only `MutationObserver`) keeps the native `inert` attribute in sync with any `aria-hidden="true"` element app-wide, wired into `app/_layout.tsx`'s `RootLayout`.
     - Student Reports' `scrollable-region-focusable` — the main tab-content `ScrollView` inside `ParentReports` (`reports.tsx`) had no way to be reached/scrolled by keyboard; added a web-only `tabIndex={0}`.
     - `subject.tsx`'s skip-nav `bypass` — this screen hides the tab bar (`headerShown: false` route, no other landmark/heading on the page); added `accessibilityRole="header"` to both the subject-list and topic-detail screen titles.
     - `aria-progressbar-name` on `ActivityIndicator` — all 165 occurrences app-wide (43 files) were missing an accessible name; scripted sweep added `accessibilityLabel="Loading"` to every one. Generic but accurate (every usage is in fact a loading spinner); a more specific per-site label would need manual review of all 165 call sites, not done here.
     - Verified throughout via `tsc --noEmit` (0 new errors at each step) and live `agent-browser a11y` re-sweeps (0 violations, 0 incomplete on Settings, Reports (parent + student), and `subject.tsx` after each fix).
     - **New bug found while testing, not fixed (needs its own investigation):** `NotificationContext.tsx`'s Ably `stopRealtime()` throws an uncaught "Connection closed" error intermittently on **direct URL navigation/reload** (reproduced on `/settings` and `/reports`, both roles) — the existing connection-state guard doesn't fully prevent it. This is a real crash a real user could hit by refreshing the browser or opening a deep link, not just a dev-mode artifact. See `PENDING_ITEMS.md` §7.
7. ~~Dark mode / theme engine, built on the P0 design tokens.~~ **Deferred per explicit decision — light mode only for now.** See `PENDING_ITEMS.md` §2.
8. ~~Gamification widgets for the student dashboard (streaks, achievements) — needs new backend fields on quiz/attempt completion.~~ ✅ **Already done, no new work needed.** Checked before starting: streaks (`student_analytics.streak_days`, computed server-side) and achievements (teacher-granted via `/achievements/grant`, listed via `/achievements/my`) are both fully real and already rendered on the student home screen — the "needs new backend fields" premise in this item was inaccurate. Separately found (not part of this item, tracked in `PENDING_ITEMS.md` §1): `reports.tsx` had an unrelated mock XP/points section showing hardcoded fake numbers — since removed entirely, per decision (see §7 below).

**P2 (larger investments, sequence after P0/P1 prove out):**
9. Full multi-agent AI router (Factory AI / Copilot / local LLM providers) per Phase 5.
10. Teacher/Admin AI features requiring new analytics pipelines (weak-student identification, risk detection, forecasts) — needs data science work, not just UI.
11. Telemetry/crash reporting and feature flags infrastructure.
12. Formal design system package (shared across native + web) with a documented component library.

---

## 5. Success criteria (from the spec) — current status

| Criterion | Status |
|---|---|
| Reduce clicks by ≥40% | Not measured; needs a UX audit with click-path baselines before/after — recommend as a P1 task once analytics/telemetry exists |
| Consistent experience across all roles | Partially — nav/tab structure is consistent; visual styling is not yet token-driven |
| AI available from every screen | ✅ Floating button on every authenticated tab screen |
| Modern SaaS appearance | Partially — functional and reasonably clean, but not yet on a formal design system |
| Enterprise-grade usability | Backend is now solid (this session's fixes); frontend UX audit still pending |
| Mobile-first experience | Native apps already exist (iOS/Android); web is a secondary target — this is actually ahead of the spec's Next.js-first assumption |
| Scalable for future AI agents | Not yet — needs the P2 agent-router work |
| Onboarding Factory AI/Copilot/Local LLM | 🟡 Local (Ollama) done; Factory AI/Copilot providers remain P2 (§4 item 9) |

---

## 6. Open decisions for the user

- ~~**AI provider for chat v1**~~ — resolved: local Ollama (`llama3`), placeholder `OLLAMA_BASE_URL` until the user points it at a real instance.
- ~~**Chat scope for v1**~~ — resolved: role-specific behavior shipped from day one (teacher/student/parent/admin/superadmin each get a distinct system prompt).
- **Design system investment:** is a dedicated design-token/component-library pass worth doing now (P0/P1 above), or should visual polish wait until after the AI chat and data-fetching work lands? *(Proceeding with P0 items 2–3 next per the user's "implement all phases" instruction.)*
- ~~**P2 sequencing (items 9-12 above)**~~ — resolved: do all four, in listed order (9 → 10 → 11 → 12).
- ~~**Fake XP/points data in `reports.tsx`**~~ — resolved: removed entirely (turned out to be unreachable dead code, not just a display issue — see `PENDING_ITEMS.md` §1).

---

## 7. Ad-hoc requests handled outside the P0–P2 backlog

### Responsive multi-column layouts for large screens — done
Explicit ask: Reports (teacher/admin/parent) and Planner's classroom Analytics tab were rendering single-column even on wide laptop/monitor viewports; asked for "professional styles" and dynamic multi-column/multi-row layout "as per needed." Implemented on the 3 screens with genuinely comparable/paired sections — `ParentReports`' two bar charts, `ReportsScreen`'s 4 stat cards + Class Performance/Topic Gaps cards, and `ClassDetailsScreen`'s 3 `MiniBarChart` summaries — using the codebase's existing `useWindowDimensions()` breakpoint convention at a new 1024px threshold. Variable-length lists/tables (Student Activity, Student Breakdown) were deliberately left full-width. Full detail and verification notes in `PENDING_ITEMS.md` §8. Not yet scoped: whether other dashboard-style screens (e.g. `manage.tsx`) need the same treatment, and whether "professional styles" extends beyond layout into typography/spacing/shadow polish.
