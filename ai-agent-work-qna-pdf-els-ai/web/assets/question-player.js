const app = document.getElementById("app");
const progressFill = document.getElementById("progressFill");
const progressLabel = document.getElementById("progressLabel");
const scoreChip = document.getElementById("scoreChip");

let quiz = null;
let sourceQuiz = null;
let subjectItems = [];
let selectedSubject = null;

function freshState(attemptSeed = Date.now()) {
  return {
    version: 2,
    index: 0,
    answers: {},
    submitted: {},
    hints: {},
    skipped: {},
    filters: { topic: "all", diagram: "all", status: "all" },
    completed: false,
    attemptSeed,
  };
}

let state = freshState();

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

function cleanTopicLabel(value, subject) {
  const label = String(value ?? "").trim();
  if (!label) return subject || "";
  const embeddedTopics = label.match(
    /^\s*(.+?),\s*across\s+all\s+embedded\s+topics\s*:/is,
  );
  if (embeddedTopics) return subject || embeddedTopics[1].trim() || "All topics";
  return label
    .replace(/\s+practice\s+pages\s+\d+\s*-\s*\d+\s*$/i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim();
}

function safeSvg(value) {
  if (!value) return "";
  const documentValue = new DOMParser().parseFromString(value, "image/svg+xml");
  const root = documentValue.documentElement;
  if (!root || root.tagName.toLowerCase() !== "svg") return "";
  root.querySelectorAll("script, foreignObject, iframe, object, embed").forEach((node) => node.remove());
  [root, ...root.querySelectorAll("*")].forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const unsafeUrl = /(?:javascript:|data:text\/html)/i.test(attribute.value);
      if (name.startsWith("on") || unsafeUrl) node.removeAttribute(attribute.name);
    });
  });
  return new XMLSerializer().serializeToString(root);
}

function storageKey() {
  return `question-player:${quiz?.quiz_id || "default"}`;
}

function restoreState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey()) || "null");
    if (saved && typeof saved === "object" && saved.version === 2) {
      state = {
        version: 2,
        index: Number.isInteger(saved.index) ? saved.index : 0,
        answers: saved.answers || {},
        submitted: saved.submitted || {},
        hints: saved.hints || {},
        skipped: saved.skipped || {},
        filters: {
          topic: saved.filters?.topic || "all",
          diagram: saved.filters?.diagram || "all",
          status: saved.filters?.status || "all",
        },
        completed: Boolean(saved.completed),
        attemptSeed: Number.isFinite(saved.attemptSeed) ? saved.attemptSeed : Date.now(),
      };
    } else if (saved) {
      localStorage.removeItem(storageKey());
    }
  } catch {
    localStorage.removeItem(storageKey());
  }
}

function shuffledQuestions(inputQuiz, attemptSeed) {
  return {
    ...inputQuiz,
    questions: inputQuiz.questions.map((question, questionIndex) => {
      const options = [...question.options];
      if (options.length < 2) return { ...question, options };
      const correct = options
        .map((option, index) => (option.is_correct ? index : -1))
        .filter((index) => index >= 0);
      let shuffled;
      if (correct.length === 1) {
        const targetIndex = (questionIndex + attemptSeed) % options.length;
        const rotation = (targetIndex - correct[0] + options.length) % options.length;
        shuffled = options.map(
          (_, index) => options[(index - rotation + options.length) % options.length],
        );
      } else {
        shuffled = options
          .map((option, index) => ({
            option,
            order: Math.sin(attemptSeed + questionIndex * 97 + index * 31),
          }))
          .sort((left, right) => left.order - right.order)
          .map((entry) => entry.option);
      }
      return { ...question, options: shuffled };
    }),
  };
}

function saveState() {
  localStorage.setItem(storageKey(), JSON.stringify(state));
}

function selectedFor(question) {
  return new Set(state.answers[question.id] || []);
}

function correctIndexes(question) {
  return new Set(
    question.options
      .map((option, index) => (option.is_correct ? index : -1))
      .filter((index) => index >= 0),
  );
}

function isCorrect(question) {
  const selected = selectedFor(question);
  const correct = correctIndexes(question);
  if (selected.size !== correct.size) return false;
  return [...selected].every((index) => correct.has(index));
}

