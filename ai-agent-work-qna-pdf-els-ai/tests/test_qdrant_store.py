from types import SimpleNamespace

from knowledge_pipeline.stores import QdrantStore


class _Embedder:
    def embed_one(self, _text):
        return [0.0, 1.0]


class _Client:
    query_filter = None

    def query_points(self, **kwargs):
        self.query_filter = kwargs["query_filter"]
        return SimpleNamespace(points=[])


def test_search_supports_multi_value_filters():
    store = QdrantStore(":memory:", "chunks", 2, _Embedder())
    client = _Client()
    store._client = client

    store.search(
        "physics",
        flt={"topic": ["Magnetic Flux", "Transformers"], "run_id": "run-1"},
    )

    conditions = {condition.key: condition.match for condition in client.query_filter.must}
    assert conditions["topic"].any == ["Magnetic Flux", "Transformers"]
    assert conditions["run_id"].value == "run-1"
