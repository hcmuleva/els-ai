# Jev System One Integration & Content Generation Guide

## 📌 Overview
This document explains the architecture, implementation, and workflows of **Jev (TypeSafe System One)** in the ELS-AI platform. 

In our multi-agent EdTech system, Jev serves as the fast, deterministic **System One (classification, validation, confidence scoring)** layer, while generative LLMs (GPT/Claude/Gemini) act as the **System Two (conversational empathy, reasoning, content generation)** layer.

---

## ⚡ Summary: What Jev Does & Why We Use It

**Jev** is a high-speed, deterministic "System One" decision engine designed for instantaneous, structured evaluations. Rather than generating long conversational text (which is slow, costly, and prone to hallucinations), Jev operates as an **algorithmic gatekeeper and analyst**:

- **Sub-Second Execution (~40ms latency)**: Evaluates complex natural language inputs in parallel with bounded execution time.
- **Type-Safe Structured Output**: Guarantees strict outputs (`choice`, `boolean`, `score`) that directly populate database schemas without error-prone JSON parsing.
- **Verification without Hallucination**: Validates whether parent and student statements are grounded in evidence and sufficiently specific.

---

## 🎯 Key Use Cases in ELS-AI

### 1. 💬 Chatbot Turn Routing & Classification
- Categorizes multi-turn dialogue into strict buckets (`weakness_academic`, `strength_academic`, `behavior`, `unclear`).
- Determines the exact intent of parent observations in real time without slow LLM round-trips.

### 2. 🔍 Specificity Verification & Clarification Triggers
- Checks if observations contain concrete evidence (e.g., *"He struggles"* vs. *"He took 20 minutes to solve 3 division problems yesterday"*).
- Triggers instant, single-turn clarification questions when observations lack sufficient detail.

### 3. 🛡️ Quality Gating & Teacher Moderation Queues
- Auto-accepts verified, high-confidence observations into official student records (`chat_survey_entries`).
- Deflects ambiguous or low-confidence data to a live teacher review queue via Ably real-time events.

### 4. 📊 Student Academic Diagnostic Synthesis
- Ingests raw historical quiz metrics, accuracy rates, and missed concepts from the database.
- Synthesizes student state into structured diagnostic tokens:
  - **Mastery Tier**: *High Mastery*, *Steady Progress*, *Needs Targeted Support*, *Critical Intervention Required*.
  - **Risk Score**: Normalized 0–3 academic struggle index.
  - **Primary Weak Domain**: Isolates whether struggle stems from *Foundational Concepts*, *Calculation*, or *Comprehension*.

### 5. 🎯 Remedial Content & Quiz Generation Gating
- Feeds Jev-derived weak domains and pedagogical interventions directly into LLM prompts.
- Powers targeted 5-question remedial quizzes, practice worksheets, and personalized teacher action plans tailored to the exact concept gap.

---

## 🏗️ Architecture & Division of Responsibilities

```
                                  +-------------------+
                                  |    Expo Client    |
                                  | (React Native UI) |
                                  +---------+---------+
                                            |
                                            | (Strict Auth & Tenant Isolation)
                                            v
                                  +---------+---------+
                                  |     core-api      |
                                  | (ChatOrchestrator)|
                                  +---------+---------+
                                            |
                                            | Internal HTTP
                                            v
                                  +---------+---------+
                                  |    ai-service     |
                                  |    (JevClient)    |
                                  +----+---------+----+
                                       |         |
                      Sub-second calls |         | Context & Generation
                                       v         v
           +-----------------------------+     +-------------------------------+
           |    Jev System One Engine    |     |      Generative LLMs          |
           |  (Fast Structured Decisions)|     |  (Content & Dialogue Agents)  |
           +-----------------------------+     +-------------------------------+
           • Category routing                  • Conversational chat responses
           • Specificity checks                • Remedial quiz drafts
           • Risk scoring (0-3)                • Narrative teacher reports
           • Weak domain identification        • Pedagogical worksheets
```

