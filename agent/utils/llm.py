from typing import Dict, Any
import json
import re
from pathlib import Path

import httpx


class OpenAICompatibleCaller:
    def __init__(self, model: str) -> None:
        self.model = model
        self.config = self.load_config()
        self.api_model = self.get_api_model(model)

    def load_config(self) -> Dict[str, Any]:
        path = Path(__file__).resolve().parents[2] / "config" / "api_key.json"
        if not path.exists():
            raise FileNotFoundError("config/api_key.json not found")
        return json.loads(path.read_text(encoding="utf-8"))

    def get_api_model(self, model: str) -> str:
        models = self.config.get("models", dict())
        if isinstance(models, dict) and model in models:
            return models[model]
        if "model" in self.config:
            return self.config["model"]
        return model

    def get_url(self) -> str:
        base_url = self.config.get("base_url", "")
        if not base_url:
            raise ValueError("config/api_key.json must define base_url")
        base_url = base_url.rstrip("/")
        if base_url.endswith("/chat/completions"):
            return base_url
        return f"{base_url}/chat/completions"

    async def ask(self, prompt: str) -> str:
        headers = {"Content-Type": "application/json"}
        api_key = self.config.get("api_key", "")
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        data = {
            "model": self.api_model,
            "messages": [{"role": "user", "content": prompt}],
        }
        for key in ("temperature", "top_p", "max_tokens", "presence_penalty", "frequency_penalty"):
            if key in self.config:
                data[key] = self.config[key]

        timeout = self.config.get("timeout", 50)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(self.get_url(), headers=headers, json=data)
            response.raise_for_status()
            result = response.json()

        message = result["choices"][0]["message"]
        content = message.get("content", "")
        if isinstance(content, list):
            return "".join(item.get("text", "") if isinstance(item, dict) else str(item) for item in content)
        return content


class LLMCaller:
    def __init__(self, model: str) -> None:
        self.model = model
        self.caller = OpenAICompatibleCaller(model)

    async def ask(self, prompt: str) -> Dict[str, Any]:
        result = await self.caller.ask(prompt)
        try:
            result = json.loads(result)
        except Exception:
            try:
                info = re.findall(r"\{.*\}", result, re.DOTALL)
                if info:
                    info = info[-1]
                    result = json.loads(info)
                else:
                    result = {"response": result}
            except Exception:
                result = {"response": result}
        return result
