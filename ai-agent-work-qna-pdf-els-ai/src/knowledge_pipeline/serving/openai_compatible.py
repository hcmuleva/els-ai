"""Small OpenAI-compatible chat client for local model servers."""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


@dataclass(frozen=True)
class OpenAICompatibleClient:
    base_url: str
    model: str
    api_key: str = ""
    timeout_s: int = 240
    temperature: float = 0.2
    max_tokens: int = 4096

    def _url(self, path: str) -> str:
        return f"{self.base_url.rstrip('/')}/{path.lstrip('/')}"

    def complete(self, prompt: str, system_prompt: str = "") -> str:
        messages: list[dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "stream": False,
        }
        data = self._request("POST", "chat/completions", payload)
        try:
            choice = data["choices"][0] if isinstance(data.get("choices"), list) and data["choices"] else {}
            msg = choice.get("message") if isinstance(choice, dict) else {}
            content = msg.get("content") if isinstance(msg, dict) else ""
            if not isinstance(content, str):
                content = str(content) if content is not None else ""
            content = content.strip()

            # Fallback for local reasoning models (Ollama qwen3.6, deepseek-r1, etc.)
            if not content and isinstance(msg, dict):
                for field in ("reasoning_content", "reasoning", "thought"):
                    val = msg.get(field)
                    if isinstance(val, str) and val.strip():
                        content = val.strip()
                        break
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError("Local LLM returned an invalid chat-completions response.") from exc

        if not content:
            raise RuntimeError("Local LLM returned an empty completion.")
        return content

    def models(self) -> list[str]:
        data = self._request("GET", "models")
        models = data.get("data", []) if isinstance(data, dict) else []
        return [
            str(item["id"])
            for item in models
            if isinstance(item, dict) and item.get("id")
        ]

    def _request(
        self, method: str, path: str, payload: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        headers = {"Accept": "application/json"}
        if body is not None:
            headers["Content-Type"] = "application/json"
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        request = Request(self._url(path), data=body, headers=headers, method=method)
        try:
            with urlopen(request, timeout=self.timeout_s) as response:
                raw = response.read().decode("utf-8")
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:1000]
            raise RuntimeError(
                f"Local LLM request failed with HTTP {exc.code}: {detail}"
            ) from exc
        except URLError as exc:
            raise RuntimeError(
                f"Local LLM server is unreachable at {self.base_url}: {exc.reason}"
            ) from exc
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise RuntimeError("Local LLM returned non-JSON output.") from exc
        if not isinstance(data, dict):
            raise RuntimeError("Local LLM returned an invalid JSON response.")
        return data
