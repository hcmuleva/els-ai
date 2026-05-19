# ELS-AI Architecture & Agent Guidelines

> [!IMPORTANT]
> **MANDATORY FOR ALL AI AGENTS:** Read and adhere strictly to the guidelines, naming conventions, and patterns documented here when extending or refactoring any part of the ELS-AI repository.

---

## 1. Database Schema & Conventions
All database entities use PostgreSQL. The schema initialization and seed logic are located inside `backend/auth-service/src/seed.ts`.

### Strict Naming Rules
*   **Column Names:** All database columns must use `snake_case` (e.g., `quiz_type`, `class_level`, `question_data`, `question_audio`, `background_music_url`).
*   **TypeScript Fields:** Map database `snake_case` columns to matching TS object properties or ensure proper serialization. Do not mix cases inconsistently.
*   **Active Role Updates:** User active role updates must be processed through the dedicated `/users/:id/active-role` API route which persists the role in the database before updating the client context.

---

## 2. API Contract Standards & Routing

All microservices are unified by the **API Gateway** running on port `4000`. The gateway dynamically proxies routes to respective target services:
*   `/auth/*` -> `auth-service` (Port `4001`)
*   `/users/*` -> `auth-service` (Port `4001`)
*   `/quizzes/*` -> `quiz-service` (Port `4002`)
*   `/ai/*` -> `ai-service` (Port `4003`)

### Authentication
*   **Login (`POST /auth/login`):** Expects `{ email, password }` and returns `{ accessToken, refreshToken, user }`.
*   **Register (`POST /auth/register`):** Expects `{ firstName, lastName, email, password, role }`.
*   **Refresh (`POST /auth/refresh`):** Accepts `{ refreshToken }` and returns new `{ accessToken, refreshToken }` for JWT rotation.

### Quiz & Playroom Engine
*   **List Quizzes (`GET /quizzes`):** Retrieves all published quiz templates.
*   **Get Quiz Details (`GET /quizzes/:id`):** Retrieves a quiz and all its associated interactive questions.
*   **Create Quiz (`POST /quizzes`):** Creates a quiz template record.
*   **Add Question (`POST /quizzes/:id/questions`):** Appends questions to a quiz template.
*   **Submit Attempt (`POST /quizzes/attempts`):** Records student scores and responses.

### AI Generation
*   **Generate Playroom (`POST /ai/generate`):** Expects `{ topic, classLevel, quizType, difficultyLevel }`. Generates matching themed quiz structures including:
    *   `title`, `description`
    *   `background_music_url` (ambient loops)
    *   `theme` (primary and background color tokens)
    *   `questions` matching types: `drag_drop` (matching cards) or `image_select` (audio prompt selections).

---

## 3. Mobile Playroom Engine Guidelines

### Cross-Platform Audio Playback
All audio prompts, sound effects, and background loops must go through `frontend/src/utils/audio.ts` using the unified `AudioManager` wrapper. This ensures:
*   On Native devices, uses `expo-av` for robust native audio decoding.
*   On Web previews (`react-native-web`), falls back to HTML5 `window.Audio` cleanly.

### High-Usability Kid UI
*   **`drag_drop` Worksheets:** Rather than complex touch gestures which clash with ScrollViews, use **Tap-To-Match** interaction:
    1. Student taps an animal card to select/highlight it (plays sound prompt).
    2. Student taps the target home slot to place the animal there.
*   **`image_select` Selectors:** Displays an interactive grid of visual cards, with a large, accessible volume button to play phonetic/verbal instructions.

### Cross-Platform Token Storage
Access tokens must be saved using the `storage.ts` utility which detects the runtime platform:
*   On Mobile: uses `expo-secure-store`.
*   On Web: falls back to `window.localStorage`.

---

## 4. Quality Control Checklist
Before proposing or finalizing any code changes:
1.  **Typechecking:** Run `npm run typecheck` in the repository root to verify all workspaces compile with zero errors.
2.  **Linting:** Ensure clean imports and proper code style according to the workspace's ESLint rules.
