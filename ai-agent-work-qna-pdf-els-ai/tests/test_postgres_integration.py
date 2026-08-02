from __future__ import annotations

import os

import pytest

from knowledge_pipeline.stores import PostgresStore


@pytest.mark.skipif(
    not os.getenv("KP_TEST_POSTGRES_DSN"),
    reason="KP_TEST_POSTGRES_DSN is not configured",
)
def test_installed_postgres_schema_is_available() -> None:
    store = PostgresStore(os.environ["KP_TEST_POSTGRES_DSN"])
    store.init_schema()

    with store.connect() as conn, conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT tablename
              FROM pg_tables
             WHERE schemaname = 'public'
            """
        )
        tables = {row[0] for row in cursor.fetchall()}

    assert {
        "books",
        "concepts",
        "concept_edges",
        "chunks",
        "level_profiles",
        "quizzes",
        "questions",
        "options",
    } <= tables