function filteredEntries() {
  if (!quiz?.questions) return [];
  return quiz.questions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => {
      if (state.filters.topic !== "all" && question.topic !== state.filters.topic) {
        return false;
      }
      if (state.filters.diagram === "with" && !question.stem_svg) return false;
      if (state.filters.diagram === "without" && question.stem_svg) return false;
      const answered = Boolean(state.submitted[question.id]);
      const skipped = Boolean(state.skipped[question.id]);
      if (state.filters.status === "answered" && !answered) return false;
      if (state.filters.status === "skipped" && !skipped) return false;
      if (state.filters.status === "unanswered" && (answered || skipped)) return false;
      return true;
    });
}

function score(questions = quiz.questions) {
  return questions.reduce(
    (total, question) =>
      total + (state.submitted[question.id] && isCorrect(question) ? 1 : 0),
    0,
  );
}

function updateHeader() {
  const entries = filteredEntries();
  const total = entries.length;
  const position = entries.findIndex((entry) => entry.index === state.index);
  const current = total ? Math.max(1, position + 1) : 0;
  const percent = total ? (current / total) * 100 : 0;
  progressFill.style.width = `${percent}%`;
  progressLabel.textContent = total ? `${current} of ${total}` : "No questions";
  const questions = entries.map((entry) => entry.question);
  const skipped = questions.filter((question) => state.skipped[question.id]).length;
  scoreChip.textContent = `${score(questions)} correct · ${skipped} skipped`;
}

function hintFor(question) {
  const topic = String(question.topic || "").toLowerCase();
  if (topic.includes("trigonom")) {
    return "Rewrite the expression using a standard identity, then check the principal-value range or the required interval.";
  }
  if (topic.includes("inequal")) {
    return "Find the critical values first, place them on a sign chart, and test each resulting interval.";
  }
  if (topic.includes("equation")) {
    return "Look for a substitution or factorization that reduces the equation to a familiar lower-degree form.";
  }
  if (topic.includes("vector")) {
    return "Translate the geometry into vector components, then use magnitude or the scalar product as appropriate.";
  }
  if (
    topic.includes("integral") ||
    topic.includes("antiderivative") ||
    topic.includes("derivative")
  ) {
    return "Identify the governing calculus rule before substituting values. Keep the limits and signs visible at every step.";
  }
  if (topic.includes("progression") || topic.includes("sequence")) {
    return "Decide whether the pattern is arithmetic or geometric, then write the relevant nth-term or sum formula.";
  }
  if (
    topic.includes("geometry") ||
    topic.includes("polyhedra") ||
    topic.includes("solid") ||
    question.stem_svg
  ) {
    return "Mark the known lengths and angles, then identify the theorem that links them to the required quantity.";
  }
  return "List the known quantities, state what must be found, and eliminate options using the defining relation.";
}

function typeset() {
  if (!window.MathJax?.typesetPromise) return;
  if (window.MathJax.typesetClear) window.MathJax.typesetClear([app]);
  window.MathJax.typesetPromise([app]).catch(() => {});
}

function renderDiagram(question) {
  const svg = safeSvg(question.stem_svg);
  if (svg) {
    return `<div class="diagram-panel" role="img" aria-label="Diagram for this question">${svg}</div>`;
  }
  return `
    <div class="diagram-panel">
      <div class="diagram-empty">
        <div class="diagram-empty-icon" aria-hidden="true">ƒ</div>
        <strong>No diagram required</strong>
        <span>This question is designed to be solved symbolically.</span>
      </div>
    </div>`;
}

function optionMarkup(question, option, optionIndex, submitted) {
  const selected = selectedFor(question).has(optionIndex);
  const classes = ["option"];
  if (selected) classes.push("selected");
  if (submitted && option.is_correct) classes.push("correct");
  if (submitted && selected && !option.is_correct) classes.push("incorrect");

  let status = "";
  if (submitted && option.is_correct) status = "Correct";
  else if (submitted && selected) status = "Your answer";

  const rationale =
    submitted && option.rationale
      ? `<div class="option-rationale">${escapeHtml(option.rationale)}</div>`
      : "";
  const optionSvg = safeSvg(option.svg);

  return `
    <button
      class="${classes.join(" ")}"
      type="button"
      data-option="${optionIndex}"
      aria-pressed="${selected}"
      ${submitted ? "disabled" : ""}
    >
      <span class="option-key">${String.fromCharCode(65 + optionIndex)}</span>
      <span class="option-copy">
        ${escapeHtml(option.label || "")}
        ${optionSvg ? `<span class="option-diagram">${optionSvg}</span>` : ""}
      </span>
      <span class="option-status">${status}</span>
      ${rationale}
    </button>`;
}

