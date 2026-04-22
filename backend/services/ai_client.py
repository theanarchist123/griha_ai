"""
Centralised Ollama Cloud AI client.

Base URL : https://ollama.com/api
Auth     : Bearer token in Authorization header
Format   : Native Ollama chat streaming NDJSON

Model tiers (from cloud model list):
  fast   — gemma3:4b      (quick extractions, summaries)
  smart  — ministral-3:8b (property research, matching, neighbourhood)
  pro    — gemma3:27b     (legal analysis, negotiation, contract review)

Rate-limit guard: semaphore limits concurrent calls to 3.
"""
import asyncio
import json
import os
from typing import Optional

import httpx

from config import settings

OLLAMA_BASE = "https://ollama.com/api"
_SEMAPHORE = asyncio.Semaphore(3)          # max 3 concurrent AI calls

MODEL_FAST  = "gemma3:4b"
MODEL_SMART = "ministral-3:8b"
MODEL_PRO   = "gemma3:27b"


def _headers() -> dict:
    key = getattr(settings, "ollama_api_key", "") or os.getenv("OLLAMA_API_KEY", "")
    return {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


async def call_llm(
    prompt: str,
    model: str = MODEL_SMART,
    system: Optional[str] = None,
    timeout: float = 60.0,
) -> str:
    """
    Call Ollama Cloud and return the full assistant text.
    Streams NDJSON, accumulates content until done=true.
    Raises RuntimeError on failure.
    """
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    payload = {"model": model, "messages": messages, "stream": True}

    async with _SEMAPHORE:
        async with httpx.AsyncClient(
            timeout=timeout, follow_redirects=True
        ) as client:
            async with client.stream(
                "POST",
                f"{OLLAMA_BASE}/chat",
                headers=_headers(),
                json=payload,
            ) as resp:
                if resp.status_code != 200:
                    body = await resp.aread()
                    raise RuntimeError(
                        f"Ollama HTTP {resp.status_code}: {body.decode()[:200]}"
                    )
                parts: list[str] = []
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        chunk = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    content = (chunk.get("message") or {}).get("content", "")
                    if content:
                        parts.append(content)
                    if chunk.get("done"):
                        break
                return "".join(parts)


async def call_llm_json(
    prompt: str,
    model: str = MODEL_SMART,
    system: Optional[str] = None,
    timeout: float = 90.0,
) -> Optional[dict | list]:
    """
    Call LLM and parse first valid JSON object/array from response.
    Returns None on parse failure.
    """
    import re
    raw = await call_llm(prompt, model=model, system=system, timeout=timeout)
    raw = raw.strip()
    # Strip markdown fences
    raw = re.sub(r"^```(?:json)?\n?", "", raw).rstrip("`").strip()
    # Find first JSON structure
    match = re.search(r"[\[{].*[\]}]", raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return None
