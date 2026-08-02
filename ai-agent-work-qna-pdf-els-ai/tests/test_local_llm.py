import json

from knowledge_pipeline.config import PipelineConfig
from knowledge_pipeline.serving import openai_compatible
from knowledge_pipeline.serving.llm import LocalLLM, build_llm
from knowledge_pipeline.serving.openai_compatible import OpenAICompatibleClient


class _Response:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def read(self):
        return json.dumps(self.payload).encode()


def test_local_provider_loads_from_environment(monkeypatch):
    monkeypatch.setenv("KP_PROVIDER", "local")
    monkeypatch.setenv("KP_LOCAL_LLM_BASE_URL", "http://127.0.0.1:9999/v1")
    monkeypatch.setenv("KP_LOCAL_LLM_MODEL", "qwen-test")
    config = PipelineConfig.load()

    assert config.resolved_provider() == "local"
    assert config.local_llm_base_url == "http://127.0.0.1:9999/v1"
    assert config.local_llm_model == "qwen-test"
    assert isinstance(build_llm(config), LocalLLM)


def test_default_config_resolves_to_local_llm(monkeypatch):
    monkeypatch.delenv("KP_PROVIDER", raising=False)
    monkeypatch.delenv("KP_LOCAL_LLM_MODEL", raising=False)
    config = PipelineConfig.load()

    assert config.resolved_provider() == "local"
    assert config.local_llm_model == "qwen3.6:35b"
    assert isinstance(build_llm(config), LocalLLM)


def test_openai_compatible_client_sends_chat_request(monkeypatch):
    captured = {}

    def fake_urlopen(request, timeout):
        captured["url"] = request.full_url
        captured["timeout"] = timeout
        captured["authorization"] = request.headers["Authorization"]
        captured["payload"] = json.loads(request.data)
        return _Response({"choices": [{"message": {"content": "valid response"}}]})

    monkeypatch.setattr(openai_compatible, "urlopen", fake_urlopen)
    client = OpenAICompatibleClient(
        base_url="http://localhost:11434/v1",
        model="qwen3.6:35b",
        api_key="ollama",
        timeout_s=12,
    )

    assert client.complete("hello", "system") == "valid response"
    assert captured["url"] == "http://localhost:11434/v1/chat/completions"
    assert captured["timeout"] == 12
    assert captured["authorization"] == "Bearer ollama"
    assert captured["payload"]["model"] == "qwen3.6:35b"
    assert captured["payload"]["messages"][0]["role"] == "system"


def test_openai_compatible_client_lists_models(monkeypatch):
    monkeypatch.setattr(
        openai_compatible,
        "urlopen",
        lambda *_args, **_kwargs: _Response(
            {"data": [{"id": "qwen3.6:35b"}, {"id": "qwen3:8b"}]}
        ),
    )
    client = OpenAICompatibleClient("http://localhost:11434/v1", "qwen3:8b")

    assert client.models() == ["qwen3.6:35b", "qwen3:8b"]
