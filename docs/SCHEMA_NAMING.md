# Schema Naming & Relationship Map

The legacy table names hide the relationships. This doc gives you the
canonical mental model and shows exactly **where to look for any X ↔ Y
relation**.

We solved the rename problem **without renaming any tables** by adding
read-only VIEWs with the canonical names (prefixed `v_`). Every analytics
query, dashboard, or new feature should read from the views. Writers (the
backend services) keep using the underlying tables.

> The canonical word for a "reusable learning item" is **content** (not
> "lesson"). The canonical word for a teaching cohort is **class** (not
> "classroom"). All view names follow this convention.

---

## 1. The mental model

```
ORGANIZATION
  └─ SUBJECT                                         (table: subjects                | view: v_subjects)
       └─ TOPIC                                      (table: content_topics          | view: v_topics)
            ├─ CONTENT  (reusable, m:n via bridge)   (table: learning_contents       | view: v_contents)
            │     ├─ SECTIONS                        (table: learning_content_sections | view: v_content_sections)
            │     └─ QUIZ-IN-SECTION                 (column: learning_content_sections.quiz_id | view: v_content_quiz)
            ├─ TOPIC-INLINE SECTIONS                 (table: topic_content_sections  | view: v_topic_sections)
            └─ QUIZ                                  (table: quizzes                 | view: v_quizzes)
                  └─ QUESTION                        (table: quiz_questions          | view: v_questions)
                        └─ RESPONSE (per attempt)    (table: question_attempts       | view: v_question_responses)

CLASS  (a teaching cohort, taught by a teacher, has students)
  ├─ CONTENT (assigned)                              (table: classroom_contents      | view: v_class_contents)
  ├─ QUIZ (assigned)                                 (table: classroom_quizzes       | view: v_class_quizzes)
  └─ ASSIGNMENT (homework)                           (table: classroom_assignments   | view: v_class_assignments)
        └─ SUBMISSION (per student)                  (table: classroom_assignment_submissions | view: v_student_class_assignment_submissions)

STUDENT
  └─ QUIZ ATTEMPT                                    (table: student_attempts        | view: v_quiz_attempts)
        └─ QUESTION RESPONSES                        (table: question_attempts       | view: v_question_responses)
```

---

## 2. Canonical name map

| Legacy table | Canonical view | Reasoning |
|---|---|---|
| `subjects` | `v_subjects` | already clear; view also exposes `aliases` collapsed string |
| `content_topics` | `v_topics` | `content_` prefix is redundant — there's no other kind of topic |
| `learning_contents` | **`v_contents`** | match the codebase / UI vocabulary |
| `learning_content_sections` | **`v_content_sections`** | mirrors content rename |
| `topic_content_assignments` | **`v_topic_contents`** | the topic ↔ content **bridge**; "assignments" was misleading because it overloaded with homework |
| `topic_content_sections` | **`v_topic_sections`** | sections that live **only** on a topic, not part of any reusable content |
| `learning_content_sections.quiz_id` | **`v_content_quiz`** | a quiz embedded inside a content section (section becomes a quiz section) |
| `quizzes` | `v_quizzes` | view also joins subject + topic so you don't have to |
| `quiz_questions` | `v_questions` | the table name implies a join table, but it's the question rows themselves |
| `student_attempts` | `v_quiz_attempts` | only quiz attempts live there |
| `question_attempts` | `v_question_responses` | a student doesn't "attempt" a question, they **respond** to it |
| `classroom_contents` | **`v_class_contents`** | classroom → class to match UI |
| `classroom_quizzes` | **`v_class_quizzes`** | classroom → class |
| `classroom_assignments` | **`v_class_assignments`** | homework given to a class |
| `classroom_assignment_submissions` | **`v_student_class_assignment_submissions`** | a submission of an assignment by a student |

---

## 3. "Where do I look for X ↔ Y?" — the cheat sheet

### Subject ↔ Topic
```sql
SELECT subject_title, topic_title FROM v_topics WHERE class_level = 'LKG';
```
- **FK on the topic side**: `content_topics.subject_id → subjects.id`
- **Legacy text column** (still present, will be dropped later): `content_topics.subject`

### Topic ↔ Content (m:n via bridge)
```sql
SELECT t.topic_title, c.content_title, tc.sort_order
  FROM v_topic_contents tc
  JOIN v_topics   t ON t.topic_id   = tc.topic_id
  JOIN v_contents c ON c.content_id = tc.content_id
WHERE t.topic_id = '<uuid>';
```
- **Bridge table**: `topic_content_assignments(topic_id, content_id, sort_order)`
- A content can appear in many topics; a topic has many contents.

