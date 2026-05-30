# ELS Database Schema Review

A critical review of the current ELS Postgres schema, written from two perspectives:

1. A **new team member** reading the ER diagram for the first time.
2. A **senior software engineer** validating that relationships are enforced and there are no hidden hard-coded references.

This document reflects the schema as of **2026-05-30** after today's data-cleanup session (subject renames, EVS realignment, etc.).

---

## 0. The headline problem (one-liner)

> **"Subject" is treated as a free-text string in 5+ tables instead of a foreign key.**
> Everything downstream — visuals, filters, analytics, classroom resources — is held together by string matches that drift the moment anyone types `EVS` instead of `Environmental Studies`.

This is exactly the bug-class that produced today's `General Knowledge`, `EVS`, `GK`, `Stories`, `Nature`, `Animals` mismatches. The data is patched, but the **schema still invites the same bug back tomorrow.**

---

## 1. New-team-member view — *"What confuses me on day 1"*

| # | Confusion | Why it confuses a new joiner |
|---|---|---|
| 1 | Three tables have a `subject` column (`content_topics`, `learning_contents`, `quizzes`) and a fourth (`subjects`) is the master table — but **none of them point at each other with a FK**. You have to read `seed.ts` to learn that `subject = subjects.title`. | A junior dev assumes `subjects.id` is referenced and wastes an hour finding it. |
| 2 | `class_level` is a free-form `VARCHAR(50)` everywhere. Allowed values live in `frontend/src/constants/standards.ts` (`'LKG' \| 'UKG' \| '1'..'12'`) plus the new sentinel `'ANY'`. | There is no DB-level guarantee that `class_level = 'LKG'`, `'lkg'`, `'KG-1'` aren't all sitting in production rows. |
| 3 | Aliases (`GK ↔ General Knowledge`, `Maths ↔ Mathematics`, `EVS ↔ Environmental Studies`, `Hindi Stories ↔ Rhymes & Stories`) are only encoded **in JS arrays inside `seed.ts`**. There is no `subject_aliases` table. | When a teacher creates a topic with `subject = "Maths"` in admin, it silently doesn't link to the master "Mathematics" row. |
| 4 | `classroom_resources` joins `content_id` **and/or** `quiz_id` (polymorphic). One column is always NULL. | Beginner asks "is this a content or a quiz?" — and the schema can't tell you without inspecting which column is non-null. |
| 5 | `student_activity.reference_id` (UUID) has no FK. Could point at a quiz, assignment, story, or content. | "Where do I look up that ID?" → the answer is an `activity_type` switch in code. |
| 6 | `is_global = true` is a flag on `content_topics`, `classrooms`, `quizzes` … but **not on `subjects`**. So a global topic can reference a subject row that doesn't exist in the consumer org. | Today's bug: Kartik's home showed "General Knowledge" with no cover because there was no master row in his org. |
| 7 | `subjects.title` is the natural key but rows like `Environmental Studies (EVS)`, `Science (Physics, Chemistry, Biology)`, `Computer Applications / IT` mix abbreviations into the title. | Picker UX is inconsistent — sometimes long, sometimes short. |
| 8 | Two near-identical endpoints (`/content/subjects` and `/catalog/subjects`) return the same data with slightly different shapes (`title` vs `subject`, `class_level` vs `classLevel`). | New dev wonders which to use; both exist for back-compat. |

---

## 2. Senior-engineer view — *"Integrity & maintainability red flags"*

### A. Referential-integrity holes

| Problem | Evidence | Impact |
|---|---|---|
| **No FK from `content_topics.subject` → `subjects.id`** | `LOWER(s.title) = LOWER(ct.subject)` joins everywhere | One typo in admin = orphan topic. Today: 5 quizzes orphaned by `'Stories'`, 1 by `'Nature'`, 1 by `'Animals'`. |
| **No FK from `learning_contents.subject`, `quizzes.subject`** | Same as above | Dashboards undercount; cover images break silently. |
| **No FK from `teacher_standard_subjects.subject`** | Same string match, scoped by org+class | A teacher can be assigned to a subject that doesn't exist. |
| **`student_activity.reference_id` is unconstrained UUID** | Polymorphic FK | Cleanup of a deleted quiz → orphan analytics rows. |
| **`classroom_resources` is polymorphic via `content_id` / `quiz_id`** | Two nullable FKs | DB cannot enforce "exactly one of the two". |

### B. Hard-coded values masquerading as data

| Hard-coded location | Should be | Risk |
|---|---|---|
| `STANDARD_OPTIONS` in `frontend/src/constants/standards.ts` | `class_levels` table or PG enum | Adding "Pre-Nursery" requires a frontend deploy. |
| `'ANY'` sentinel | A boolean column `is_any_class` (or `applies_to_all_classes`) | Magic strings break ORDER BY, filters, and indexes. |
| Subject aliases in `seed.ts` arrays | `subject_aliases (subject_id, alias_text)` table | Today's `EVS → Environmental Studies` had to be fixed by SQL because aliases aren't queryable. |
| `QUESTION_TYPE_CHOICES` in `questionEditor.types.ts` | `question_types` lookup table | New question type = code change in 4 services. |
| `STATUS_COLOR`, `CHILD_COLORS`, `QUIZ_ICON_COMPS` | Theme tokens already DB-driven for subjects — extend to other domains | Inconsistent visuals between modules. |

### C. Multi-tenancy weaknesses

- `is_global` exists on `content_topics`, `classrooms`, `quizzes` — but **not** on `subjects`. We had to write a hack (`prefer user-org row, fall back to any-org`) in `topic-service` to compensate. A real `subjects.is_global` column removes the hack.
- Several tables (`questions`, `question_options`, `learning_content_sections`, `topic_content_sections`) have **no `organization_id` column** — they inherit tenancy through their parent. Accidental cross-tenant leak is possible if a query forgets to JOIN through the parent.
- No row-level security (Postgres RLS) is configured. Tenancy is enforced **only in application code**.

