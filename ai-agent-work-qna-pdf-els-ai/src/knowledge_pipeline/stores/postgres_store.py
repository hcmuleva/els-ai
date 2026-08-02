"""Postgres store: metadata + concept relations (edges table + recursive CTE).

Edge convention: (source_id, target_id, 'prerequisite') means *source depends on
target* (to learn `source` you first need `target`). Prerequisite traversal from
a concept therefore follows source -> target.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

from ..topic_labels import clean_topic_label
from ..serving.player import deduplicate_questions

_SCHEMA_SQL = Path(__file__).with_name("postgres_schema.sql")


class PostgresStore:
    def __init__(self, dsn: str, connect_timeout: int = 3) -> None:
        self.dsn = dsn
        self.connect_timeout = connect_timeout

    def connect(self):
        import psycopg  # type: ignore

        return psycopg.connect(self.dsn, connect_timeout=self.connect_timeout)

    # ------------------------------------------------------------------ schema
    def init_schema(self) -> None:
        sql = _SCHEMA_SQL.read_text(encoding="utf-8")
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute(sql)
            conn.commit()

    # -------------------------------------------------------------- ingestion
    def load_book_assets(
        self,
        book: Dict[str, Any],
        concepts: Sequence[Dict[str, Any]],
        edges: Sequence[Dict[str, Any]],
        chunks: Sequence[Dict[str, Any]],
        level_profiles: Sequence[Dict[str, Any]],
    ) -> Dict[str, int]:
        from psycopg.types.json import Json  # type: ignore

        with self.connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO books (book_id, title, subject, curriculum, domain, class_level,
                                   creator_id, organization_id, language)
                VALUES (%(book_id)s, %(title)s, %(subject)s, %(curriculum)s, %(domain)s,
                        %(class_level)s, %(creator_id)s, %(organization_id)s, %(language)s)
                ON CONFLICT (book_id) DO UPDATE SET
                    title=EXCLUDED.title, subject=EXCLUDED.subject,
                    curriculum=EXCLUDED.curriculum, domain=EXCLUDED.domain,
                    class_level=EXCLUDED.class_level, creator_id=EXCLUDED.creator_id,
                    organization_id=EXCLUDED.organization_id, language=EXCLUDED.language
                """,
                book,
            )

            cur.executemany(
                """
                INSERT INTO concepts (concept_id, book_id, name, concept_type, topic, subtopic,
                                      definition, level_band, prerequisite_depth, centrality, metadata)
                VALUES (%(concept_id)s, %(book_id)s, %(name)s, %(concept_type)s, %(topic)s,
                        %(subtopic)s, %(definition)s, %(level_band)s, %(prerequisite_depth)s,
                        %(centrality)s, %(metadata)s)
                ON CONFLICT (concept_id) DO UPDATE SET
                    name=EXCLUDED.name, concept_type=EXCLUDED.concept_type, topic=EXCLUDED.topic,
                    subtopic=EXCLUDED.subtopic, definition=EXCLUDED.definition,
                    level_band=EXCLUDED.level_band, prerequisite_depth=EXCLUDED.prerequisite_depth,
                    centrality=EXCLUDED.centrality, metadata=EXCLUDED.metadata
                """,
                [{**c, "metadata": Json(c.get("metadata", {}))} for c in concepts],
            )

            if edges:
                cur.executemany(
                    """
                    INSERT INTO concept_edges (source_id, target_id, relation_type, weight)
                    VALUES (%(source_id)s, %(target_id)s, %(relation_type)s, %(weight)s)
                    ON CONFLICT (source_id, target_id, relation_type)
                    DO UPDATE SET weight=EXCLUDED.weight
                    """,
                    list(edges),
                )

            if chunks:
                cur.executemany(
                    """
                    INSERT INTO chunks (chunk_id, book_id, concept_id, topic, level_band, content,
                                        token_estimate, metadata, vector_point_id)
                    VALUES (%(chunk_id)s, %(book_id)s, %(concept_id)s, %(topic)s, %(level_band)s,
                            %(content)s, %(token_estimate)s, %(metadata)s, %(vector_point_id)s)
                    ON CONFLICT (chunk_id) DO UPDATE SET
                        content=EXCLUDED.content, topic=EXCLUDED.topic,
                        level_band=EXCLUDED.level_band, token_estimate=EXCLUDED.token_estimate,
                        metadata=EXCLUDED.metadata, vector_point_id=EXCLUDED.vector_point_id
                    """,
                    [{**c, "metadata": Json(c.get("metadata", {}))} for c in chunks],
                )

            if level_profiles:
                cur.executemany(
                    """
                    INSERT INTO level_profiles (concept_id, level_band, intrinsic_difficulty,
                        reasoning_level, steps_required, concepts_combined, confidence, rationale, source)
                    VALUES (%(concept_id)s, %(level_band)s, %(intrinsic_difficulty)s,
                        %(reasoning_level)s, %(steps_required)s, %(concepts_combined)s,
                        %(confidence)s, %(rationale)s, %(source)s)
                    ON CONFLICT (concept_id) DO UPDATE SET
                        level_band=EXCLUDED.level_band,
                        intrinsic_difficulty=EXCLUDED.intrinsic_difficulty,
                        reasoning_level=EXCLUDED.reasoning_level,
                        steps_required=EXCLUDED.steps_required,
                        concepts_combined=EXCLUDED.concepts_combined,
                        confidence=EXCLUDED.confidence, rationale=EXCLUDED.rationale,
                        source=EXCLUDED.source
                    """,
                    list(level_profiles),
                )
            conn.commit()
        return {
            "concepts": len(concepts),
            "edges": len(edges),
            "chunks": len(chunks),
            "level_profiles": len(level_profiles),
        }

    def upsert_edges(self, edges: Sequence[Dict[str, Any]]) -> int:
        if not edges:
            return 0
        with self.connect() as conn, conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO concept_edges (source_id, target_id, relation_type, weight)
                VALUES (%(source_id)s, %(target_id)s, %(relation_type)s, %(weight)s)
                ON CONFLICT (source_id, target_id, relation_type)
                DO UPDATE SET weight=EXCLUDED.weight
                """,
                list(edges),
            )
            conn.commit()
        return len(edges)

    # ------------------------------------------------------------ quiz output
    def insert_quiz(
        self,
        quiz: Dict[str, Any],
        questions: Sequence[Dict[str, Any]],
        options_by_question: Dict[str, Sequence[Dict[str, Any]]],
    ) -> None:
        from psycopg.types.json import Json  # type: ignore

        with self.connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO quizzes (quiz_id, book_id, title, subject, class_level, level_band,
                                     creator_id, organization_id, metadata)
                VALUES (%(quiz_id)s, %(book_id)s, %(title)s, %(subject)s, %(class_level)s,
                        %(level_band)s, %(creator_id)s, %(organization_id)s, %(metadata)s)
                ON CONFLICT (quiz_id) DO UPDATE SET title=EXCLUDED.title, metadata=EXCLUDED.metadata
                """,
                {**quiz, "metadata": Json(quiz.get("metadata", {}))},
            )
            for q in questions:
                cur.execute(
                    """
                    INSERT INTO questions (question_id, quiz_id, concept_id, question_type,
                        level_band, bloom_level, stem, explanation, svg, diagram, metadata)
                    VALUES (%(question_id)s, %(quiz_id)s, %(concept_id)s, %(question_type)s,
                        %(level_band)s, %(bloom_level)s, %(stem)s, %(explanation)s, %(svg)s,
                        %(diagram)s, %(metadata)s)
                    ON CONFLICT (question_id) DO UPDATE SET stem=EXCLUDED.stem,
                        explanation=EXCLUDED.explanation, svg=EXCLUDED.svg, diagram=EXCLUDED.diagram,
                        metadata=EXCLUDED.metadata
                    """,
                    {
                        **q,
                        "diagram": Json(q["diagram"]) if q.get("diagram") else None,
                        "metadata": Json(q.get("metadata", {})),
                    },
                )
                for opt in options_by_question.get(q["question_id"], []):
                    cur.execute(
                        """
                        INSERT INTO options (option_id, question_id, position, text, is_correct,
                            svg, diagram, rationale)
                        VALUES (%(option_id)s, %(question_id)s, %(position)s, %(text)s,
                            %(is_correct)s, %(svg)s, %(diagram)s, %(rationale)s)
                        ON CONFLICT (option_id) DO UPDATE SET text=EXCLUDED.text,
                            is_correct=EXCLUDED.is_correct, svg=EXCLUDED.svg, diagram=EXCLUDED.diagram,
                            rationale=EXCLUDED.rationale
                        """,
                        {**opt, "diagram": Json(opt["diagram"]) if opt.get("diagram") else None},
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
         WHERE NULLIF(BTRIM(qz.subject), '') IS NOT NULL
         GROUP BY qz.subject
         ORDER BY MAX(qz.created_at) DESC, LOWER(qz.subject)
        """
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()
        items = [
            {
                "subject": row[0],
                "quiz_count": row[1],
                "question_count": row[2],
                "latest_created_at": row[3].isoformat() if row[3] else None,
            }
            for row in rows
        ]
        for item in items:
            item["question_count"] = self.load_player_quiz(
                subject=item["subject"], limit=1_000_000
            )["count"]
        return items

    def load_player_quiz(
        self,
        subject: Optional[str] = None,
        limit: int = 1000,
    ) -> Dict[str, Any]:
        sql = """
        SELECT qz.quiz_id, qz.title, qz.subject, qz.class_level, qz.level_band,
               qz.created_at, qz.metadata,
               q.question_id, q.question_type, q.level_band, q.bloom_level,
               q.stem, q.explanation, q.svg, q.metadata
          FROM quizzes qz
          JOIN questions q ON q.quiz_id = qz.quiz_id
         WHERE NULLIF(BTRIM(qz.subject), '') IS NOT NULL
        """
        params: list[Any] = []
        if subject:
            sql += " AND LOWER(qz.subject) = LOWER(%s)"
            params.append(subject)
        sql += """
         ORDER BY qz.created_at DESC, q.created_at, q.question_id
         LIMIT %s
        """
        params.append(limit)
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
            question_ids = [row[7] for row in rows]
            option_rows = []
            if question_ids:
                cur.execute(
                    """
                    SELECT option_id, question_id, position, text, is_correct,
                           svg, rationale
                      FROM options
                     WHERE question_id = ANY(%s)
                     ORDER BY question_id, position, option_id
                    """,
                    (question_ids,),
                )
                option_rows = cur.fetchall()

        options_by_question: Dict[str, List[Dict[str, Any]]] = {}
        for option in option_rows:
            options_by_question.setdefault(option[1], []).append(
                {
                    "id": option[0],
                    "label": option[3] or "",
                    "svg": option[5],
                    "is_correct": bool(option[4]),
                    "rationale": option[6],
                    "position": option[2],
                }
            )

        questions = []
        for row in rows:
            metadata = row[14] or {}
            questions.append(
                {
                    "id": row[7],
                    "type": row[8] or "single_choice",
                    "stem": row[11],
                    "stem_svg": row[13],
                    "explanation": row[12],
                    "instruction": metadata.get("instruction"),
                    "topic": clean_topic_label(metadata.get("topic"), row[2]),
                    "level_band": row[9],
                    "bloom_level": row[10],
                    "source_pages": metadata.get("source_pages", []),
                    "options": options_by_question.get(row[7], []),
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
        selected_subject = rows[0][2]
        return {
            "quiz_id": f"persisted:{selected_subject}:{rows[0][0]}:{len(rows)}",
            "quiz_title": f"{selected_subject} Question Bank",
            "subject": selected_subject,
            "class_level": rows[0][3],
            "level_band": rows[0][4],
            "count": len(questions),
            "questions": questions,
        }

    # ------------------------------------------------------------- retrieval
    def prerequisite_chain(self, concept_id: str, max_depth: int = 6) -> List[Dict[str, Any]]:
        sql = """
        WITH RECURSIVE chain(concept_id, depth) AS (
            SELECT target_id, 1 FROM concept_edges
             WHERE source_id = %s AND relation_type = 'prerequisite'
          UNION
            SELECT e.target_id, c.depth + 1
              FROM concept_edges e JOIN chain c ON e.source_id = c.concept_id
             WHERE e.relation_type = 'prerequisite' AND c.depth < %s
        )
        SELECT DISTINCT ch.concept_id, co.name, co.level_band, ch.depth
          FROM chain ch JOIN concepts co ON co.concept_id = ch.concept_id
         ORDER BY ch.depth;
        """
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute(sql, (concept_id, max_depth))
            rows = cur.fetchall()
        return [
            {"concept_id": r[0], "name": r[1], "level_band": r[2], "depth": r[3]} for r in rows
        ]

    def related_concepts(self, concept_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        sql = """
        SELECT co.concept_id, co.name, e.relation_type, e.weight
          FROM concept_edges e JOIN concepts co ON co.concept_id = e.target_id
         WHERE e.source_id = %s
         ORDER BY e.weight DESC
         LIMIT %s;
        """
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute(sql, (concept_id, limit))
            rows = cur.fetchall()
        return [
            {"concept_id": r[0], "name": r[1], "relation_type": r[2], "weight": r[3]}
            for r in rows
        ]

    def concepts_by_topic(
        self,
        topic: str,
        level_band: Optional[str] = None,
        limit: int = 25,
        source_run_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        sql = "SELECT concept_id, name, topic, level_band, definition FROM concepts WHERE topic ILIKE %s"
        params: list[Any] = [f"%{topic}%"]
        if level_band:
            sql += " AND level_band = %s"
            params.append(level_band)
        if source_run_id:
            sql += """
                AND metadata->>'run_id' = %s
                AND EXISTS (
                    SELECT 1 FROM chunks ch
                     WHERE ch.concept_id = concepts.concept_id
                       AND ch.metadata->>'run_id' = %s
                )
            """
            params.extend([source_run_id, source_run_id])
        sql += " ORDER BY centrality DESC LIMIT %s"
        params.append(limit)
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
        return [
            {"concept_id": r[0], "name": r[1], "topic": r[2], "level_band": r[3], "definition": r[4]}
            for r in rows
        ]

    def catalog_classes(
        self,
        source_run_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        sql = """
        SELECT COALESCE(NULLIF(BTRIM(b.class_level), ''), 'Unclassified') AS class_level,
               COUNT(DISTINCT b.subject) AS subject_count,
               COUNT(DISTINCT COALESCE(NULLIF(ch.topic, ''), co.topic)) AS topic_count,
               COUNT(DISTINCT ch.concept_id) AS concept_count,
               COUNT(*) AS chunk_count,
               ARRAY_AGG(DISTINCT ch.metadata->>'run_id')
                   FILTER (WHERE ch.metadata->>'run_id' IS NOT NULL) AS run_ids
          FROM chunks ch
          JOIN books b ON b.book_id = ch.book_id
          LEFT JOIN concepts co ON co.concept_id = ch.concept_id
         WHERE NULLIF(ch.metadata->>'run_id', '') IS NOT NULL
        """
        params: list[Any] = []
        if source_run_id:
            sql += " AND ch.metadata->>'run_id' = %s"
            params.append(source_run_id)
        sql += " GROUP BY COALESCE(NULLIF(BTRIM(b.class_level), ''), 'Unclassified') ORDER BY class_level"
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
        return [
            {
                "class_level": row[0],
                "subject_count": row[1],
                "topic_count": row[2],
                "concept_count": row[3],
                "chunk_count": row[4],
                "run_ids": sorted(row[5] or []),
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
               ARRAY_AGG(DISTINCT ch.metadata->>'run_id')
                   FILTER (WHERE ch.metadata->>'run_id' IS NOT NULL) AS run_ids
          FROM chunks ch
          JOIN books b ON b.book_id = ch.book_id
          LEFT JOIN concepts co ON co.concept_id = ch.concept_id
         WHERE NULLIF(BTRIM(b.subject), '') IS NOT NULL
           AND NULLIF(ch.metadata->>'run_id', '') IS NOT NULL
        """
        params: list[Any] = []
        if class_level:
            sql += " AND LOWER(b.class_level) = LOWER(%s)"
            params.append(class_level)
        if query:
            sql += " AND b.subject ILIKE %s"
            params.append(f"%{query}%")
        if source_run_id:
            sql += " AND ch.metadata->>'run_id' = %s"
            params.append(source_run_id)
        sql += " GROUP BY b.subject ORDER BY LOWER(b.subject)"
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
        return [
            {
                "subject": row[0],
                "topic_count": row[1],
                "concept_count": row[2],
                "chunk_count": row[3],
                "run_ids": sorted(row[4] or []),
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
         WHERE LOWER(b.subject) = LOWER(%s)
           AND NULLIF(ch.metadata->>'run_id', '') IS NOT NULL
        """
        params: list[Any] = [subject]
        if source_run_ids:
            sql += " AND ch.metadata->>'run_id' = ANY(%s)"
            params.append(list(source_run_ids))
        sql += """
         GROUP BY co.concept_id, co.name, co.topic, co.level_band,
                  co.definition, co.centrality
         ORDER BY co.centrality DESC
         LIMIT %s
        """
        params.append(limit)
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
        return [
            {
                "concept_id": row[0],
                "name": row[1],
                "topic": row[2],
                "level_band": row[3],
                "definition": row[4],
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
               ch.metadata->>'run_id' AS source_run_id,
               COUNT(DISTINCT ch.concept_id) AS concept_count,
               COUNT(*) AS chunk_count,
               ARRAY_AGG(DISTINCT b.title) AS book_titles,
               ARRAY_AGG(DISTINCT ch.book_id) AS book_ids
          FROM chunks ch
          JOIN books b ON b.book_id = ch.book_id
          LEFT JOIN concepts co ON co.concept_id = ch.concept_id
         WHERE NULLIF(BTRIM(COALESCE(NULLIF(ch.topic, ''), co.topic)), '') IS NOT NULL
           AND NULLIF(ch.metadata->>'run_id', '') IS NOT NULL
        """
        params: list[Any] = []
        if class_level:
            sql += " AND LOWER(b.class_level) = LOWER(%s)"
            params.append(class_level)
        if subject:
            sql += " AND LOWER(b.subject) = LOWER(%s)"
            params.append(subject)
        if query:
            sql += " AND COALESCE(NULLIF(ch.topic, ''), co.topic) ILIKE %s"
            params.append(f"%{query}%")
        if source_run_id:
            sql += " AND ch.metadata->>'run_id' = %s"
            params.append(source_run_id)
        sql += """
         GROUP BY b.subject, COALESCE(NULLIF(ch.topic, ''), co.topic),
                  ch.metadata->>'run_id'
         ORDER BY LOWER(b.subject), LOWER(COALESCE(NULLIF(ch.topic, ''), co.topic)),
                  ch.metadata->>'run_id'
         LIMIT %s
        """
        params.append(limit)
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
        from ..topic_labels import clean_topic_label

        return [
            {
                "subject": row[0],
                "topic": clean_topic_label(row[1], row[0]),
                "raw_topic": row[1],
                "source_run_id": row[2],
                "concept_count": row[3],
                "chunk_count": row[4],
                "book_titles": sorted(row[5] or []),
                "book_ids": sorted(row[6] or []),
            }
            for row in rows
        ]
