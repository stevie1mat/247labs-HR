"""
AI Automation Server — FastAPI backend for AI-driven job posting.
Receives job distribution requests and uses a headless browser + LLM
to automatically post jobs on third-party platforms.
"""

import os
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
from supabase import create_client, Client

from agent import run_agent

load_dotenv()

# ─── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ─── Supabase Admin Client ──────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def get_supabase_admin() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# ─── Startup: install Playwright browsers ───────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Install Playwright browsers on startup."""
    logger.info("Installing Playwright Chromium browser...")
    import subprocess
    subprocess.run(["playwright", "install", "chromium"], check=True)
    logger.info("Playwright Chromium installed successfully.")
    yield


# ─── FastAPI App ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="AI Job Distribution Agent",
    description="Headless browser + LLM agent that posts jobs automatically",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request / Response Models ───────────────────────────────────────────────────
class JobPostRequest(BaseModel):
    platform: str = Field(..., description="Target platform (e.g., linkedin, remotive, wellfound)")
    posting_id: int = Field(..., description="The jobPostings.id from Supabase")
    credentials: dict = Field(default_factory=dict, description="Login credentials for the platform")


class JobPostResponse(BaseModel):
    success: bool
    posted_url: Optional[str] = None
    steps_taken: int = 0
    verification_reason: Optional[str] = None
    error: Optional[str] = None


# ─── Health Check ────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-automation-agent"}


# ─── Main Endpoint: Post a Job ───────────────────────────────────────────────────
@app.post("/post-job", response_model=JobPostResponse)
async def post_job(
    req: JobPostRequest,
    x_api_key: str = Header(default="", alias="x-api-key"),
):
    """
    Receives a job posting request, fetches the job data from Supabase,
    and uses the AI agent to post it on the target platform.
    """
    # Simple API key auth
    expected_key = os.getenv("AUTOMATION_API_KEY", "")
    if expected_key and x_api_key != expected_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

    logger.info(f"Received request to post job #{req.posting_id} on {req.platform}")

    # Fetch the job posting from Supabase
    supabase = get_supabase_admin()
    result = supabase.table("jobPostings").select("*").eq("id", req.posting_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail=f"Job posting #{req.posting_id} not found")

    job_data = result.data
    logger.info(f"Fetched job: {job_data.get('title', 'Unknown')}")

    # Run the AI agent
    try:
        agent_result = await run_agent(
            platform=req.platform,
            job_data=job_data,
            credentials=req.credentials,
            max_steps=25,
        )
    except Exception as e:
        logger.error(f"Agent execution error: {e}")
        # Log the failure to Supabase
        supabase.table("jobPostingLogs").insert({
            "jobPostingId": req.posting_id,
            "platform": req.platform,
            "status": "failed",
            "errorMessage": f"AI Agent error: {str(e)}",
            "attemptCount": 1,
            "lastAttemptAt": "now()",
            "attemptedAt": "now()",
        }).execute()
        return JobPostResponse(success=False, error=str(e))

    # Log the result to Supabase
    log_entry = {
        "jobPostingId": req.posting_id,
        "platform": req.platform,
        "status": "success" if agent_result["success"] else "failed",
        "externalUrl": agent_result.get("posted_url"),
        "errorMessage": agent_result.get("error") or agent_result.get("verification", {}).get("reason"),
        "attemptCount": 1,
        "lastAttemptAt": "now()",
        "attemptedAt": "now()",
    }
    supabase.table("jobPostingLogs").insert(log_entry).execute()
    logger.info(f"Result: {'SUCCESS' if agent_result['success'] else 'FAILED'} — {agent_result.get('posted_url', 'No URL')}")

    return JobPostResponse(
        success=agent_result["success"],
        posted_url=agent_result.get("posted_url"),
        steps_taken=len(agent_result.get("logs", [])),
        verification_reason=agent_result.get("verification", {}).get("reason"),
        error=agent_result.get("error"),
    )


# ─── Run ─────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=True)
