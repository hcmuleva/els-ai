"""SQLite relational backend - a drop-in for PostgresStore with no server.

Mirrors PostgresStore's public interface (init_schema, load_book_assets,
upsert_edges, insert_quiz, prerequisite_chain, related_concepts,
concepts_by_topic). SQLite supports WITH RECURSIVE and UPSERT, so the relation
traversal semantics match Postgres. JSON columns are stored as TEXT.
"""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

from ..topic_labels import clean_topic_label
from ..serving.player import deduplicate_questions

_DDL = """
CREATE TABLE IF NOT EXISTS books (
    book_id TEXT PRIMARY KEY, title TEXT NOT NULL, subject TEXT, curriculum TEXT, domain TEXT,
    class_level TEXT, creator_id TEXT, organization_id TEXT, language TEXT DEFAULT 'en',
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS concepts (
    concept_id TEXT PRIMARY KEY, book_id TEXT, name TEXT NOT NULL, concept_type TEXT, topic TEXT,
    subtopic TEXT, definition TEXT, level_band TEXT, prerequisite_depth INTEGER DEFAULT 0,
    centrality REAL DEFAULT 0, metadata TEXT DEFAULT '{}', created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_concepts_book ON concepts(book_id);
CREATE INDEX IF NOT EXISTS idx_concepts_topic ON concepts(topic);
CREATE TABLE IF NOT EXISTS concept_edges (
    source_id TEXT, target_id TEXT, relation_type TEXT NOT NULL, weight REAL DEFAULT 1.0,
    PRIMARY KEY (source_id, target_id, relation_type)
);
CREATE INDEX IF NOT EXISTS idx_edges_source ON concept_edges(source_id);
CREATE TABLE IF NOT EXISTS chunks (
    chunk_id TEXT PRIMARY KEY, book_id TEXT, concept_id TEXT, topic TEXT, level_band TEXT,
    content TEXT NOT NULL, token_estimate INTEGER, metadata TEXT DEFAULT '{}',
    vector_point_id TEXT, created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chunks_concept ON chunks(concept_id);
CREATE TABLE IF NOT EXISTS level_profiles (
    concept_id TEXT PRIMARY KEY, level_band TEXT, intrinsic_difficulty TEXT, reasoning_level TEXT,
    steps_required INTEGER, concepts_combined INTEGER, confidence REAL, rationale TEXT, source TEXT
);
CREATE TABLE IF NOT EXISTS quizzes (
    quiz_id TEXT PRIMARY KEY, book_id TEXT, title TEXT, subject TEXT, class_level TEXT,
    level_band TEXT, creator_id TEXT, organization_id TEXT, metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS questions (
    question_id TEXT PRIMARY KEY, quiz_id TEXT, concept_id TEXT, question_type TEXT, level_band TEXT,
    bloom_level TEXT, stem TEXT NOT NULL, explanation TEXT, svg TEXT, diagram TEXT,
    metadata TEXT DEFAULT '{}', created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_questions_quiz ON questions(quiz_id);
CREATE TABLE IF NOT EXISTS options (
    option_id TEXT PRIMARY KEY, question_id TEXT, position INTEGER, text TEXT,
    is_correct INTEGER DEFAULT 0, svg TEXT, diagram TEXT, rationale TEXT
);
CREATE INDEX IF NOT EXISTS idx_options_question ON options(question_id);
"""


def _j(value: Any) -> str:
    return json.dumps(value or {}, ensure_ascii=False)


