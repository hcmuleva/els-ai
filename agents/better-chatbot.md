# ELS · AI Chat System — Implementation Plan

**Stack assumed:** Expo (React Native, iOS/Android/Web) frontend · NestJS microservices backend · PostgreSQL · Ably (real-time) · JWT + refresh auth · existing multi-tenant role system (superadmin → student).

**External services:** an LLM (conversation, extraction, narrative generation) + **Jev** (TypeSafe's System One model, accessed via an `openjev.sh` or OpenRouter/Vercel/Cloudflare key) for fast structured validation, routing, and scoring.

---

## 1. Goals

- Three distinct, non-confusing chat experiences: **Survey Chat** (parent), **Performance Chat** (child / parent / teacher), and a **Review queue** (teacher).
- Conversational parent surveys that write into the *existing* report tables, indistinguishable downstream from manually-entered data.
- Multi-turn context that persists per session so follow-up answers are interpreted correctly.
- One reusable "report template" component, rendered differently per role, reused across native and web via Expo.
- Jev used for every fast classify/score/validate decision in the pipeline; the LLM used only for language (asking questions, extracting meaning, writing narratives).

## 2. Non-goals (for v1)

- Jev is **not** used to hold a conversation. It never generates the bot's messages.
- No client-side calls to the LLM or Jev — Expo is a public client; both keys live only in the NestJS backend.
- No new database of truth for performance metrics — the deep-dive chat reads the same tables/queries your manual report dashboard already uses.

---

## 3. Architecture

```
Expo App (iOS / Android / Web via Expo Router)
 ├─ SurveyChatScreen        (parent only)
 ├─ PerformanceChatScreen   (child / parent / teacher — same screen, role-scoped)
 └─ ReviewQueueScreen       (teacher only)
        │  REST (start/send) + Ably subscribe (stream tokens/events)
        ▼
NestJS API Gateway
 ├─ ChatModule
 │   ├─ ChatController          (POST /chat/:type/sessions, /messages)
 │   ├─ ChatOrchestratorService (per chat_type state machine)
 │   ├─ ContextService          (reads/writes context slots)
 │   ├─ LlmClient               (wraps your chosen LLM API)
 │   └─ JevClient               (wraps Jev; provider-agnostic, see §6)
 ├─ ReportModule (existing)     (report_entries, analytics queries — extended, not replaced)
 └─ RealtimeModule              (Ably token issuance + publish)
        │
        ▼
PostgreSQL (chat_sessions, chat_messages, context_slots, report_entries+)
```

Key rule: **the Expo app never talks to the LLM or Jev directly.** It talks to NestJS; NestJS talks out. This keeps `OPENJEV_API_KEY` / LLM keys server-side and lets you swap providers without touching the app.

---

## 4. Data model additions

```sql
-- One row per conversation
CREATE TABLE chat_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  chat_type     TEXT NOT NULL CHECK (chat_type IN ('survey', 'performance', 'review')),
  initiator_id  UUID NOT NULL REFERENCES users(id),   -- who's chatting
  role          TEXT NOT NULL CHECK (role IN ('child','parent','teacher')),
  subject_student_id UUID REFERENCES students(id),     -- whose data this session is about
  status        TEXT NOT NULL DEFAULT 'active',         -- active | completed | abandoned
  context_slots JSONB NOT NULL DEFAULT '{}',            -- durable extracted facts, see §5
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES chat_sessions(id),
  sender      TEXT NOT NULL CHECK (sender IN ('user','assistant','system')),
  content     TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}',   -- jev_answers, extracted_fields, confidence, etc.
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Extend your existing report table rather than forking it
ALTER TABLE report_entries
  ADD COLUMN source          TEXT NOT NULL DEFAULT 'manual'
                              CHECK (source IN ('manual','chat_survey')),
  ADD COLUMN confidence      NUMERIC,
  ADD COLUMN review_status   TEXT NOT NULL DEFAULT 'n/a'
                              CHECK (review_status IN ('n/a','auto_accepted','pending_review','approved','rejected')),
  ADD COLUMN raw_source_text TEXT,
  ADD COLUMN chat_session_id UUID REFERENCES chat_sessions(id);
```

`context_slots` example for a survey session:

```json
{
  "student_id": "uuid",
  "topic_in_progress": "reading_difficulty",
  "last_question_id": "weakness_academic_03",
  "collected_categories": ["strength.social", "weakness.academic"],
  "pending_followups": ["ask_frequency"]
}
```

This is what gets passed as `state` to both the LLM and Jev on every turn — it's what makes "does this answer match the earlier question" actually work, rather than relying on message-window recall alone.

---

## 5. Chat types, kept explicitly separate

| chat_type | Who can start it | Data scope | UI treatment |
|---|---|---|---|
| `survey` | Parent | Their own child(ren) | Distinct header/color, "Survey" badge, progress indicator |
| `performance` | Child, Parent, Teacher | Child: self only · Parent: their children · Teacher: assigned students | Same screen component, scope banner shows whose data is in view |
| `review` | Teacher | Pending `chat_survey` entries for assigned students | List + approve/reject, not a free-form chat |

Enforce scope in `ChatOrchestratorService` at session-creation time (reuse your existing RBAC guards) — never filter client-side.

---

## 6. Jev integration (`JevClient`)

### 6.1 Provider abstraction

```ts
// jev.client.ts
interface JevClient {
  ask<T extends JevQuestions>(state: unknown, questions: T): Promise<JevAnswers<T>>;
}
```

Implement one concrete class hitting whichever endpoint you settle on (`openjev.sh`, OpenRouter's `typesafe/jev-1.13`, Vercel AI Gateway, or TypeSafe's own console/API). Because `openjev.sh` access is funded by `$JEV` token trading fees rather than a normal billing plan, don't hard-couple to it — keep it swappable behind this interface, and consider defaulting to one of the standard-billing routes for anything on the critical path.

### 6.2 Which primitive for which decision

| Decision | Primitive | Notes |
|---|---|---|
| Report category for a survey answer | `choice` | **Always include an `"unclear"` option** — Choice must pick something |
| Is this answer specific enough to log? | `noul` | Cheap flag, run alongside `choice` in the same call |
| Concern / severity level | `score` (not `choice`) | Ordered, continuous, trackable over time — this is what your trend charts read |
| Intent-routing for a deep-dive question | `choice` | Avoids an LLM round-trip just to classify intent |
| Trend label (improving/stable/declining) | `score` | Computed consistently instead of left to LLM wording variance |

Example call for one survey turn:

```json
POST /v1/systemone
{
  "model": "openjev",
  "state": {
    "context": { "topic_in_progress": "reading_difficulty", "student_id": "uuid" },
    "parent_message": "She still mixes up b and d sometimes but it's gotten a lot better since August."
  },
  "questions": {
    "category": {
      "type": "choice",
      "instructions": "Which report category does this answer belong to?",
      "criteria": {
        "weakness_academic": "A specific academic difficulty",
        "strength_academic": "A specific academic strength or improvement",
        "behavior": "A behavioral observation",
        "unclear": "Doesn't clearly fit a category"
      }
    },
    "specific_enough": {
      "type": "noul",
      "instructions": "Is this answer specific enough to log without a follow-up question?"
    },
    "concern_level": {
      "type": "score",
      "instructions": "How concerning is this for the child's reading progress?",
      "criteria": ["No concern", "Mild, monitor", "Moderate, worth flagging", "Needs teacher attention"]
    }
  }
}
```

### 6.3 The verified-cascade pattern

1. LLM extracts a candidate structured fact from the parent's message.
2. One Jev call (as above) returns `category`, `specific_enough`, `concern_level` in parallel (~sub-second).
3. Decision in `ChatOrchestratorService`:
   - High confidence **and** `specific_enough` above threshold → write to `report_entries` with `review_status = auto_accepted`.
   - Low confidence, `category = unclear`, or low `specific_enough` → bot asks one clarifying follow-up.
   - End of survey with anything still uncertain → save as `pending_review`, appears in the teacher's `review` chat/queue.
4. Tune the threshold on your own logged examples before trusting auto-accept broadly — treat Jev's classification as a fast first pass, not ground truth, especially since this data feeds an official child record.

Handle `429`/`503` with retry-with-backoff; if Jev is genuinely unreachable, fail safe by routing the turn straight to `pending_review` rather than blocking the conversation.

---

## 7. Survey chat flow

```
Parent opens Survey Chat (chat_type=survey, subject_student_id set)
  → NestJS creates chat_session, seeds context_slots from question bank
  → Bot asks question (LLM, using next unanswered topic in context_slots)
  → Parent answers
  → LLM extracts candidate fact → Jev validates (choice+noul+score)
  → auto_accepted → write report_entries, update context_slots, next question
  → needs follow-up → bot asks clarifying question, stays on same topic
  → survey ends → any pending_review entries surface in teacher's Review queue
```

## 8. Deep-dive performance chat flow

```
User asks a question in Performance Chat
  → Jev `choice` call: which metric/section is this about? (fast, no LLM round-trip)
  → NestJS queries existing report/analytics tables, scoped by role
     (child: self · parent: their children · teacher: assigned students)
  → Jev `score` call(s) label trends consistently (improving/stable/declining)
  → LLM writes the narrative around the fetched numbers + labels
  → Response renders via the shared PerformanceReportView (below)
```

---

## 9. Shared report template (Expo)

One component, role changes scope and tone, never layout:

```tsx
type Role = 'child' | 'parent' | 'teacher';

interface PerformanceReportViewProps {
  role: Role;
  studentId: string;          // for parent/teacher: the student currently in view
  sections?: Array<'overview' | 'strengths' | 'weaknesses' | 'trends' | 'recommendations'>;
}
```

- **Layout**: same sections and chart types for every role — Overview, Strengths, Weaknesses, Trends, Recommendations.
- **What role actually changes**: data scope (self vs. list of children vs. list of students), available actions (teacher: annotate/approve; parent: message teacher; child: read-only), and reading level of the LLM-generated narrative text.
- **Charts**: `victory-native` or `react-native-gifted-charts` — both render via `react-native-svg`, which works across iOS/Android/Expo Web without a separate web chart library.
- **Responsiveness**: use `useWindowDimensions` + a breakpoint helper to switch chart/grid column count (1 column on phone, 2–3 on tablet/web) rather than maintaining separate mobile/web screens. Expo Router makes this one screen with responsive styling, not two.
- **Multi-child switcher**: for parent/teacher, a horizontal student selector above the template; selecting a student re-queries scoped data, template itself doesn't change.

---

## 10. Real-time layer

Reuse Ably (already an infra decision on ELS-Kids):

- Channel per session: `chat:{chat_type}:{sessionId}`.
- NestJS publishes assistant messages/typing events; Expo subscribes.
- Review queue updates (`pending_review` count) publish to a per-teacher channel: `review:{teacherId}`.

---

## 11. Security & data handling

- LLM and Jev API keys: NestJS env vars only, never shipped to Expo.
- RBAC guards on session creation and every message send — role + subject_student_id checked against the existing multi-tenant permission table, not inferred from client input.
- Since survey data covers children's behavior/weaknesses, keep `pending_review` as a real, enforced gate (not a UI nicety) for any entry below your confidence threshold — confirm this fits your org's data-handling/compliance requirements before going live, since this isn't something to decide purely at the engineering layer.

---

## 12. Phased rollout

1. **Schema + Survey Chat** for parents, with the Jev verified-cascade loop, writing into `report_entries`. No context_slots persistence beyond the session yet.
2. **Context slots** solidified; multi-turn survey coherence tested with real parent phrasing.
3. **Performance Chat + shared template**, teacher view first (broadest data access, easiest to validate against existing manual reports).
4. **Parent and child views** of the same template + the teacher Review queue for `pending_review` entries.
5. **Polish**: responsive breakpoints, chart theming, Ably reconnect handling, rate-limit/backoff hardening on the JevClient.

---

## 13. Open questions to settle before Phase 1

- Which LLM provider/model for the conversational layer, and expected per-message latency budget?
- Confidence thresholds for `auto_accepted` vs `pending_review` — start conservative, tune on logged real examples.
- Which Jev access path (`openjev.sh` vs OpenRouter/Vercel/Cloudflare/TypeSafe direct) for the initial build?
- Question bank for the survey (topics, order, follow-up rules) — likely its own markdown spec, similar to the existing AI question-generation framework.