### Topic ↔ Inline section (1:n; sections that don't belong to any content)
```sql
SELECT * FROM v_topic_sections WHERE topic_id = '<uuid>' ORDER BY section_order;
```
- These are sections shown directly inside a topic without ever being a
  reusable content. Use this when the topic itself acts like one big content.

### Content ↔ Section (1:n; sections of a reusable content)
```sql
SELECT * FROM v_content_sections WHERE content_id = '<uuid>' ORDER BY section_order;
```
- **FK**: `learning_content_sections.content_id → learning_contents.id`

### Content ↔ Quiz (a quiz embedded inside a content section)
```sql
SELECT content_title, section_title, quiz_title
  FROM v_content_quiz WHERE content_id = '<uuid>';
```
- The link is `learning_content_sections.quiz_id`. When set, the section
  acts as a quiz section instead of media/text.

### Topic ↔ Quiz (a quiz attached at topic level, not via a content)
```sql
SELECT topic_title, quiz_title FROM v_quizzes WHERE topic_id = '<uuid>';
```
- **FK on the quiz side**: `quizzes.topic_id → content_topics.id` (nullable —
  quizzes can be subject-level without a specific topic).

### Quiz ↔ Question
```sql
SELECT * FROM v_questions WHERE quiz_id = '<uuid>' ORDER BY sort_order;
```
- **FK**: `quiz_questions.quiz_id → quizzes.id` (CASCADE on delete).

### Student ↔ Quiz Attempt ↔ Question Response
```sql
-- Latest 20 attempts by a student with their per-question responses:
SELECT a.attempt_id, a.quiz_title, a.score_pct, r.question_id, r.is_correct
  FROM v_quiz_attempts a
  JOIN v_question_responses r ON r.attempt_id = a.attempt_id
WHERE a.student_id = '<uuid>'
ORDER BY a.completed_at DESC
LIMIT 20;
```
- **FK chain**: `student_attempts(student_id, quiz_id) → users.id, quizzes.id`;
  `question_attempts(attempt_id, question_id) → student_attempts.id, quiz_questions.id`.
- Repeat-submit safety lives in `student_attempts.idempotency_key` (partial UNIQUE).

### Class ↔ Contents / Quizzes / Assignments
```sql
SELECT content_id    FROM v_class_contents     WHERE class_id = '<uuid>';
SELECT quiz_id       FROM v_class_quizzes      WHERE class_id = '<uuid>';
SELECT assignment_id FROM v_class_assignments  WHERE class_id = '<uuid>';
```

### Class Assignment ↔ Student Submission
```sql
SELECT a.title, s.student_id, s.submitted_at
  FROM v_class_assignments a
  JOIN v_student_class_assignment_submissions s ON s.assignment_id = a.assignment_id
WHERE a.class_id = '<uuid>';
```

---

## 4. Rules of the road

1. **Reads** (analytics, dashboards, BI, ad-hoc SQL): always read from the
   `v_*` views — they hide the legacy column names and pre-join the obvious
   parents (subject/topic).
2. **Writes** still go through the underlying tables for now. The services
   already do this; new code should follow the same pattern.
3. **Adding a column?** Add it to the underlying table, then re-run the
   relevant `CREATE OR REPLACE VIEW` block from
   `migrations/0007_canonical_views_content_naming.sql`.
4. **Future renames** (real `ALTER TABLE … RENAME TO …`): one rename per PR,
   adding a backward-compatible alias view so consumers keep working.

---

## 5. The simplest gotcha to remember

There are **two kinds of "section"** in the system:

- `v_content_sections` — sections that belong to a **reusable content**
  (`learning_contents`). Multiple topics can pull in the same content and
  see the same sections.
- `v_topic_sections` — sections that live **only** on a single topic, not
  part of any reusable content. The topic acts as a single self-contained
  piece of content.

If you forget which is which: `v_topic_sections` lives on a topic only,
`v_content_sections` belongs to a reusable content.

And there are **two kinds of "quiz attached to learning material"**:

- `v_content_quiz` — a quiz embedded inside a content section
  (via `learning_content_sections.quiz_id`).
- `v_quizzes WHERE topic_id = ...` — a quiz attached directly to a topic
  (via `quizzes.topic_id`), independent of any content.