class SqliteStore:
    def __init__(self, path: str) -> None:
        self.path = path
        if path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)

    def connect(self):
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_schema(self) -> None:
        with self.connect() as conn:
            conn.executescript(_DDL)
            conn.commit()

    def load_book_assets(
        self,
        book: Dict[str, Any],
        concepts: Sequence[Dict[str, Any]],
        edges: Sequence[Dict[str, Any]],
        chunks: Sequence[Dict[str, Any]],
        level_profiles: Sequence[Dict[str, Any]],
    ) -> Dict[str, int]:
        with self.connect() as conn:
            conn.execute(
                """INSERT INTO books (book_id,title,subject,curriculum,domain,class_level,
                   creator_id,organization_id,language)
                   VALUES (:book_id,:title,:subject,:curriculum,:domain,:class_level,
                   :creator_id,:organization_id,:language)
                   ON CONFLICT(book_id) DO UPDATE SET title=excluded.title,subject=excluded.subject,
                   curriculum=excluded.curriculum,domain=excluded.domain,class_level=excluded.class_level,
                   creator_id=excluded.creator_id,organization_id=excluded.organization_id,
                   language=excluded.language""",
                book,
            )
            conn.executemany(
                """INSERT INTO concepts (concept_id,book_id,name,concept_type,topic,subtopic,
                   definition,level_band,prerequisite_depth,centrality,metadata)
                   VALUES (:concept_id,:book_id,:name,:concept_type,:topic,:subtopic,:definition,
                   :level_band,:prerequisite_depth,:centrality,:metadata)
                   ON CONFLICT(concept_id) DO UPDATE SET name=excluded.name,topic=excluded.topic,
                   definition=excluded.definition,level_band=excluded.level_band,
                   prerequisite_depth=excluded.prerequisite_depth,centrality=excluded.centrality,
                   metadata=excluded.metadata""",
                [{**c, "metadata": _j(c.get("metadata"))} for c in concepts],
            )
            if edges:
                self._edges(conn, edges)
            if chunks:
                conn.executemany(
                    """INSERT INTO chunks (chunk_id,book_id,concept_id,topic,level_band,content,
                       token_estimate,metadata,vector_point_id)
                       VALUES (:chunk_id,:book_id,:concept_id,:topic,:level_band,:content,
                       :token_estimate,:metadata,:vector_point_id)
                       ON CONFLICT(chunk_id) DO UPDATE SET content=excluded.content,
                       level_band=excluded.level_band,metadata=excluded.metadata,
                       vector_point_id=excluded.vector_point_id""",
                    [{**c, "metadata": _j(c.get("metadata"))} for c in chunks],
                )
            if level_profiles:
                conn.executemany(
                    """INSERT INTO level_profiles (concept_id,level_band,intrinsic_difficulty,
                       reasoning_level,steps_required,concepts_combined,confidence,rationale,source)
                       VALUES (:concept_id,:level_band,:intrinsic_difficulty,:reasoning_level,
                       :steps_required,:concepts_combined,:confidence,:rationale,:source)
                       ON CONFLICT(concept_id) DO UPDATE SET level_band=excluded.level_band,
                       confidence=excluded.confidence,rationale=excluded.rationale""",
                    list(level_profiles),
                )
            conn.commit()
        return {"concepts": len(concepts), "edges": len(edges), "chunks": len(chunks),
                "level_profiles": len(level_profiles)}

    @staticmethod
    def _edges(conn, edges: Sequence[Dict[str, Any]]) -> None:
        conn.executemany(
            """INSERT INTO concept_edges (source_id,target_id,relation_type,weight)
               VALUES (:source_id,:target_id,:relation_type,:weight)
               ON CONFLICT(source_id,target_id,relation_type) DO UPDATE SET weight=excluded.weight""",
            list(edges),
        )

    def upsert_edges(self, edges: Sequence[Dict[str, Any]]) -> int:
        if not edges:
            return 0
        with self.connect() as conn:
            self._edges(conn, edges)
            conn.commit()
        return len(edges)

    def insert_quiz(
        self,
        quiz: Dict[str, Any],
        questions: Sequence[Dict[str, Any]],
        options_by_question: Dict[str, Sequence[Dict[str, Any]]],
    ) -> None:
        with self.connect() as conn:
            conn.execute(
                """INSERT INTO quizzes (quiz_id,book_id,title,subject,class_level,level_band,
                   creator_id,organization_id,metadata)
                   VALUES (:quiz_id,:book_id,:title,:subject,:class_level,:level_band,
                   :creator_id,:organization_id,:metadata)
                   ON CONFLICT(quiz_id) DO UPDATE SET title=excluded.title,metadata=excluded.metadata""",
                {**quiz, "metadata": _j(quiz.get("metadata"))},
            )
            for q in questions:
                conn.execute(
                    """INSERT INTO questions (question_id,quiz_id,concept_id,question_type,level_band,
                       bloom_level,stem,explanation,svg,diagram,metadata)
                       VALUES (:question_id,:quiz_id,:concept_id,:question_type,:level_band,
                       :bloom_level,:stem,:explanation,:svg,:diagram,:metadata)
                       ON CONFLICT(question_id) DO UPDATE SET stem=excluded.stem,svg=excluded.svg,
                       diagram=excluded.diagram,metadata=excluded.metadata""",
                    {**q, "diagram": _j(q["diagram"]) if q.get("diagram") else None,
                     "metadata": _j(q.get("metadata"))},
                )
                for opt in options_by_question.get(q["question_id"], []):
                    conn.execute(
                        """INSERT INTO options (option_id,question_id,position,text,is_correct,
                           svg,diagram,rationale)
                           VALUES (:option_id,:question_id,:position,:text,:is_correct,:svg,
                           :diagram,:rationale)
                           ON CONFLICT(option_id) DO UPDATE SET text=excluded.text,
                           is_correct=excluded.is_correct,svg=excluded.svg,diagram=excluded.diagram""",
                        {**opt, "is_correct": int(bool(opt.get("is_correct"))),
                         "diagram": _j(opt["diagram"]) if opt.get("diagram") else None},
                    )
            conn.commit()

    def quiz_subjects(self) -> List[Dict[str, Any]]:
        sql = """
        SELECT qz.subject,
               COUNT(DISTINCT qz.quiz_id) AS quiz_count,
               COUNT(q.question_id) AS question_count,
               MAX(qz.created_at) AS latest_created_at
          FROM quizzes qz
          JOIN questions q ON q.quiz_id = qz.quiz_id
         WHERE NULLIF(TRIM(qz.subject), '') IS NOT NULL
         GROUP BY qz.subject
         ORDER BY MAX(qz.created_at) DESC, qz.subject COLLATE NOCASE
        """
        with self.connect() as conn:
            rows = conn.execute(sql).fetchall()
        items = []
        for row in rows:
            item = dict(row)
            item["question_count"] = self.load_player_quiz(
                subject=item["subject"], limit=1_000_000
            )["count"]
            items.append(item)
        return items

    def load_player_quiz(
        self,
        subject: Optional[str] = None,
        limit: int = 1000,
    ) -> Dict[str, Any]:
        sql = """
        SELECT qz.quiz_id, qz.title, qz.subject, qz.class_level, qz.level_band,
               qz.created_at, qz.metadata AS quiz_metadata,
               q.question_id, q.question_type, q.level_band AS question_level_band,
               q.bloom_level, q.stem, q.explanation, q.svg,
               q.metadata AS question_metadata
          FROM quizzes qz
          JOIN questions q ON q.quiz_id = qz.quiz_id
         WHERE NULLIF(TRIM(qz.subject), '') IS NOT NULL
        """
        params: Dict[str, Any] = {"limit": limit}
        if subject:
            sql += " AND qz.subject = :subject COLLATE NOCASE"
            params["subject"] = subject
        sql += """
         ORDER BY qz.created_at DESC, q.created_at, q.question_id
         LIMIT :limit
        """
        with self.connect() as conn:
            rows = conn.execute(sql, params).fetchall()
            question_ids = [row["question_id"] for row in rows]
            option_rows = []
            if question_ids:
                placeholders = ", ".join("?" for _ in question_ids)
                option_rows = conn.execute(
                    f"""
                    SELECT option_id, question_id, position, text, is_correct,
                           svg, rationale
                      FROM options
                     WHERE question_id IN ({placeholders})
                     ORDER BY question_id, position, option_id
                    """,
                    question_ids,
                ).fetchall()

        options_by_question: Dict[str, List[Dict[str, Any]]] = {}
        for option in option_rows:
            options_by_question.setdefault(option["question_id"], []).append(
                {
                    "id": option["option_id"],
                    "label": option["text"] or "",
                    "svg": option["svg"],
                    "is_correct": bool(option["is_correct"]),
                    "rationale": option["rationale"],
                    "position": option["position"],
                }
            )

        questions = []
        for row in rows:
            metadata = json.loads(row["question_metadata"] or "{}")
            questions.append(
                {
                    "id": row["question_id"],
                    "type": row["question_type"] or "single_choice",
                    "stem": row["stem"],
                    "stem_svg": row["svg"],
                    "explanation": row["explanation"],
                    "instruction": metadata.get("instruction"),
                    "topic": clean_topic_label(metadata.get("topic"), row["subject"]),
                    "level_band": row["question_level_band"],
                    "bloom_level": row["bloom_level"],
                    "source_pages": metadata.get("source_pages", []),
                    "options": options_by_question.get(row["question_id"], []),
                }
            )
        questions = deduplicate_questions(questions, limit)

        if not rows:
            return {
                "quiz_id": f"persisted:{subject or 'all'}:empty",
                "quiz_title": f"{subject} Question Bank" if subject else "Question Player",
                "subject": subject,
                "count": 0,
                "questions": [],
            }
        selected_subject = rows[0]["subject"]
        return {
            "quiz_id": (
                f"persisted:{selected_subject}:{rows[0]['quiz_id']}:{len(rows)}"
            ),
            "quiz_title": f"{selected_subject} Question Bank",
            "subject": selected_subject,
            "class_level": rows[0]["class_level"],
            "level_band": rows[0]["level_band"],
            "count": len(questions),
            "questions": questions,
        }

    def prerequisite_chain(self, concept_id: str, max_depth: int = 6) -> List[Dict[str, Any]]:
        sql = """
        WITH RECURSIVE chain(concept_id, depth) AS (
            SELECT target_id, 1 FROM concept_edges
             WHERE source_id = ? AND relation_type = 'prerequisite'
          UNION
            SELECT e.target_id, c.depth + 1 FROM concept_edges e
              JOIN chain c ON e.source_id = c.concept_id
             WHERE e.relation_type = 'prerequisite' AND c.depth < ?
        )
        SELECT DISTINCT ch.concept_id, co.name, co.level_band, ch.depth
          FROM chain ch JOIN concepts co ON co.concept_id = ch.concept_id
         ORDER BY ch.depth;
        """
        with self.connect() as conn:
            rows = conn.execute(sql, (concept_id, max_depth)).fetchall()
        return [dict(r) for r in rows]

    def related_concepts(self, concept_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        sql = """SELECT co.concept_id, co.name, e.relation_type, e.weight
                 FROM concept_edges e JOIN concepts co ON co.concept_id = e.target_id
                 WHERE e.source_id = ? ORDER BY e.weight DESC LIMIT ?"""
        with self.connect() as conn:
            rows = conn.execute(sql, (concept_id, limit)).fetchall()
        return [dict(r) for r in rows]

    def concepts_by_topic(
        self,
        topic: str,
        level_band: Optional[str] = None,
        limit: int = 25,
        source_run_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        sql = ("SELECT concept_id, name, topic, level_band, definition FROM concepts "
               "WHERE topic LIKE :pat COLLATE NOCASE")
        params: Dict[str, Any] = {"pat": f"%{topic}%", "lim": limit}
        if level_band:
            sql += " AND level_band = :lb"
            params["lb"] = level_band
        if source_run_id:
            sql += """
                AND json_extract(metadata, '$.run_id') = :run_id
                AND EXISTS (
                    SELECT 1 FROM chunks ch
                     WHERE ch.concept_id = concepts.concept_id
                       AND json_extract(ch.metadata, '$.run_id') = :run_id
                )
            """
            params["run_id"] = source_run_id
        sql += " ORDER BY centrality DESC LIMIT :lim"
        with self.connect() as conn:
            rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]

    def catalog_classes(
        self,
        source_run_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        sql = """
        SELECT COALESCE(NULLIF(TRIM(b.class_level), ''), 'Unclassified') AS class_level,
               COUNT(DISTINCT b.subject) AS subject_count,
               COUNT(DISTINCT COALESCE(NULLIF(ch.topic, ''), co.topic)) AS topic_count,
               COUNT(DISTINCT ch.concept_id) AS concept_count,
               COUNT(*) AS chunk_count,
               GROUP_CONCAT(DISTINCT json_extract(ch.metadata, '$.run_id')) AS run_ids
          FROM chunks ch
          JOIN books b ON b.book_id = ch.book_id
          LEFT JOIN concepts co ON co.concept_id = ch.concept_id
         WHERE NULLIF(json_extract(ch.metadata, '$.run_id'), '') IS NOT NULL
        """
        params: Dict[str, Any] = {}
        if source_run_id:
            sql += " AND json_extract(ch.metadata, '$.run_id') = :run_id"
            params["run_id"] = source_run_id
        sql += " GROUP BY COALESCE(NULLIF(TRIM(b.class_level), ''), 'Unclassified') ORDER BY class_level COLLATE NOCASE"
        with self.connect() as conn:
            rows = conn.execute(sql, params).fetchall()
        return [
            {
                "class_level": row["class_level"],
                "subject_count": row["subject_count"],
                "topic_count": row["topic_count"],
                "concept_count": row["concept_count"],
                "chunk_count": row["chunk_count"],
                "run_ids": sorted(filter(None, (row["run_ids"] or "").split(","))),
            }
            for row in rows
        ]

    def catalog_subjects(
        self,
        class_level: Optional[str] = None,
        query: Optional[str] = None,
        source_run_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        sql = """
        SELECT b.subject,
               COUNT(DISTINCT COALESCE(NULLIF(ch.topic, ''), co.topic)) AS topic_count,
               COUNT(DISTINCT ch.concept_id) AS concept_count,
               COUNT(*) AS chunk_count,
               GROUP_CONCAT(DISTINCT json_extract(ch.metadata, '$.run_id')) AS run_ids
          FROM chunks ch
          JOIN books b ON b.book_id = ch.book_id
          LEFT JOIN concepts co ON co.concept_id = ch.concept_id
         WHERE NULLIF(TRIM(b.subject), '') IS NOT NULL
           AND NULLIF(json_extract(ch.metadata, '$.run_id'), '') IS NOT NULL
        """
        params: Dict[str, Any] = {}
        if class_level:
            sql += " AND b.class_level = :class_level COLLATE NOCASE"
            params["class_level"] = class_level
        if query:
            sql += " AND b.subject LIKE :query COLLATE NOCASE"
            params["query"] = f"%{query}%"
        if source_run_id:
            sql += " AND json_extract(ch.metadata, '$.run_id') = :run_id"
            params["run_id"] = source_run_id
        sql += " GROUP BY b.subject ORDER BY b.subject COLLATE NOCASE"
        with self.connect() as conn:
            rows = conn.execute(sql, params).fetchall()
        return [
            {
                "subject": row["subject"],
                "topic_count": row["topic_count"],
                "concept_count": row["concept_count"],
                "chunk_count": row["chunk_count"],
                "run_ids": sorted(filter(None, (row["run_ids"] or "").split(","))),
            }
            for row in rows
        ]

    def concepts_by_subject(
        self,
        subject: str,
        limit: int = 200,
        source_run_ids: Optional[Sequence[str]] = None,
    ) -> List[Dict[str, Any]]:
        sql = """
        SELECT co.concept_id, co.name, co.topic, co.level_band, co.definition,
               co.centrality
          FROM concepts co
          JOIN books b ON b.book_id = co.book_id
          JOIN chunks ch ON ch.concept_id = co.concept_id
         WHERE b.subject = :subject COLLATE NOCASE
           AND NULLIF(json_extract(ch.metadata, '$.run_id'), '') IS NOT NULL
        """
        params: Dict[str, Any] = {"subject": subject, "lim": limit}
        if source_run_ids:
            names = []
            for index, run_id in enumerate(source_run_ids):
                name = f"run_{index}"
                names.append(f":{name}")
                params[name] = run_id
            sql += (
                " AND json_extract(ch.metadata, '$.run_id')"
                f" IN ({', '.join(names)})"
            )
        sql += """
         GROUP BY co.concept_id, co.name, co.topic, co.level_band,
                  co.definition, co.centrality
         ORDER BY co.centrality DESC
         LIMIT :lim
        """
        with self.connect() as conn:
            rows = conn.execute(sql, params).fetchall()
        return [
            {
                "concept_id": row["concept_id"],
                "name": row["name"],
                "topic": row["topic"],
                "level_band": row["level_band"],
                "definition": row["definition"],
            }
            for row in rows
        ]

    def catalog_topics(
        self,
        class_level: Optional[str] = None,
        subject: Optional[str] = None,
        query: Optional[str] = None,
        source_run_id: Optional[str] = None,
        limit: int = 500,
    ) -> List[Dict[str, Any]]:
        sql = """
        SELECT b.subject,
               COALESCE(NULLIF(ch.topic, ''), co.topic) AS topic,
               json_extract(ch.metadata, '$.run_id') AS source_run_id,
               COUNT(DISTINCT ch.concept_id) AS concept_count,
               COUNT(*) AS chunk_count,
               GROUP_CONCAT(DISTINCT b.title) AS book_titles,
               GROUP_CONCAT(DISTINCT ch.book_id) AS book_ids
          FROM chunks ch
          JOIN books b ON b.book_id = ch.book_id
          LEFT JOIN concepts co ON co.concept_id = ch.concept_id
         WHERE NULLIF(TRIM(COALESCE(NULLIF(ch.topic, ''), co.topic)), '') IS NOT NULL
           AND NULLIF(json_extract(ch.metadata, '$.run_id'), '') IS NOT NULL
        """
        params: Dict[str, Any] = {"lim": limit}
        if class_level:
            sql += " AND b.class_level = :class_level COLLATE NOCASE"
            params["class_level"] = class_level
        if subject:
            sql += " AND b.subject = :subject COLLATE NOCASE"
            params["subject"] = subject
        if query:
            sql += """
                AND COALESCE(NULLIF(ch.topic, ''), co.topic)
                    LIKE :query COLLATE NOCASE
            """
            params["query"] = f"%{query}%"
        if source_run_id:
            sql += " AND json_extract(ch.metadata, '$.run_id') = :run_id"
            params["run_id"] = source_run_id
        sql += """
         GROUP BY b.subject, COALESCE(NULLIF(ch.topic, ''), co.topic),
                  json_extract(ch.metadata, '$.run_id')
         ORDER BY b.subject COLLATE NOCASE,
                  COALESCE(NULLIF(ch.topic, ''), co.topic) COLLATE NOCASE,
                  json_extract(ch.metadata, '$.run_id')
         LIMIT :lim
        """
        with self.connect() as conn:
            rows = conn.execute(sql, params).fetchall()
        return [
            {
                "subject": row["subject"],
                "topic": row["topic"],
                "source_run_id": row["source_run_id"],
                "concept_count": row["concept_count"],
                "chunk_count": row["chunk_count"],
                "book_titles": sorted(filter(None, (row["book_titles"] or "").split(","))),
                "book_ids": sorted(filter(None, (row["book_ids"] or "").split(","))),
            }
            for row in rows
        ]
