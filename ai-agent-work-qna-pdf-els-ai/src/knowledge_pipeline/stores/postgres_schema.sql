CREATE TABLE IF NOT EXISTS books (
    book_id         TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    subject         TEXT,
    curriculum      TEXT,
    domain          TEXT,
    class_level     TEXT,
    creator_id      TEXT,
    organization_id TEXT,
    language        TEXT DEFAULT 'en',
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS concepts (
    concept_id          TEXT PRIMARY KEY,
    book_id             TEXT REFERENCES books(book_id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    concept_type        TEXT,
    topic               TEXT,
    subtopic            TEXT,
    definition          TEXT,
    level_band          TEXT,
    prerequisite_depth  INT DEFAULT 0,
    centrality          DOUBLE PRECISION DEFAULT 0,
    metadata            JSONB DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_concepts_book ON concepts(book_id);
CREATE INDEX IF NOT EXISTS idx_concepts_level ON concepts(level_band);
CREATE INDEX IF NOT EXISTS idx_concepts_topic ON concepts(topic);

CREATE TABLE IF NOT EXISTS concept_edges (
    source_id       TEXT REFERENCES concepts(concept_id) ON DELETE CASCADE,
    target_id       TEXT REFERENCES concepts(concept_id) ON DELETE CASCADE,
    relation_type   TEXT NOT NULL,
    weight          DOUBLE PRECISION DEFAULT 1.0,
    PRIMARY KEY (source_id, target_id, relation_type)
);
CREATE INDEX IF NOT EXISTS idx_edges_source ON concept_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON concept_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_edges_type ON concept_edges(relation_type);

CREATE TABLE IF NOT EXISTS chunks (
    chunk_id        TEXT PRIMARY KEY,
    book_id         TEXT REFERENCES books(book_id) ON DELETE CASCADE,
    concept_id      TEXT,
    topic           TEXT,
    level_band      TEXT,
    content         TEXT NOT NULL,
    token_estimate  INT,
    metadata        JSONB DEFAULT '{}'::jsonb,
    vector_point_id TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chunks_book ON chunks(book_id);
CREATE INDEX IF NOT EXISTS idx_chunks_concept ON chunks(concept_id);

CREATE TABLE IF NOT EXISTS level_profiles (
    concept_id           TEXT PRIMARY KEY REFERENCES concepts(concept_id) ON DELETE CASCADE,
    level_band           TEXT,
    intrinsic_difficulty TEXT,
    reasoning_level      TEXT,
    steps_required       INT,
    concepts_combined    INT,
    confidence           DOUBLE PRECISION,
    rationale            TEXT,
    source               TEXT
);

CREATE TABLE IF NOT EXISTS quizzes (
    quiz_id         TEXT PRIMARY KEY,
    book_id         TEXT,
    title           TEXT,
    subject         TEXT,
    class_level     TEXT,
    level_band      TEXT,
    creator_id      TEXT,
    organization_id TEXT,
    metadata        JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questions (
    question_id     TEXT PRIMARY KEY,
    quiz_id         TEXT REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
    concept_id      TEXT,
    question_type   TEXT,
    level_band      TEXT,
    bloom_level     TEXT,
    stem            TEXT NOT NULL,
    explanation     TEXT,
    svg             TEXT,
    diagram         JSONB,
    metadata        JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_questions_quiz ON questions(quiz_id);

CREATE TABLE IF NOT EXISTS options (
    option_id       TEXT PRIMARY KEY,
    question_id     TEXT REFERENCES questions(question_id) ON DELETE CASCADE,
    position        INT,
    text            TEXT,
    is_correct      BOOLEAN DEFAULT FALSE,
    svg             TEXT,
    diagram         JSONB,
    rationale       TEXT
);
CREATE INDEX IF NOT EXISTS idx_options_question ON options(question_id);