### D. Index / performance

- `/students/subjects` joins `content_topics × subjects × topic_content_assignments` per request. Likely missing composite indexes:
  - `subjects(class_level, LOWER(title))`
  - `content_topics(organization_id, class_level, subject)`
  - `quiz_attempts(student_id, completed_at)`
- `subjects` has `UNIQUE(organization_id, class_level, title)` — but no index on `LOWER(title)`, which is what every join uses. Today's queries do sequential scans on case-insensitive matches.

### E. Schema drift between services

- `subjects` is owned by `auth-service` but **read from `topic-service` and `content-service`** via direct SQL (cross-service DB access). That breaks the "service owns its tables" rule.
- Two services (`/content/subjects`, `/catalog/subjects`) return the same data with slightly different shapes — clear sign of drift.

### F. Audit / soft-delete missing

- No `deleted_at` columns. Deletes are hard. Recovering a wrongly-deleted `subjects` row needs a backup restore.
- No `created_by` / `updated_by` on `learning_contents`, `quizzes`, `subjects`, etc. for half the tables. Auditing "who renamed GK to General Knowledge" today required reading `psql` history.

### G. Data we already saw drift today

- `subjects` row titled `'GK'` in LKG, but topics/quizzes/contents used `'General Knowledge'` → 0 metadata join.
- `subjects` row titled `'EVS'` in LKG, but topics/quizzes/contents used `'EVS'` → matched. Then we renamed master to `'Environmental Studies'` and forgot to migrate the children (which surfaced as today's bug).
- `subjects` row titled `'Hindi Stories'` in **class 3** — leftover from the LKG/UKG-only catalog, with no topic linked to it.
- `quizzes.subject = 'Stories' / 'Nature' / 'Animals'` — invented strings that have never existed in `subjects`.

---

## 3. Recommended fixes (in priority order)

### 3.1 Promote soft FKs to hard FKs

```sql
ALTER TABLE content_topics            ADD COLUMN subject_id UUID REFERENCES subjects(id);
ALTER TABLE learning_contents         ADD COLUMN subject_id UUID REFERENCES subjects(id);
ALTER TABLE quizzes                   ADD COLUMN subject_id UUID REFERENCES subjects(id);
ALTER TABLE teacher_standard_subjects ADD COLUMN subject_id UUID REFERENCES subjects(id);

-- Backfill (today's audit shows 0 mismatches → safe)
UPDATE content_topics ct
   SET subject_id = s.id
  FROM subjects s
 WHERE s.organization_id = ct.organization_id
   AND s.class_level     = ct.class_level
   AND LOWER(s.title)    = LOWER(ct.subject);

-- (repeat for learning_contents, quizzes, teacher_standard_subjects)

ALTER TABLE content_topics            ALTER COLUMN subject_id SET NOT NULL;
-- once stable, drop the legacy string column
```

### 3.2 Replace `class_level` VARCHAR with a real type

```sql
CREATE TABLE class_levels (
  code VARCHAR(8) PRIMARY KEY,    -- 'LKG', 'UKG', '1', '2', ..., '12'
  display_order INT NOT NULL,
  label VARCHAR(64) NOT NULL
);

ALTER TABLE subjects        ADD CONSTRAINT subjects_class_level_fk
  FOREIGN KEY (class_level) REFERENCES class_levels(code);
-- repeat across content_topics, learning_contents, quizzes, classrooms, ...
```

Replace the `'ANY'` sentinel with a separate boolean column `applies_to_all_classes`.

### 3.3 Make subjects globally addressable

```sql
ALTER TABLE subjects ADD COLUMN is_global BOOLEAN DEFAULT false;
-- Mark ELS-curated subjects as global; remove the cross-org fallback hack.
```

### 3.4 Move aliases into the DB

```sql
CREATE TABLE subject_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  alias_text VARCHAR(255) NOT NULL,
  UNIQUE(subject_id, LOWER(alias_text))
);
```

The seeder writes them; the topic-creation endpoint resolves them at write-time.

### 3.5 Normalize `classroom_resources`

Either two separate tables (`classroom_contents`, `classroom_quizzes`) or one polymorphic table with a `resource_kind` enum and a `CHECK` enforcing exactly one FK.

```sql
ALTER TABLE classroom_resources
  ADD CONSTRAINT classroom_resources_one_kind
  CHECK ((content_id IS NOT NULL)::int + (quiz_id IS NOT NULL)::int = 1);
```

### 3.6 Soft-delete + audit columns

```sql
ALTER TABLE subjects          ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE subjects          ADD COLUMN updated_by UUID REFERENCES users(id);
-- repeat for content_topics, learning_contents, quizzes, classrooms, ...
```

### 3.7 Consolidate subject endpoints

Deprecate `/catalog/subjects` (topic-service). Promote `/content/subjects` (content-service) — or move both into a dedicated **subject-service** that owns `subjects`, `subject_aliases`, and serves both orgs and global rows.

### 3.8 Postgres RLS (defence in depth)

```sql
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON subjects
  USING (organization_id = current_setting('app.org_id')::uuid OR is_global = true);
```

### 3.9 CI/CD schema audit

A nightly job that runs the same audit query I ran today (`subject strings with no master row`) and posts to Slack on regression.

---

## 4. TL;DR for the team

The system works. **The schema doesn't enforce that it works.** Every safety check that should be a database constraint currently lives in:

- frontend constants (`STANDARD_OPTIONS`, `SUBJECT_ICON_LIBRARY`)
- backend seed scripts (alias arrays)
- developer discipline (remembering to write `LOWER(title) = LOWER(subject)` in joins)

Today we paid the price three times in one session (GK, EVS, Stories). The fixes above turn those landmines back into the kind of mistakes Postgres rejects with `ERROR: insert or update on table … violates foreign key constraint`.

That's the difference between **"it works"** and **"it cannot break"**.

---

## 5. Table naming — *"the names lie or are missing"*

After inspecting the live `\dt` output (42 tables), the naming situation is far worse than the relationship situation. The table names alone send a newcomer in the wrong direction.

### 5.1 Tables referenced in the design / code but **not in the DB**

| Name we use in diagrams / docs / chat | Actual table in DB | Problem |
|---|---|---|
| `quiz_attempts` | `student_attempts` | Newcomer searching for "quiz attempts" finds nothing. The table also stores story/assignment attempts, so the name is overloaded. |
| `assignments` | `classroom_assignments` | Implies assignments can exist outside a classroom; they cannot. Newcomer searches "assignments" and gets confused. |
| `questions` | `quiz_questions` | There's no standalone `questions` table — every question is tied to a quiz. Yet a `question-bank-service` exists. The reuse story is invisible from the schema. |
| `question_options` | *(does not exist)* | Options are stored as JSON inside `quiz_questions.question_data`. ER diagrams routinely show this as a child table — schema doesn't agree. |
| `classroom_resources` | `classroom_contents` + `classroom_quizzes` | Polymorphic table was split into two — but every diagram, doc, and most queries still reference `classroom_resources`. |
| `payments` | *(does not exist)* | We talk about payments end-to-end; there is no payments table. Where do refunds, retries, gateway IDs go? |
| `subject_aliases` | *(does not exist — lives in `seed.ts` arrays)* | Today's whole drift fiasco. |
| `class_levels` | *(does not exist)* | Class names are free-text VARCHAR. |
| `question_types` | *(does not exist)* | Question types live in TS enums. |

### 5.2 Tables that exist but whose **names are wrong / misleading**

| Table (actual) | What it actually stores | Better name |
|---|---|---|
| `student_attempts` | Quiz / story / assignment attempts (composite) | Either split into `quiz_attempts`, `story_attempts`, `assignment_attempts` **or** rename to `student_activity_attempts`. The current name pretends it's a generic log when it's actually a typed attempts table. |
| `student_activity` (singular!) | Event log of every student action | `student_activity_events`. Also should be plural to match the rest of the schema. |
| `student_analytics` | Pre-computed rollup per student | `student_analytics_summary` or `student_progress_summary`. Right now the name is indistinguishable from "raw analytics events". |
| `achievements` + `student_achievements` | One is the badge **catalog**, one is **earned records** — but the names don't say which | `achievement_badges` (catalog) + `student_achievements` (earned). Today, `achievements` looks like the earned table. |
| `assignment_submissions` + `classroom_assignment_submissions` | **Two submission tables for the same concept.** Why? | Pick one. The duplicate is an obvious time-bomb. |
| `classroom_assignments` | The assignment itself (not a join) | `assignments` (since they always live inside a classroom anyway, drop the prefix). |
| `topic_content_assignments` | Linking topic ↔ learning_content. **NOT** an "assignment" in the homework sense | `topic_content_links` or `topic_content_items`. The word "assignment" is now used for two completely different concepts in the same DB. |
| `topic_content_sections` vs `learning_content_sections` | Two `*_sections` tables with different parents — newcomer cannot tell what's the difference | Add a doc comment / unify, or rename one to `topic_intro_sections` if that's what it is. |
| `content_topics` | Topics that group content | Just `topics`. Prefix `content_` is redundant — there's no other kind of topic. |
| `teacher_standard_subjects` | What classes & subjects a teacher teaches | `teacher_class_subjects`. Column says `class_level`, table says `standard`. Pick one vocabulary and stick to it. |
| `organization_subscriptions` | Org subscriptions | `subscriptions`. Subscriptions are always per-org; the prefix duplicates `organization_id`. |
| `subscription_plans` | Catalog of plans | OK, but inconsistent: plans aren't prefixed `organization_`, subscriptions are. |
| `parent_assessments` + `parent_feedback` | Two parent-input tables. **Difference?** | Names don't communicate intent. One newcomer would dump data into the wrong table. |
| `parent_student_links` | Maps parent → child users | `parent_child_relationships` or `guardian_links`. "Links" is too generic. |
| `classroom_student_remarks` | Teacher's notes on a student | `student_remarks` (or `classroom_remarks`). The double prefix is stutter. |
| `assets` | Media uploads (presumably) | `media_assets` or `uploaded_files`. Bare `assets` is so generic it could mean anything. |
| `notification_schedules` | Scheduled sends? Or quiet hours? | Name doesn't say. `scheduled_notifications` (sends) vs `notification_quiet_hours` (preferences) would be clearer. |
| `user_org_mapping` (singular!) + `user_roles` (carries `organization_id`) | **Two tables map user → org.** | Pick one. Today both are used and divergent. Also: the table should be plural (`user_org_mappings`) to match every other table. |
| `refresh_tokens` | JWT refresh tokens | OK, but `auth_refresh_tokens` would group it with the other auth tables conceptually. Tiny nit. |
| `quiz_questions` | All questions for all quizzes (with optional `question_bank_id`?) | If the question bank is real, split into `questions` (bank) + `quiz_question_links` (per-quiz inclusion). Today they're conflated. |

### 5.3 Pluralization is inconsistent

Most tables are plural. These are not:

- `student_activity` → should be `student_activities`
- `user_org_mapping` → should be `user_org_mappings`
- `student_analytics` → arguable (mass noun) but inconsistent with `notifications`, `achievements`, etc.
- `parent_feedback` → should be `parent_feedbacks` or rename to `parent_feedback_entries`

A small CI lint rule (`every table name MUST be plural`) catches this for free.

### 5.4 Vocabulary drift across the schema

The same concept has **three** different names across tables and columns:

| Concept | Names used |
|---|---|
| Class / Grade / Standard | `class_level` (column), `standard` (in `teacher_standard_subjects`), `STANDARD_OPTIONS` (frontend constant) |
| Linking table | `_assignments` (`topic_content_assignments`), `_links` (`parent_student_links`), `_mapping` (`user_org_mapping`) — all mean the same thing |
| Submission | `submission` (`assignment_submissions`) and again `submission` (`classroom_assignment_submissions`) — the duplicate uses the same word for different rows |
| Attempt | `student_attempts`, `question_attempts` — the parent-child relationship isn't obvious from names |

A **dictionary** at the top of the schema doc (`class_level = grade level`, `topic = unit of learning content`, `attempt = one student's session at a quiz`, etc.) would save every new joiner a day.

### 5.5 What the table list **doesn't show that the design promised**

Every diagram and doc references these — they aren't in the DB at all:

- `payments` (we have `invoices` but no payments)
- `subject_aliases`
- `class_levels`
- `question_types`
- `question_options`
- `notification_channels` (channel is a free-text VARCHAR)
- `audit_log`
- `feature_flags`

If the team intends these to exist, write a migration. If they don't, remove them from docs/diagrams.

### 5.6 Recommended naming refactor (one migration, big payoff)

```sql
-- Renames (logical, no data movement)
ALTER TABLE student_attempts            RENAME TO quiz_attempts;            -- and split if multi-purpose
ALTER TABLE classroom_assignments       RENAME TO assignments;
ALTER TABLE topic_content_assignments   RENAME TO topic_content_items;      -- "assignment" word freed
ALTER TABLE classroom_assignment_submissions RENAME TO assignment_submissions_v2;  -- then merge
ALTER TABLE achievements                RENAME TO achievement_badges;
ALTER TABLE student_activity            RENAME TO student_activity_events;
ALTER TABLE student_analytics           RENAME TO student_progress_summary;
ALTER TABLE content_topics              RENAME TO topics;
ALTER TABLE teacher_standard_subjects   RENAME TO teacher_class_subjects;
ALTER TABLE organization_subscriptions  RENAME TO subscriptions;
ALTER TABLE parent_student_links        RENAME TO parent_child_links;
ALTER TABLE classroom_student_remarks   RENAME TO student_remarks;
ALTER TABLE assets                      RENAME TO media_assets;
ALTER TABLE user_org_mapping            RENAME TO user_organizations;
ALTER TABLE quiz_questions              RENAME TO questions;                -- promote to first-class
-- New tables backfilling missing concepts
CREATE TABLE class_levels    (code TEXT PRIMARY KEY, label TEXT, sort_order INT);
CREATE TABLE subject_aliases (id UUID PK, subject_id UUID FK, alias TEXT);
CREATE TABLE question_types  (code TEXT PRIMARY KEY, label TEXT);
CREATE TABLE payments        (id UUID PK, invoice_id UUID FK, amount NUMERIC, status TEXT, gateway_ref TEXT);
```

This single PR makes the ER diagram tell the truth, removes ambiguous duplicates, and gives the team a vocabulary that doesn't need a glossary.

---

## 6. FINAL VERDICT — feature-by-feature, query-by-query

For every major user-facing flow I traced the actual route handler, the SQL it fires, the response shape it returns, and the things that should exist but don't. This section is intentionally exhaustive so a senior engineer can hand it to a junior dev as a punch-list.

Legend: ✅ works · ⚠ works but fragile · ❌ broken / missing.

---

### 6.1 Authentication & users (`auth-service`)

#### POST `/auth/register`, `/auth/login`, `/auth/refresh`
- **Tables hit:** `users`, `user_roles`, `roles`, `refresh_tokens`, `organizations`, `user_org_mapping`.
- **Query:** bcrypt verify + JWT issuance + refresh-token row insert.
- **Output:** `{ accessToken, refreshToken, user, roles }`.
- **Missing / wrong:**
  - ❌ **Two competing user→org mappings**: `user_roles(organization_id)` and `user_org_mapping`. Login reads from one, classroom service reads from the other. Drift bug waiting to happen.
  - ❌ **No login attempt log / rate limit table** — only an in-memory `Map` (`registerRateLimitMap`). Restart the service → attacker resets the counter.
  - ❌ `refresh_tokens.revoked_at` exists but no background sweeper deletes expired tokens; this table grows forever.
  - ⚠ `users.active_role` is denormalized (the same info lives in `user_roles`). Renaming a role is a 2-table write.
  - ❌ No `user_sessions` / device table → can't show "signed-in devices" or selectively revoke one.

---

### 6.2 Subjects catalog (`/content/subjects`, `/catalog/subjects`)

#### GET `/content/subjects?class_level=LKG`
```sql
SELECT id, title, class_level, cover_image, icon_image, icon_bg_color
FROM subjects
WHERE organization_id = $1::uuid AND class_level = $2
ORDER BY class_level ASC, title ASC
```
- **Output:** `{ subjects: [{ id, title, classLevel, coverImage, iconImage, iconBgColor }] }`
- ✅ class-filtered, returns full metadata.
- ❌ **No index** on `subjects(organization_id, class_level)` — only `UNIQUE(organization_id, class_level, title)` covers this. Acceptable today; will hurt at 100k+ rows.
- ❌ **No `LOWER(title)` index** — every join from `content_topics` does a sequential scan.
- ❌ Two endpoints (`/content/subjects` and `/catalog/subjects`) return the same data with slightly different field names — drift risk.

#### GET `/students/subjects` (the home screen — the one we firefought today)
```sql
-- Step 1: topics for student's class
SELECT ct.*, COUNT(DISTINCT tca.content_id) AS content_count
FROM content_topics ct
LEFT JOIN topic_content_assignments tca ON tca.topic_id = ct.id
WHERE (ct.organization_id = $1 OR ct.is_global = true)
  AND ct.class_level = $2
GROUP BY ct.id
ORDER BY ct.subject, ct.title;

-- Step 2: subject metadata (CROSS-ORG fallback added today)
SELECT title, cover_image, icon_image, icon_bg_color
FROM subjects
WHERE class_level = $1
  AND LOWER(title) = ANY($2::text[])
ORDER BY (organization_id = $3) DESC, updated_at DESC;
```
- **Output:** `{ subjects: [{ subject, coverImage, icon, iconBgColor, topics: [...] }] }`
- ✅ now returns admin-uploaded covers thanks to today's cross-org fallback.
- ❌ **Soft FK** between `content_topics.subject` (text) and `subjects.title` (text). One typo = lost cover. (See §A above.)
- ❌ Second query reads cross-org **without RLS** — relies entirely on the application code to scope.
- ❌ For each topic, `cover_image` is signed individually with N+1 calls to `getSignedMediaUrlIfNeeded`. No batching.
- ❌ No Redis caching despite this hitting on every home-screen open.

---

### 6.3 Topics CRUD (`topic-service`)

#### POST `/topics`, PATCH `/topics/:id`, DELETE `/topics/:id`
- **Tables:** `content_topics`, `topic_content_assignments`, `topic_content_sections`, `quizzes`.
- **Query:** validate uniqueness `(org, class_level, subject, title)`; insert; on patch, update; on delete, `DELETE` + cascade.
- **Output:** standard topic shape.
- **Missing / wrong:**
  - ❌ `topic_content_assignments` is a misnomer (link table, not "assignment"). Same word as homework.
  - ❌ No FK on `content_topics.subject_id` — soft FK only.
  - ❌ Hard delete of a topic with attached `quizzes.topic_id` FKs — quizzes orphan to NULL. Should be soft-delete.
  - ❌ No audit columns (`created_by`, `updated_by`).
  - ❌ Two parallel section concepts (`topic_content_sections` vs `learning_content_sections`) — ambiguous.

---

### 6.4 Learning content (`content-service`)

#### POST `/content/items`
- **Tables:** `learning_contents`, `learning_content_sections`, `assets`.
- **Query:** insert content + per-section inserts.
- **Output:** content with sections array.
- **Missing / wrong:**
  - ❌ `learning_contents.subject` is free-text; same drift problem.
  - ❌ Sections aren't transactional with the parent insert in some code paths.
  - ❌ `assets` table is referenced loosely; not all media goes through it. Some `media_url` fields are direct S3 keys, some are signed URLs, some are HTTP. Inconsistent.

---

### 6.5 Quizzes & questions (`quiz-service`, `question-bank-service`)

#### POST `/quizzes/attempts` (the actual SQL we just looked at)
```sql
INSERT INTO student_attempts (student_id, quiz_id, score, total_points)
VALUES ($1, $2, $3, $4) RETURNING id;

-- per-question, in a loop:
INSERT INTO question_attempts (attempt_id, question_id, is_correct, response_data, time_spent_seconds)
VALUES ($1, $2, $3, $4, $5);
```
- **Output:** `{ attemptId }`, plus an emitted `quiz.submitted` event.
- **Missing / wrong:**
  - ❌ **`student_attempts` table is misnamed** — looks generic but only stores quiz attempts. Renaming to `quiz_attempts` is overdue.
  - ❌ Inserts happen **in a JS loop** instead of a single multi-row insert → N round-trips per quiz submission. With a 30-question quiz that's 31 round-trips inside one transaction.
  - ❌ `student_attempts` has **only the PK index**. No `(student_id, quiz_id)` index — yet `fetchClassroomResources` queries exactly that. Sequential scan today.
  - ❌ `quiz_questions` also has **only the PK index** — every quiz load (`SELECT * FROM quiz_questions WHERE quiz_id = $1`) is a full scan.
  - ❌ No FK from `student_attempts.quiz_id` → `quizzes.id ON DELETE CASCADE`. Deleting a quiz orphans attempts.
  - ❌ No retry / idempotency: if the client retries, you get duplicate `student_attempts` rows.
  - ❌ Question bank reuse story is broken: `quiz_questions` is the source of truth → there's no shared `questions` table. So "reuse" is actually a deep copy (`POST /quizzes/:id/questions/reuse`).
  - ❌ `question_options` doesn't exist as a table; options live as JSON inside `quiz_questions.question_data`. You can't index "questions tagged with this option text".
  - ❌ `quizzes.subject` is free-text → same drift bug class. Today we patched 5+1+1 quizzes manually.

---

### 6.6 Classrooms (`classroom-service`)

#### GET `/classrooms/student`
The single most expensive query in the entire app.

```sql
-- 1. Get student's class_level
SELECT class_level, active_role FROM users WHERE id = $1 AND organization_id = $2;

-- 2. Distinct class levels for filter dropdown
SELECT DISTINCT class_level FROM classrooms WHERE organization_id = $1 OR is_global = true;

-- 3. Classrooms for student
SELECT … FROM classrooms WHERE (organization_id = $1 OR is_global = true)
                           AND (class_level = $2 OR class_level = 'ANY')
ORDER BY created_at DESC;

-- 4. FOR EACH classroom, fetchClassroomResources():
   - SELECT contents JOIN learning_contents
   - SELECT quizzes  JOIN quizzes
   - SELECT classroom_assignments
   - SELECT student_attempts WHERE quiz_id = ANY(...)
   - SELECT classroom_assignment_submissions WHERE assignment_id = ANY(...)
```

- **Output:** `{ classrooms: [{ id, title, contents, quizzes, assignments, completionPct, … }], classLevels, currentClassLevel }`
- ❌ **N+1 pattern**: 5 DB round-trips per classroom × N classrooms. A teacher with 20 classrooms = **100 SQL queries** for one feed load.
- ❌ Should be a **single aggregate query** (or batched lookups outside the per-classroom loop).
- ❌ No caching — gets called on every pull-to-refresh.
- ❌ The `try/catch (error.code === '42703')` fallback (see lines 580–600) silently re-runs queries with org filtering removed. **This is a dangerous tenancy hole**: if a column is missing in a misconfigured DB, queries fall through to read across all orgs.
- ❌ `classrooms` has **no index on `organization_id`**, **no index on `class_level`**, **no index on `created_by`**. Only the PK.
- ❌ `'ANY'` magic string everywhere instead of a column.
- ❌ "Restarted" classrooms are filtered by **regex on `title`** (`/\s+\(Restarted\)$/i`). String-based business logic.

---

### 6.7 Assignments (`assignment-service`)

#### POST `/classrooms/:classroomId/:assignmentId/submissions`
```sql
INSERT INTO classroom_assignment_submissions
  (classroom_assignment_id, student_id, submission_text, attachment_url, submitted_at, updated_at)
VALUES (...)
ON CONFLICT (classroom_assignment_id, student_id)
DO UPDATE SET submission_text = …, attachment_url = …, submitted_at = NOW();
```
- **Output:** `{ message: 'Assignment submitted successfully' }` + `assignment.submitted` event.
- ❌ **Two submissions tables exist** in DB: `assignment_submissions` (13 cols) and `classroom_assignment_submissions` (7 cols). The code only writes to the second. The first is **dead** — but still receives writes from older code paths.
- ❌ No `score` / `feedback` / `grading_rubric_id` columns — teachers grade, but there's nowhere to store the grade.
- ❌ No FK from `classroom_assignment_submissions.student_id` → `users.id`. UUIDs unconstrained.
- ❌ No file-size validation; attachment URL trusted blindly.
- ❌ No notification path back to the teacher saying "1 new submission" — must be derived from `assignment.submitted` event.

---

### 6.8 Stories (`story-service`)

#### Tables: `stories`, `story_sections`, `story_progress`
- **Output:** ✅ matches docs.
- **Missing / wrong:**
  - ❌ `story_progress` has **no FK** to `users.id`; just a UUID column.
  - ❌ "Live now" status is computed from `(scheduled_at, ended_at, status)` columns. No DB state machine; an admin can set inconsistent combos.
  - ❌ Story sections support multiple media types but there's no `story_section_kind` enum — `content_type` is free text.

---

### 6.9 Achievements (`achievement-service`)

#### GET `/achievements`
```sql
SELECT DISTINCT ON (LOWER(name))
   id, name, emoji, description, color
FROM achievements
WHERE is_global = true
ORDER BY LOWER(name), created_at ASC, id ASC;
```
- **Output:** `{ achievements: [...] }`.
- ❌ `achievements` table holds **both** global catalog rows AND org-specific rows (depending on `is_global`). Confusing — should be split into `achievement_badges` (catalog) and `org_achievements` (overrides) or normalized.
- ❌ The grant logic re-resolves "canonical achievement" by `LOWER(name)` because the same badge can exist multiple times (one per org). That's the same soft-FK bug pattern as subjects.
- ❌ `student_achievements` — no UNIQUE constraint protecting double-grants in race conditions.
- ❌ No "criterion" column → no way to express "earned by completing 5 quizzes". Every grant is manual.

---

### 6.10 Notifications (`notification-service`)

#### Tables: `notifications`, `notification_preferences`, `notification_schedules`
- ✅ Best-indexed table in the system (`idx_notif_expiry`, `idx_notif_idem`, `idx_notif_user_active`).
- ✅ Soft-delete-friendly (`status` column).
- **Missing / wrong:**
  - ❌ `notification_schedules` exists but is **not used anywhere in code** (no readers/writers found). Dead table.
  - ❌ No `notification_channels` table → channel is free-text VARCHAR (`'push' | 'email' | 'in_app'`).
  - ❌ No bounce / failure tracking → can't tell if a push delivery failed.
  - ❌ Real-time fan-out goes through Ably but the channel name is computed in code (`org-<id>:user-<id>`), not stored.

---

### 6.11 Parent flows (`auth-service` + custom)

#### Tables: `parent_assessments`, `parent_feedback`, `parent_student_links`
- ❌ **`parent_assessments` has 12 cols, `parent_feedback` has 7** — different shapes for what looks like the same concept. No documented difference. New dev guesses wrong table half the time.
- ❌ `parent_student_links` has 5 cols and no `relationship_type` enum (mother/father/guardian).
- ❌ No FK constraints on the student/parent UUIDs.

---

### 6.12 Billing (`auth-service/billing.ts` + `org-service`)

#### POST `/billing/invoices/:invoiceId/pay`
```sql
SELECT organization_id, subscription_id, status FROM invoices WHERE id = $1;
UPDATE invoices SET status='paid', paid_at=NOW(), payment_method=$2, payment_reference=$3 WHERE id=$1;
UPDATE organization_subscriptions SET status='active' WHERE id=$1;
```
- **Output:** `{ invoice }` + `billing.invoice.paid` event.
- ❌ **No `payments` table** — every doc and diagram references one. Payment info is jammed into 4 columns of `invoices` (`payment_method`, `payment_reference`, `paid_at`, `notes`). Cannot track partial payments, refunds, retries, or multiple gateways.
- ❌ `paymentReference` defaulted to `PG-${Date.now()}` — **a real production bug** when the gateway doesn't return one. Imagine reconciling that with a bank statement.
- ❌ `organization_subscriptions` (15 cols) is the only subscription table — no separate trial/active history. Every status change overwrites the prior state.
- ❌ No `webhooks` table for inbound gateway events.
- ❌ No idempotency key on payment — retried HTTP calls double-mark invoices paid.

---

### 6.13 Analytics (`/auth/students/:id/activity`)

#### Tables: `student_activity` (singular!), `student_analytics`
- **Query:** insert event row; rollup happens (or doesn't?) in a service that I couldn't find.
- ❌ `student_activity` has **only a PK index**. The whole table is scanned for any student-level rollup.
- ❌ `student_activity.reference_id` is a free UUID with no FK; type discriminated by `activity_type` string.
- ❌ `student_analytics` is computed somewhere (couldn't locate the writer service). If the writer dies, analytics silently freeze without alerts.
- ❌ No retention policy — `student_activity` grows forever.

---

## 7. Index audit (current state)

The actual indexes on the hottest tables (verified via `pg_indexes`):

| Table | Indexes that exist | What's missing |
|---|---|---|
| `subjects` | PK + UNIQUE(org, class, title) | `LOWER(title)`, `(class_level)`, `(organization_id)` |
| `content_topics` | PK + UNIQUE | `(organization_id, class_level)`, `(subject)` |
| `quizzes` | PK only | `(organization_id, class_level, subject)`, `(topic_id)`, `(is_global)`, `(created_by)` |
| `quiz_questions` | PK only | **`(quiz_id)` — fundamental missing index** |
| `classrooms` | PK only | `(organization_id)`, `(class_level)`, `(created_by)`, `(status, start_time)` |
| `classroom_contents` | PK + UNIQUE | OK |
| `classroom_quizzes` | PK + UNIQUE | OK |
| `student_attempts` | PK only | **`(student_id, quiz_id)`, `(quiz_id)`, `(student_id, completed_at)`** |
| `question_attempts` | PK only | `(attempt_id)`, `(question_id)` |
| `student_activity` | PK only | `(student_id, created_at)`, `(organization_id, created_at)` |
| `notifications` | 3 indexes | ✅ OK |
| `users` | PK + email + mobile + reg-id | `(organization_id, active_role)` for member lists |
| `user_roles` | PK + UNIQUE | `(user_id)`, `(organization_id, role_id)` |

---

## 8. Cross-cutting verdict

| Concern | Verdict |
|---|---|
| **Referential integrity** | ❌ Soft FKs everywhere on `subject`, polymorphic columns on resources, no FK on activity reference_id. |
| **Indexing** | ❌ Most hot tables have only a PK. `quiz_questions(quiz_id)` and `student_attempts(student_id, quiz_id)` are screaming for indexes. |
| **N+1 queries** | ❌ `/classrooms/student`, `/students/subjects`, quiz-attempt insert loop, media signing. |
| **Tenant isolation** | ❌ Application-only. The `42703` fallback in classroom-service drops the org filter on column-missing errors. RLS would have caught this. |
| **Naming** | ❌ Two submission tables, two user-org tables, `student_attempts` lies about its scope, `topic_content_assignments` overloads "assignment". |
| **Audit / soft-delete** | ❌ Missing on most tables. |
| **Idempotency** | ❌ Quiz attempts and invoice payments can both double-write on retries. |
| **Caching** | ❌ Subjects/home/classrooms recomputed on every request. |
| **Vocabulary** | ❌ class/grade/standard, links/mappings/assignments — no glossary. |
| **Dead tables** | ❌ `assignment_submissions`, `notification_schedules`, possibly `parent_feedback` vs `parent_assessments`. |
| **Missing tables we pretend exist** | ❌ `payments`, `subject_aliases`, `class_levels`, `question_types`, `audit_log`, `feature_flags`, `webhooks`. |

---

## 9. The single most important fix

If the team can only do **one** thing this quarter:

> **Promote the four soft FKs to hard FKs and add the seven missing indexes.**
> ```
> subject_id  on content_topics, learning_contents, quizzes, teacher_standard_subjects
> idx_quiz_questions(quiz_id)
> idx_student_attempts(student_id, quiz_id)
> idx_student_attempts(student_id, completed_at DESC)
> idx_classrooms(organization_id, class_level)
> idx_quizzes(organization_id, class_level, subject)
> idx_student_activity(student_id, created_at DESC)
> idx_subjects_lower_title (functional)
> ```

That alone removes today's drift class of bugs **and** makes the hottest queries 10–100× faster. Everything else (renames, soft-delete, audit columns, payments table, RLS) can ship in subsequent migrations without coupling.

---

## 10. WHAT GOT FIXED (2026-05-30 multi-tenant hardening)

This section logs the hardening pass that turned most of the issues above into
either fixed-in-DB or fixed-in-code. Migrations live under `/migrations/` and
are applied in order via `npm run migrate`.

### 10.1 Critical bug fixed — tenant data leak (was live)

`users.organization_id` does not exist as a column. Two services were running
queries against it inside a `try/catch (42703)` block whose **fallback dropped
the org filter**, returning data unfiltered by tenant:

- `classroom-service GET /classrooms/student` — every student feed silently
  fell through to a query without any `organization_id` clause.
- `quiz-service GET /quizzes/teacher/class-activity` — same column reference,
  plus a second bug (`u.role` doesn't exist; real column is `active_role`).

Both were rewritten to enforce tenant scoping via `INNER JOIN user_roles ur ON
ur.organization_id = $orgId`, matching the pattern already used in
`assignment-service`. The 42703 fallbacks were removed.

### 10.2 Migrations applied

| # | File | Effect |
|---|---|---|
| 0000 | `0000_schema_migrations.sql` | Bootstraps the migration tracker. |
| 0001 | `0001_hot_path_indexes.sql` | 31 indexes — `quiz_questions(quiz_id)`, `student_attempts(student_id, quiz_id)` and `(student_id, completed_at DESC)`, `classrooms(organization_id, class_level)`, `subjects(class_level, LOWER(title))`, etc. |
| 0002 | `0002_subject_id_fks.sql` | Adds `subject_id UUID REFERENCES subjects(id)` to `content_topics`, `learning_contents`, `quizzes`, `teacher_standard_subjects`. Backfilled 77 rows with the cross-org-preferred lookup. **0 unmatched rows.** Application code now writes `subject_id` automatically on INSERT/UPDATE in topic/content/quiz services. |
| 0003 | `0003_idempotency_and_constraints.sql` | Adds `idempotency_key` to `student_attempts` with a partial UNIQUE; cleaned up an existing double-submit row. CHECK constraints: score/total_points sane, classrooms.class_level non-blank, subjects.title non-blank. |
| 0004 | `0004_rls_tenant_isolation.sql` | Postgres RLS policies installed on 8 tables (subjects, content_topics, learning_contents, quizzes, classrooms, stories, notifications, student_activity). **Dormant today** because `postgres` superuser bypasses RLS — activated by switching service DB user to a non-superuser role and adding a `SET LOCAL app.org_id = …` middleware (see §10.4). |
| 0005 | `0005_lookup_tables.sql` | New `class_levels` table seeded with LKG/UKG/1–12/ANY. New `subject_aliases` table seeded with the well-known aliases (Maths, GK, EVS, Stories, Computer, etc.) — they're now queryable instead of trapped in `seed.ts`. |

### 10.3 Application changes

| File | Change |
|---|---|
| `backend/classroom-service/src/routes/classrooms.ts` | Removed 3 `42703` fallbacks; users-org check now via `user_roles` join. |
| `backend/quiz-service/src/routes/quizzes.ts` | `/teacher/class-activity` rewired through `user_roles`; `u.role` → `u.active_role`. |
| `backend/quiz-service/src/routes/quizzes.ts` | `POST /quizzes/attempts` honours optional `idempotencyKey` (body) and `Idempotency-Key` (header). Repeated submissions return the existing attempt id with `idempotent: true`. |
| `backend/quiz-service/src/routes/quizzes.ts` | INSERT/UPDATE on `quizzes` populate `subject_id` via subquery against `subjects`. |
| `backend/topic-service/src/routes/topics.ts` | INSERT on `content_topics` populates `subject_id`. PATCH re-resolves `subject_id` after every update. |
| `backend/content-service/src/routes/content.ts` | INSERT/UPDATE on `learning_contents` populate `subject_id`. |
| `scripts/migrate.cjs` | New idempotent migration runner that records each application in `schema_migrations` with checksum + duration. |
| `package.json` | Added `npm run migrate` and `npm run migrate:status`. |

### 10.4 How to activate Phase 4 RLS (open work)

RLS is installed but currently a no-op because the app connects as `postgres`
(superuser). To turn it on:

1. Create a non-superuser role:
   ```sql
   CREATE ROLE els_app LOGIN PASSWORD '...';
   GRANT USAGE ON SCHEMA public TO els_app;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO els_app;
   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO els_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO els_app;
   ```
2. Switch every service's `DATABASE_URL` / connection pool to use `els_app`.
3. In `backend/shared/internal-auth`, add a request middleware:
   ```ts
   await client.query(`SET LOCAL app.org_id  = $1`, [orgId]);
   await client.query(`SET LOCAL app.user_id = $1`, [userId]);
   ```
   (Prefer pooled-client middleware so each request gets a fresh `SET LOCAL`
   inside its own transaction.)
4. Add an integration test that sets `app.org_id` to `'00000000-...'` and
   asserts every domain query returns 0 rows.
5. Once green in staging, copy the policies onto the remaining tenant tables
   (`achievements`, `student_activity` already done; add
   `student_analytics`, `assets`, `classroom_*`, `parent_*`, `invoices`,
   `organization_subscriptions`).

### 10.5 What's deliberately deferred

- **Renaming misleading tables** (`student_attempts → quiz_attempts`,
  `classroom_assignments → assignments`, `topic_content_assignments →
  topic_content_items`, etc.) — high blast radius across all services and
  the seed. Plan: ship one rename per PR with a rollback alias view.
- **Dropping dead `assignment_submissions`** — table has 0 rows but its CREATE
  statement still lives in `auth-service/src/seed/seed.ts`. Drop after the
  seed code is stripped.
- **`payments` table** — billing flow currently overloads `invoices.payment_*`
  columns. Real `payments` table with FK to `invoices` is a follow-up PR.
- **Postgres enums for `class_level` / `quiz_kind`** — would require
  rewriting every column in many tables; the new `class_levels` lookup table
  gives most of the benefit without that churn.
- **Dropping legacy `subject` text columns** — kept for now so old code paths
  keep working. Drop in a future migration once every reader uses
  `subject_id`.

### 10.6 Multi-tenant safety scorecard

| Concern | Before | After |
|---|---|---|
| Tenant filter dropped on student feed | YES (silent 42703 fallback) | **NO** (hard fail) |
| Subject string drift causing missing covers | YES (today: GK / EVS / Stories) | **0** soft-FK orphans, hard FK ready |
| Quiz attempt double-submit | Confirmed in DB | **Idempotency key** kills retries |
| Hot-table indexes | PK only on quiz_questions, student_attempts, classrooms | **31 covering indexes** |
| Schema changes auditable | Manual SQL | **`schema_migrations` tracker** |
| Defence-in-depth at DB level | None | **RLS policies on 8 tables, ready to activate** |
| Aliases queryable | `seed.ts` arrays only | **`subject_aliases` table** |
| Class levels typed | Free-text VARCHAR | **`class_levels` lookup table** (column-level enforcement is the next migration) |

---

## Appendix: Tables touched in today's drift

| Table | What we fixed | How |
|---|---|---|
| `subjects` | `GK → General Knowledge`, `EVS → Environmental Studies` (LKG, ELS Academy) — cover preserved | `UPDATE … RETURNING` |
| `content_topics` | 2 LKG rows: `EVS → Environmental Studies` | `UPDATE` |
| `learning_contents` | 2 LKG rows: `EVS → Environmental Studies` | `UPDATE` |
| `quizzes` | 2 LKG rows: `EVS → Environmental Studies`; 5 LKG `Stories → Rhymes & Stories`; 1 LKG `Nature → Environmental Studies`; 1 class-1 `Animals → Environmental Studies (EVS)` | `UPDATE` |
| `subjects` (seed) | +17 missing rows across 2 orgs × 6 classes | `scripts/seed_subjects_for_all_classes.cjs` |

Final audit after cleanup: **0 mismatches** anywhere.