function feedbackMarkup(question) {
  if (!state.submitted[question.id]) return "";
  const correct = isCorrect(question);
  const pages = (question.source_pages || []).map((page) => Number(page) + 1);
  const pageText = pages.length
    ? `Grounded in source pages ${Math.min(...pages)}–${Math.max(...pages)}.`
    : "Grounded in the validated source material.";
  return `
    <section
      class="feedback-card ${correct ? "correct-feedback" : "incorrect-feedback"}"
      aria-live="polite"
    >
      <div class="feedback-heading">
        <span class="feedback-icon" aria-hidden="true">${correct ? "✓" : "×"}</span>
        <h2>${correct ? "That’s correct" : "Not quite yet"}</h2>
      </div>
      <div class="explanation-label">How to solve it</div>
      <p class="explanation">${escapeHtml(question.explanation || "No explanation is available.")}</p>
      <div class="source-note">${escapeHtml(pageText)}</div>
    </section>`;
}

function topicOptions() {
  return [...new Set(quiz.questions.map((question) => question.topic).filter(Boolean))].sort(
    (left, right) =>
      left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }),
  );
}

function subjectOptions() {
  if (!subjectItems.length) {
    return '<option value="">No persisted subjects</option>';
  }
  return subjectItems
    .map(
      (item) =>
        `<option value="${escapeHtml(item.subject)}" ${
          selectedSubject === item.subject ? "selected" : ""
        }>${escapeHtml(item.subject)} (${item.question_count})</option>`,
    )
    .join("");
}

function filterMarkup() {
  const activeCount = filteredEntries().length;
  return `
    <section class="filter-bar" aria-label="Question filters">
      <div class="filter-heading">
        <div>
          <span class="filter-eyebrow">Question bank</span>
          <strong>Filter practice</strong>
        </div>
        <span class="result-count">${activeCount} question${activeCount === 1 ? "" : "s"}</span>
      </div>
      <label class="filter-field">
        <span>Subject</span>
        <select id="subjectFilter" ${subjectItems.length ? "" : "disabled"}>
          ${subjectOptions()}
        </select>
      </label>
      <label class="filter-field">
        <span>Topic</span>
        <select id="topicFilter">
          <option value="all">All topics</option>
          ${topicOptions()
            .map(
              (topic) =>
                `<option value="${escapeHtml(topic)}" ${
                  state.filters.topic === topic ? "selected" : ""
                }>${escapeHtml(topic)}</option>`,
            )
            .join("")}
        </select>
      </label>
      <label class="filter-field">
        <span>Diagram</span>
        <select id="diagramFilter">
          <option value="all" ${state.filters.diagram === "all" ? "selected" : ""}>All questions</option>
          <option value="with" ${state.filters.diagram === "with" ? "selected" : ""}>With diagram</option>
          <option value="without" ${state.filters.diagram === "without" ? "selected" : ""}>Without diagram</option>
        </select>
      </label>
      <label class="filter-field">
        <span>Progress</span>
        <select id="statusFilter">
          <option value="all" ${state.filters.status === "all" ? "selected" : ""}>Any status</option>
          <option value="unanswered" ${state.filters.status === "unanswered" ? "selected" : ""}>Unanswered</option>
          <option value="answered" ${state.filters.status === "answered" ? "selected" : ""}>Answered</option>
          <option value="skipped" ${state.filters.status === "skipped" ? "selected" : ""}>Skipped</option>
        </select>
      </label>
      <button class="refresh-questions" id="refreshQuestionsButton" type="button">Fetch new questions</button>
      <button class="reset-quiz" id="resetQuizButton" type="button">Reset quiz</button>
      <button class="filter-reset" id="resetFiltersButton" type="button">Clear filters</button>
    </section>`;
}

