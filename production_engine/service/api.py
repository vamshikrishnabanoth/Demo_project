"""
FastAPI Production Web Service for Architecture E v2.0.

Endpoints:
- POST /assessments/submit: Submits audio + slides for async assessment generation (<50ms response)
- GET /assessments/jobs/{job_id}/status: Polling endpoint for progress tracking (0% -> 100%)
- GET /assessments/jobs/{job_id}/result: Fetches completed ProductionAssessmentSuite JSON
- POST /assessments/questions/{question_id}/repair: 1-click teacher surgical question repair
- GET /health: System health and version status
"""

import os
import uuid
import hashlib
from typing import Optional
from fastapi import FastAPI, APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse

from production_engine.config import (
    PIPELINE_VERSION,
    PROMPT_VERSION,
    ENGINE_CODENAME,
    MODEL_MAP
)
from production_engine.jobs.postgres_store import JobStore, JobStatus
from production_engine.jobs.worker import AssessmentWorker
from production_engine.security.input_guard import InputGuard, InputSecurityError

router = APIRouter(prefix="/assessments", tags=["Assessments"])
job_store = JobStore()
worker = AssessmentWorker(job_store=job_store)


def run_worker_task(job_id: str):
    """Background task function to process the assessment."""
    try:
        worker.process_job(job_id)
    except Exception as e:
        print(f"[Worker Error] Job {job_id} failed: {e}", flush=True)


@router.post("/submit")
async def submit_assessment(
    background_tasks: BackgroundTasks,
    audio_file: UploadFile = File(...),
    slides_file: Optional[UploadFile] = File(None),
    requested_count: int = Form(5),
    difficulty: str = Form("MIXED")
):
    """
    Submits lecture audio and optional slides for asynchronous assessment generation.
    Returns job_id immediately (<50ms).
    """
    # 1. Sanitize filenames and stage files
    staging_dir = "production_engine/outputs/staging"
    os.makedirs(staging_dir, exist_ok=True)

    safe_audio_name = InputGuard.sanitize_filename(audio_file.filename or "lecture.wav")
    staged_audio_path = os.path.join(staging_dir, safe_audio_name)

    audio_bytes = await audio_file.read()
    with open(staged_audio_path, "wb") as f:
        f.write(audio_bytes)

    # Validate audio file
    try:
        InputGuard.validate_audio_file(staged_audio_path)
    except InputSecurityError as e:
        if os.path.exists(staged_audio_path):
            os.remove(staged_audio_path)
        raise HTTPException(status_code=400, detail=str(e))

    staged_slides_path = None
    slides_bytes = b""
    if slides_file and slides_file.filename:
        safe_slides_name = InputGuard.sanitize_filename(slides_file.filename)
        staged_slides_path = os.path.join(staging_dir, safe_slides_name)
        slides_bytes = await slides_file.read()
        with open(staged_slides_path, "wb") as f:
            f.write(slides_bytes)

        try:
            InputGuard.validate_slides_file(staged_slides_path)
        except InputSecurityError as e:
            if os.path.exists(staged_audio_path):
                os.remove(staged_audio_path)
            if os.path.exists(staged_slides_path):
                os.remove(staged_slides_path)
            raise HTTPException(status_code=400, detail=str(e))

    # 2. Compute idempotency key
    hasher = hashlib.sha256()
    hasher.update(audio_bytes)
    hasher.update(slides_bytes)
    hasher.update(str(requested_count).encode())
    hasher.update(difficulty.upper().encode())
    idempotency_key = hasher.hexdigest()

    # 3. Check existing job
    existing_job = job_store.get_job_by_idempotency(idempotency_key)
    if existing_job:
        # Return existing job without recomputing
        return JSONResponse(
            status_code=200,
            content={
                "job_id": existing_job["job_id"],
                "status": existing_job["status"],
                "progress_pct": existing_job["progress_pct"],
                "message": "Existing job retrieved via idempotency deduplication."
            }
        )

    # 4. Create new job record
    job_id = f"job_{uuid.uuid4().hex[:12]}"
    job_store.create_job(
        job_id=job_id,
        idempotency_key=idempotency_key,
        input_audio_path=staged_audio_path,
        input_slides_path=staged_slides_path,
        requested_count=requested_count,
        difficulty=difficulty
    )

    # 5. Dispatch to background worker
    background_tasks.add_task(run_worker_task, job_id)

    return JSONResponse(
        status_code=202,
        content={
            "job_id": job_id,
            "status": JobStatus.QUEUED,
            "progress_pct": 0,
            "message": "Assessment generation job accepted and queued."
        }
    )


@router.get("/jobs/{job_id}/status")
async def get_job_status(job_id: str):
    """Returns the current status, stage, and progress percentage for a job."""
    job = job_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    return {
        "job_id": job["job_id"],
        "status": job["status"],
        "current_stage": job.get("current_stage", "UNKNOWN"),
        "progress_pct": job.get("progress_pct", 0),
        "error_message": job.get("error_message"),
        "created_at": job.get("created_at"),
        "updated_at": job.get("updated_at")
    }


@router.get("/jobs/{job_id}/result")
async def get_job_result(job_id: str):
    """Returns the completed ProductionAssessmentSuite JSON."""
    job = job_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    if job["status"] == JobStatus.FAILED:
        raise HTTPException(
            status_code=500,
            detail=f"Assessment generation failed: {job.get('error_message')}"
        )

    if job["status"] != JobStatus.COMPLETED:
        return JSONResponse(
            status_code=202,
            content={
                "job_id": job["job_id"],
                "status": job["status"],
                "progress_pct": job.get("progress_pct", 0),
                "message": "Job is still processing. Please poll status again."
            }
        )

    return job["result_suite"]


app = FastAPI(
    title="KMIT Lecture Assessment Engine API",
    version=PIPELINE_VERSION,
    description="Architecture E v2.0 Production Service for Lecture-to-Assessment Generation"
)

app.include_router(router)


@app.get("/health", tags=["Health"])
async def health_check():
    """System health check and version provenance."""
    return {
        "status": "healthy",
        "pipeline_version": PIPELINE_VERSION,
        "prompt_version": PROMPT_VERSION,
        "engine": ENGINE_CODENAME,
        "frozen_models": MODEL_MAP
    }
