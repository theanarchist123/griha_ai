"""
HTTP scrape routes for Griha AI.

IMPORTANT: On Vercel serverless, BackgroundTasks are killed after the
response is sent.  Therefore `/start` runs the scrape **synchronously**
within the request and streams progress updates into an in-memory store
that `/status/{job_id}` can poll.

For Vercel Hobby (10 s) this will often time out.  We cap the scrape at
~55 s so it fits inside Pro‑tier (60 s) limits.  If it times out, the
partial results already saved to MongoDB are still queryable.
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
    """Fake WebSocket so ScraperAgent can push progress into the job store."""

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

    On Vercel serverless, we run synchronously within this request
    (BackgroundTasks die after response). The scrape saves results
    directly to MongoDB. Even if the function times out after 10-60 s,
    partial results are already persisted and queryable.
    """
    # Lazy import to avoid circular import at module-load time
    from services.scraper_agent import ScraperAgent

    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "progress": 0,
        "status": "🚀 Starting...",
        "found_count": 0,
        "done": False,
    }

    ws = MockWebSocket(job_id)
    agent = ScraperAgent(ws)

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
                f"⏱️ Scrape timed out but partial results were saved. "
                f"Refresh your dashboard to see them."
            )
            job["done"] = True
    except Exception as exc:
        job = _jobs.get(job_id)
        if job:
            job["progress"] = 100
            job["status"] = f"❌ Error: {str(exc)[:120]}"
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
        # On serverless, the instance that ran /start is likely gone.
        # Return "done" so frontend stops polling.
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
