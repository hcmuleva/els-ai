from knowledge_pipeline.config import _load_dotenv, _postgres_dsn_from_env


def test_dotenv_loader_handles_utf8_bom(tmp_path, monkeypatch) -> None:
    path = tmp_path / ".env"
    path.write_text("\ufeffKP_TEST_VALUE=configured\n", encoding="utf-8")
    monkeypatch.delenv("KP_TEST_VALUE", raising=False)

    _load_dotenv(path)

    assert __import__("os").environ["KP_TEST_VALUE"] == "configured"


def test_postgres_dsn_is_built_from_environment(monkeypatch) -> None:
    monkeypatch.delenv("KP_POSTGRES_DSN", raising=False)
    monkeypatch.setenv("POSTGRES_USER", "kp user")
    monkeypatch.setenv("POSTGRES_PASSWORD", "p@ss/word")
    monkeypatch.setenv("POSTGRES_HOST", "127.0.0.1")
    monkeypatch.setenv("POSTGRES_PORT", "5432")
    monkeypatch.setenv("POSTGRES_DB", "knowledge db")

    dsn = _postgres_dsn_from_env("postgresql://fallback")

    assert dsn == (
        "postgresql://kp%20user:p%40ss%2Fword"
        "@127.0.0.1:5432/knowledge%20db"
    )


def test_explicit_postgres_dsn_takes_precedence(monkeypatch) -> None:
    monkeypatch.setenv("KP_POSTGRES_DSN", "postgresql://explicit")
    monkeypatch.setenv("POSTGRES_PASSWORD", "ignored")

    assert _postgres_dsn_from_env("postgresql://fallback") == "postgresql://explicit"