### Core Design Rules
1. **No Client-Side Calls**: Mobile/web clients never contact Jev or LLMs directly; all traffic passes through `core-api` and `ai-service` to secure API keys and enforce tenant RLS.
2. **Jev Never Converses**: Jev returns only structured evaluations (`choice`, `boolean`, `score`). It never outputs free-form conversational messages to users.
3. **Provider Agnostic**: The engine connects via `openjev.sh`, OpenRouter (`typesafe/jev-1.13`), Vercel AI Gateway, or seamless local heuristic fallbacks when offline.

---

## ⚡ Core Jev Evaluation Primitives

Jev operates on three high-speed primitives defined in [`backend/ai-service/src/services/jevClient.ts`](file:///home/dhruv/work-dhruv/hph/els-ai/els-ai/backend/ai-service/src/services/jevClient.ts):

| Primitive | Type | Purpose | Example Output |
|---|---|---|---|
| `choice` | Multi-class Selection | Categorize observations or determine weak domains. Always includes `'unclear'`. | `choice: 'weakness_academic'` |
| `noul` / `boolean` | Binary Verification | Validates whether an assertion has enough concrete detail/validity. | `value: true` or `value: false` |
| `score` | Bounded Rating Scale | Rates concern severity, risk level, or performance trends on a fixed scale. | `value: 2` (Scale: 0–3) |

---

## 📥 1. Information Gathering & Extraction Workflow

When users interact with the chat bot (such as during parent observation surveys or student check-ins), Jev processes each turn through a **Verified Cascade**:

### Step-by-Step Flow
1. **Turn Ingestion**:
   - The user submits an observation (e.g., *"He gets stuck on long division and gives up after 5 minutes"*).
   - `core-api/chatOrchestrator.ts` combines the current survey topic, student metadata, and message into an evaluation payload.

2. **Jev Sub-Second Classification (`POST /ai/jev/evaluate`)**:
   - **Category Routing (`choice`)**: Classifies text into `weakness_academic`, `strength_academic`, `behavior`, or `unclear`.
   - **Specificity Gate (`boolean`)**: Determines if the response has actionable details without requiring follow-up.
   - **Concern Scoring (`score` 0–3)**: Quantifies urgency:
     - `0`: No concern (routine praise or neutral update)
     - `1`: Mild, monitor
     - `2`: Moderate, worth flagging
     - `3`: Needs urgent teacher attention

3. **Dynamic Clarification Loop**:
   - If Jev marks `specific_enough === false` and no clarification is pending, the chatbot pauses survey advancement and prompts:
     > *"Thank you for sharing that. Could you give a quick example or mention how often this happens? That will help us record the most helpful note for the teacher."*
   - Once clarified, the observation is updated and the survey continues.

4. **Quality Gating & Storage**:
   - **High-confidence & specific inputs**: Stored in Postgres table `chat_survey_entries` with status `auto_accepted`.
   - **Ambiguous (`unclear`) or low-specificity inputs**: Stored as `pending_review` and simultaneously published over Ably (`chat.reviews.{organizationId}`) to alert teachers in real time.

---

## 🩺 2. Student Diagnostic Synthesis

Before generating learning materials, the platform synthesizes real-time performance data using Jev in [`backend/core-api/src/services/auth/routes/students.ts`](file:///home/dhruv/work-dhruv/hph/els-ai/els-ai/backend/core-api/src/services/auth/routes/students.ts):

### Input Data Extracted from Database:
- Total quizzes attempted and average accuracy percentage.
- Highest scoring quiz vs. lowest scoring quiz topics.
- Specific missed question concepts and teacher remarks.

### Jev Diagnostic Output:
- **`masteryTier`**:
  - `High Mastery` (≥80% accuracy)
  - `Steady Progress` (65%–79%)
  - `Needs Targeted Support` (50%–64%)
  - `Critical Intervention Required` (<50%)
- **`riskScore`**: Numerical risk index (0 to 3).
- **`primaryWeakDomain`**: Identifies specific challenge areas:
  - `Foundational Concepts`
  - `Problem Solving & Calculation`
  - `Reading & Comprehension`
  - `Assessment Completion`
- **`recommendedIntervention`**: Recommended pedagogical action:
  - `Assign 5-question remedial quiz`
  - `Provide visual step-by-step lesson`
  - `1-on-1 tutoring check-in`
  - `Independent enrichment practice`

---

## 📝 3. Content Generation Workflow

Once information and diagnostics are synthesized by Jev, they feed directly into the generative pipelines:

### A. Targeted Remedial Quizzes & Practice Materials
- **Trigger**: Teacher or student clicks an action pill in the chatbot or diagnostic card ([`StudentDiagnosticCard.tsx`](file:///home/dhruv/work-dhruv/hph/els-ai/els-ai/frontend/src/components/chat/StudentDiagnosticCard.tsx)):
  > *"Draft a 5-question remedial quiz for {Student} targeting {primaryWeakDomain}."*
- **Constraint Injection**:
  - The orchestrator injects Jev's `primaryWeakDomain` and `riskScore` into the LLM prompt.
  - Quizzes are generated with calibrated difficulty, targeted distractors, and age-appropriate explanations addressing the exact concept gap.

### B. Action Plans & Teacher Report Cards
- Components like [`StudentReportCardModal.tsx`](file:///home/dhruv/work-dhruv/hph/els-ai/els-ai/frontend/src/components/chat/StudentReportCardModal.tsx) combine:
  1. Quantitative quiz metrics (percentages, streak counts).
  2. Jev diagnostic classifications (`masteryTier`, `riskScore`).
  3. Parent survey entries collected during chatbot sessions.
- Generative LLM agents produce an executive report summarizing progress, highlighting struggle areas, and prescribing actionable homework tasks.

---

## 🔌 API Reference (`ai-service`)

### 1. General Evaluation
```http
POST /ai/jev/evaluate
Content-Type: application/json

{
  "state": "Student ID: 123. Parent: He struggles with long division and fraction simplification.",
  "questions": {
    "category": {
      "type": "choice",
      "instructions": "Select report category",
      "choices": ["weakness_academic", "strength_academic", "behavior", "unclear"]
    },
    "specific_enough": {
      "type": "boolean",
      "instructions": "Is the response specific enough?"
    },
    "concern_level": {
      "type": "score",
      "instructions": "Rate concern severity",
      "scale": { "min": 0, "max": 3 }
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "category": { "choice": "weakness_academic" },
    "specific_enough": { "value": true },
    "concern_level": { "value": 2 }
  },
  "latencyMs": 42,
  "fallbackUsed": false
}
```

### 2. Fast Classification
```http
POST /ai/jev/classify
Content-Type: application/json

{
  "text": "The student cannot complete assignments on time",
  "choices": ["academic", "behavior", "attendance", "unclear"]
}
```

### 3. Fast Verification
```http
POST /ai/jev/verify
Content-Type: application/json

{
  "statement": "Parent claims student finished all reading homework",
  "evidence": "Reading log shows 0 entries completed this week"
}
```

### 4. Health & Provider Status
```http
GET /ai/jev/status
```

---

## 🛠️ Environment Configuration

Set these variables in `backend/ai-service/.env` or docker environment:

| Variable | Description | Default / Example |
|---|---|---|
| `OPENJEV_API_KEY` | API Key for OpenJEV System One service | `sk-jev-...` |
| `OPENJEV_URL` | Endpoint for direct OpenJEV service | `https://openjev.sh/v1/systemone` |
| `OPENROUTER_API_KEY` | Fallback provider API key | `sk-or-...` |
| `OPENROUTER_URL` | OpenRouter endpoint | `https://openrouter.ai/api/v1/chat/completions` |
| `VERCEL_AI_GATEWAY_URL` | Optional Vercel Gateway URL | `https://ai-gateway.vercel.sh/v1` |
| `AI_SERVICE_URL` | Internal service discovery URL | `http://localhost:4003` |

---

## 🛡️ Reliability & Resilience (Fail-Safe Heuristics)

- **Strict Timeout**: Jev calls execute with a tight 3.5s to 5s timeout (`AbortSignal.timeout`).
- **Graceful Fallback**: If external APIs return 429, 503, or time out, `jevClient.ts` and `chatOrchestrator.ts` activate deterministic heuristic fallbacks based on keyword matching and threshold rules.
- **Fail-Safe Routing**: If an observation cannot be definitively classified, it defaults to `unclear` and is routed to `pending_review` rather than dropping the data or blocking the parent.
