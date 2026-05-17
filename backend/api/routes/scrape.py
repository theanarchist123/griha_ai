"""
HTTP scrape routes for Griha AI.

Uses PropertyFetcher (the robust MagicBricks JSON-LD pipeline) instead of
the older ScraperAgent.  ScraperAPI is used automatically when
SCRAPER_API_KEY is present in the environment.
"""

import asyncio
import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter(prefix="/api/scrape", tags=["Scrape"])

# ──────────────────────────────────────────────
# In-memory job store  (ephemeral, per-instance)
# ──────────────────────────────────────────────
_jobs: Dict[str, Dict[str, Any]] = {}


class MockWebSocket:
    """Fake WebSocket so PropertyFetcher can push progress into the job store."""

    def __init__(self, job_id: str):
        self.job_id = job_id

    async def send_text(self, text: str):
        import json
        try:
            data = json.loads(text)
            job = _jobs.get(self.job_id)
            if job:
                job["progress"] = data.get("progress", job["progress"])
                job["status"] = data.get("status", job["status"])
                job["found_count"] = data.get("found_count", job["found_count"])
                if data.get("progress", 0) >= 100:
                    job["done"] = True
        except Exception:
            pass


# ──────────────────────────────────────────────
# Request / response models
# ──────────────────────────────────────────────

class ScrapeStartRequest(BaseModel):
    location: str
    bhk: Optional[str] = "2 BHK"


class ScrapeStartResponse(BaseModel):
    job_id: str
    progress: int = 0
    status: str = ""
    found_count: int = 0
    done: bool = False


class ScrapeStatusResponse(BaseModel):
    job_id: str
    progress: int
    status: str
    found_count: int
    done: bool


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────

@router.post("/start", response_model=ScrapeStartResponse)
async def start_scrape(req: ScrapeStartRequest):
    """
    Start a property scrape job.

    Uses PropertyFetcher (JSON-LD + CSS card extraction from MagicBricks)
    with optional ScraperAPI proxy when SCRAPER_API_KEY is set.
    Runs synchronously so partial results are persisted even on timeout.
    """
    # Lazy import to avoid circular import at module-load time
    from services.property_fetcher import PropertyFetcher

    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "progress": 0,
        "status": "🚀 Starting...",
        "found_count": 0,
        "done": False,
    }

    ws = MockWebSocket(job_id)
    agent = PropertyFetcher(ws)

    try:
        # Run with a 55-second timeout (Vercel Pro = 60 s max)
        await asyncio.wait_for(
            agent.run_scrape_workflow(req.location, req.bhk or "2 BHK"),
            timeout=55.0,
        )
    except asyncio.TimeoutError:
        job = _jobs.get(job_id)
        if job:
            job["progress"] = 100
            job["status"] = (
                "⏱️ Scrape timed out but partial results were saved. "
                "Refresh your dashboard to see them."
            )
            job["done"] = True
    except Exception as exc:
        import traceback
        traceback.print_exc()
        job = _jobs.get(job_id)
        if job:
            job["progress"] = 100
            job["status"] = f"❌ Error: {repr(exc)}"
            job["done"] = True

    final = _jobs.get(job_id, {})
    return ScrapeStartResponse(
        job_id=job_id,
        progress=final.get("progress", 100),
        status=final.get("status", "Done"),
        found_count=final.get("found_count", 0),
        done=True,
    )


@router.get("/status/{job_id}", response_model=ScrapeStatusResponse)
async def scrape_status(job_id: str):
    """Poll scrape job status."""
    job = _jobs.get(job_id)
    if not job:
        return ScrapeStatusResponse(
            job_id=job_id,
            progress=100,
            status="✅ Scrape completed. Refresh dashboard to see results.",
            found_count=0,
            done=True,
        )
    return ScrapeStatusResponse(
        job_id=job_id,
        progress=job["progress"],
        status=job["status"],
        found_count=job["found_count"],
        done=job["done"],
    )


@router.get("/debug")
async def debug_scrape():
    """Diagnostic: test connectivity to MagicBricks from this server."""
    import httpx
    import os

    results = {}
    test_url = "https://www.magicbricks.com/2-bhk-flats-for-rent-in-andheri-east-mumbai-pppfr"
    scraper_api_key = os.getenv("SCRAPER_API_KEY", "")

    # Test 1: Direct fetch
    try:
        async with httpx.AsyncClient(
            timeout=15.0,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36"},
        ) as client:
            resp = await client.get(test_url)
            text = resp.text
            results["direct"] = {
                "status_code": resp.status_code,
                "html_length": len(text),
                "has_cards": ".mb-srp__card" in text,
                "has_jsonld": "application/ld+json" in text,
                "blocked": resp.status_code in (403, 429) or "access denied" in text.lower(),
            }
    except Exception as exc:
        results["direct"] = {"error": str(exc)}

    # Test 2: Via ScraperAPI (if key present)
    if scraper_api_key:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    "https://api.scraperapi.com/",
                    params={
                        "api_key": scraper_api_key,
                        "url": test_url,
                        "render": "false",
                        "country_code": "in",
                    },
                )
                text = resp.text
                results["scraper_api"] = {
                    "status_code": resp.status_code,
                    "html_length": len(text),
                    "has_cards": ".mb-srp__card" in text,
                    "has_jsonld": "application/ld+json" in text,
                }
        except Exception as exc:
            results["scraper_api"] = {"error": str(exc)}
    else:
        results["scraper_api"] = {"error": "SCRAPER_API_KEY not set"}

    return results