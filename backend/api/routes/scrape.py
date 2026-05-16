"""
HTTP-polling scrape routes for Griha AI.

POST /api/scrape/start  → starts background scrape job, returns {job_id}
GET  /api/scrape/status/{job_id} → returns {progress, status, found_count, done}
"""

import asyncio
import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from services.scraper_agent import ScraperAgent

router = APIRouter(prefix="/api/scrape", tags=["Scrape"])

# ──────────────────────────────────────────────
# In-memory job store  (ephemeral, per-instance)
# ──────────────────────────────────────────────
_jobs: Dict[str, Dict[str, Any]] = {}


class MockWebSocket:
    """Fake WebSocket so ScraperAgent can send progress updates into the job store."""

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
# Background task
# ──────────────────────────────────────────────

async def _run_scrape(job_id: str, location: str, bhk: str):
    ws = MockWebSocket(job_id)
    agent = ScraperAgent(ws)
    try:
        await agent.run_scrape_workflow(location, bhk)
    except Exception as exc:
        job = _jobs.get(job_id)
        if job:
            job["progress"] = 100
            job["status"] = f"❌ Error: {str(exc)[:120]}"
            job["done"] = True


# ──────────────────────────────────────────────
# Request / response models
# ──────────────────────────────────────────────

class ScrapeStartRequest(BaseModel):
    location: str
    bhk: Optional[str] = "2 BHK"


class ScrapeStartResponse(BaseModel):
    job_id: str


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
async def start_scrape(req: ScrapeStartRequest, background_tasks: BackgroundTasks):
    """Start a property scrape job. Returns a job_id to poll."""
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "progress": 0,
        "status": "🚀 Starting...",
        "found_count": 0,
        "done": False,
    }
    background_tasks.add_task(_run_scrape, job_id, req.location, req.bhk or "2 BHK")
    return ScrapeStartResponse(job_id=job_id)


@router.get("/status/{job_id}", response_model=ScrapeStatusResponse)
async def scrape_status(job_id: str):
    """Poll scrape job status."""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return ScrapeStatusResponse(
        job_id=job_id,
        progress=job["progress"],
        status=job["status"],
        found_count=job["found_count"],
        done=job["done"],
    )