function bindFilters() {
  const controls = [
    ["topicFilter", "topic"],
    ["diagramFilter", "diagram"],
    ["statusFilter", "status"],
  ];
  controls.forEach(([id, key]) => {
    document.getElementById(id).addEventListener("change", (event) => {
      state.filters[key] = event.target.value;
      state.completed = false;
      const first = filteredEntries()[0];
      if (first) state.index = first.index;
      saveState();
      render();
    });
  });
  document.getElementById("subjectFilter").addEventListener("change", async (event) => {
    if (!event.target.value || event.target.value === selectedSubject) return;
    await loadSubject(event.target.value);
  });
  document.getElementById("refreshQuestionsButton").addEventListener("click", async () => {
    await refreshQuestions();
  });
  document.getElementById("resetQuizButton").addEventListener("click", () => {
    if (window.confirm("Reset every answer, skipped question, hint, and filter?")) {
      resetQuiz();
    }
  });
  document.getElementById("resetFiltersButton").addEventListener("click", () => {
    state.filters = { topic: "all", diagram: "all", status: "all" };
    state.completed = false;
    state.index = 0;
    saveState();
    render();
  });
}

function resetQuiz() {
  const oldPosition = state.attemptSeed % 4;
  let nextSeed = Date.now();
  while (nextSeed % 4 === oldPosition) nextSeed += 1;
  localStorage.removeItem(storageKey());
  state = freshState(nextSeed);
  quiz = shuffledQuestions(sourceQuiz, state.attemptSeed);
  saveState();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderQuestion() {
  const question = quiz.questions[state.index];
  const entries = filteredEntries();
  const filteredPosition = entries.findIndex((entry) => entry.index === state.index);
  const submitted = Boolean(state.submitted[question.id]);
  const selected = selectedFor(question);
  const multi = question.type === "multi_choice";
  const hintVisible = Boolean(state.hints[question.id]);
  const skipped = Boolean(state.skipped[question.id]);

  app.innerHTML = `
    ${filterMarkup()}
    <section class="player-intro">
      <div>
        <p class="eyebrow">${escapeHtml(
          [quiz.class_level ? `Class ${quiz.class_level}` : null, quiz.subject]
            .filter(Boolean)
            .join(" · ") || "Question practice",
        )}</p>
        <h1>${escapeHtml(question.topic || "Practice question")}</h1>
      </div>
      <p>Work through the problem carefully. Use the hint only if you need a nudge, then review the full reasoning.</p>
    </section>
    <div class="player-grid">
      <div>
        <article class="question-card">
          <div class="question-body">
            <div class="question-meta">
              <span class="pill">${escapeHtml(question.level_band || quiz.level_band || "JEE Main")}</span>
              ${question.bloom_level ? `<span class="pill subtle">${escapeHtml(question.bloom_level)}</span>` : ""}
              ${skipped && !submitted ? '<span class="pill skipped-pill">Skipped</span>' : ""}
              <span class="question-number">Question ${filteredPosition + 1} of ${entries.length}</span>
            </div>
            <h2 class="question-stem">${escapeHtml(question.stem)}</h2>
            <p class="instruction">${escapeHtml(
              question.instruction ||
                (multi ? "Select every correct answer." : "Choose the best answer."),
            )}</p>
            <div class="options" role="group" aria-label="Answer choices">
              ${question.options
                .map((option, index) => optionMarkup(question, option, index, submitted))
                .join("")}
            </div>
            ${feedbackMarkup(question)}
          </div>
          <footer class="question-actions">
            <div class="action-group">
              <button class="button secondary" id="previousButton" type="button" ${
                filteredPosition <= 0 ? "disabled" : ""
              }>Previous</button>
              ${
                submitted && !isCorrect(question)
                  ? '<button class="button secondary" id="retryButton" type="button">Try again</button>'
                  : ""
              }
            </div>
            ${
              submitted
                ? `<button class="button primary" id="nextButton" type="button">${
                    filteredPosition === entries.length - 1 ? "Finish" : "Next question"
                  }</button>`
                : `<div class="submit-group">
                    <button class="button skip" id="skipButton" type="button">Skip question</button>
                    <button class="button primary" id="submitButton" type="button" ${
                      selected.size ? "" : "disabled"
                    }>Check answer</button>
                  </div>`
            }
          </footer>
        </article>
      </div>
      <aside class="sidebar">
        <section class="side-card">
          <div class="side-card-header">
            <h2>Question diagram</h2>
            <span>${question.stem_svg ? "Use the figure" : "Optional"}</span>
          </div>
          ${renderDiagram(question)}
        </section>
        <section class="side-card hint-card">
          <button
            class="hint-button"
            id="hintButton"
            type="button"
            aria-expanded="${hintVisible}"
            aria-controls="hintText"
          >${hintVisible ? "Hide hint" : "Show a hint"}</button>
          ${
            hintVisible
              ? `<p class="hint" id="hintText">${escapeHtml(hintFor(question))}</p>`
              : ""
          }
        </section>
      </aside>
    </div>
    <p class="keyboard-note">Keyboard: 1–4 choose an option, H shows the hint, S skips, Enter checks or advances.</p>`;

  bindFilters();
  app.querySelectorAll("[data-option]").forEach((button) => {
    button.addEventListener("click", () => selectOption(question, Number(button.dataset.option)));
  });
  document.getElementById("hintButton").addEventListener("click", () => {
    state.hints[question.id] = !hintVisible;
    saveState();
    render();
  });
  const submitButton = document.getElementById("submitButton");
  if (submitButton) {
    submitButton.addEventListener("click", () => submit(question));
  }
  const skipButton = document.getElementById("skipButton");
  if (skipButton) {
    skipButton.addEventListener("click", () => skipQuestion(question));
  }
  const retryButton = document.getElementById("retryButton");
  if (retryButton) {
    retryButton.addEventListener("click", () => {
      delete state.submitted[question.id];
      state.answers[question.id] = [];
      saveState();
      render();
    });
  }
  const previousButton = document.getElementById("previousButton");
  previousButton.addEventListener("click", () => move(-1));
  const nextButton = document.getElementById("nextButton");
  if (nextButton) nextButton.addEventListener("click", () => move(1));
  updateHeader();
  typeset();
}

function selectOption(question, optionIndex) {
  if (state.submitted[question.id]) return;
  const selected = selectedFor(question);
  if (question.type === "multi_choice") {
    selected.has(optionIndex) ? selected.delete(optionIndex) : selected.add(optionIndex);
  } else {
    selected.clear();
    selected.add(optionIndex);
  }
  state.answers[question.id] = [...selected];
  saveState();
  render();
}

function submit(question) {
  if (!selectedFor(question).size) return;
  delete state.skipped[question.id];
  state.submitted[question.id] = true;
  saveState();
  render();
}

function skipQuestion(question) {
  const entries = filteredEntries();
  const position = entries.findIndex((entry) => entry.index === state.index);
  const nextEntry = entries[position + 1];
  state.skipped[question.id] = true;
  delete state.submitted[question.id];
  delete state.answers[question.id];

  const remaining = filteredEntries();
  if (nextEntry && remaining.some((entry) => entry.index === nextEntry.index)) {
    state.index = nextEntry.index;
  } else if (state.filters.status !== "all" && remaining.length) {
    state.index = remaining[0].index;
  } else {
    state.completed = true;
  }
  saveState();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function move(delta) {
  const entries = filteredEntries();
  const position = entries.findIndex((entry) => entry.index === state.index);
  const next = position + delta;
  if (next >= entries.length) {
    state.completed = true;
    saveState();
    renderCompletion();
    return;
  }
  if (next < 0) return;
  state.index = entries[next].index;
  state.completed = false;
  saveState();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderCompletion() {
  const entries = filteredEntries();
  const questions = entries.map((entry) => entry.question);
  const total = questions.length;
  const correct = score(questions);
  const skipped = questions.filter((question) => state.skipped[question.id]).length;
  app.innerHTML = `
    ${filterMarkup()}
    <section class="completion-card">
      <p class="eyebrow">Practice complete</p>
      <h1>Review your result</h1>
      <div class="completion-score">${correct} / ${total}</div>
      <p>${skipped} skipped. You can return to the last filtered question or start again with a clean attempt.</p>
      <div class="action-group" style="justify-content:center; margin-top:22px">
        <button class="button secondary" id="backButton" type="button">Back to questions</button>
        <button class="button primary" id="restartButton" type="button">Start again</button>
      </div>
    </section>`;
  bindFilters();
  document.getElementById("backButton").addEventListener("click", () => {
    const currentEntries = filteredEntries();
    state.index = currentEntries[currentEntries.length - 1]?.index || 0;
    state.completed = false;
    saveState();
    render();
  });
  document.getElementById("restartButton").addEventListener("click", () => {
    resetQuiz();
  });
  updateHeader();
}

function render() {
  if (!quiz?.questions?.length) {
    app.innerHTML = `
      ${quiz ? filterMarkup() : ""}
      <section class="empty-state">
        <div>
          <h1>No persisted questions found</h1>
          <p>Generate validated questions with persistence enabled, then fetch new questions.</p>
        </div>
      </section>`;
    if (quiz) bindFilters();
    updateHeader();
    return;
  }
  const entries = filteredEntries();
  if (!entries.length) {
    app.innerHTML = `
      ${filterMarkup()}
      <section class="empty-state filtered-empty">
        <div>
          <h1>No questions match these filters</h1>
          <p>Change a filter or reset them to return to the full question bank.</p>
          <button class="button primary" id="emptyResetButton" type="button">Reset filters</button>
        </div>
      </section>`;
    bindFilters();
    document.getElementById("emptyResetButton").addEventListener("click", () => {
      state.filters = { topic: "all", diagram: "all", status: "all" };
      state.index = 0;
      state.completed = false;
      saveState();
      render();
    });
    updateHeader();
    return;
  }
  if (!entries.some((entry) => entry.index === state.index)) {
    state.index = entries[0].index;
  }
  if (state.completed) {
    renderCompletion();
  } else {
    renderQuestion();
  }
}

function renderLoading(message = "Fetching persisted questions…") {
  app.innerHTML = `
    <section class="loading" aria-live="polite">
      <div>
        <div class="loading-spinner" aria-hidden="true"></div>
        <div>${escapeHtml(message)}</div>
      </div>
    </section>`;
}

async function fetchSubjects() {
  const response = await fetch("/api/player/subjects", { cache: "no-store" });
  if (!response.ok) throw new Error(await response.text());
  const result = await response.json();
  subjectItems = result.items || [];
}

async function loadSubject(subject) {
  renderLoading();
  const query = subject ? `?subject=${encodeURIComponent(subject)}` : "";
  const response = await fetch(`/api/player${query}`, { cache: "no-store" });
  if (!response.ok) throw new Error(await response.text());
  sourceQuiz = await response.json();
  sourceQuiz.questions = (sourceQuiz.questions || []).map((question) => ({
    ...question,
    topic: cleanTopicLabel(question.topic, sourceQuiz.subject || subject),
  }));
  selectedSubject = sourceQuiz.subject || subject || null;
  quiz = sourceQuiz;
  state = freshState();
  restoreState();
  if (
    state.filters.topic !== "all" &&
    !quiz.questions.some((question) => question.topic === state.filters.topic)
  ) {
    state.filters.topic = "all";
  }
  quiz = shuffledQuestions(sourceQuiz, state.attemptSeed);
  const url = new URL(window.location.href);
  if (selectedSubject) url.searchParams.set("subject", selectedSubject);
  else url.searchParams.delete("subject");
  window.history.replaceState({}, "", url);
  render();
}

async function refreshQuestions() {
  renderLoading("Refreshing subjects and persisted questions…");
  await fetchSubjects();
  const available = subjectItems.map((item) => item.subject);
  const subject = available.includes(selectedSubject) ? selectedSubject : available[0] || null;
  await loadSubject(subject);
}

async function start() {
  await fetchSubjects();
  const requested = new URL(window.location.href).searchParams.get("subject");
  const available = subjectItems.map((item) => item.subject);
  const subject = available.includes(requested) ? requested : available[0] || null;
  await loadSubject(subject);
}

window.addEventListener("keydown", (event) => {
  if (!quiz?.questions?.length || state.index >= quiz.questions.length) return;
  if (event.target.closest?.("button, select, input, textarea")) return;
  const question = quiz.questions[state.index];
  if (/^[1-4]$/.test(event.key) && !state.submitted[question.id]) {
    const optionIndex = Number(event.key) - 1;
    if (question.options[optionIndex]) selectOption(question, optionIndex);
  } else if (event.key.toLowerCase() === "h") {
    state.hints[question.id] = !state.hints[question.id];
    saveState();
    render();
  } else if (event.key.toLowerCase() === "s" && !state.submitted[question.id]) {
    skipQuestion(question);
  } else if (event.key === "Enter") {
    if (state.submitted[question.id]) move(1);
    else submit(question);
  }
});

window.addEventListener("mathjax-ready", typeset);

start().catch((error) => {
  app.innerHTML = `
    <section class="empty-state">
      <div>
        <h1>Unable to load the player</h1>
        <p>${escapeHtml(error.message)}</p>
      </div>
    </section>`;
});
