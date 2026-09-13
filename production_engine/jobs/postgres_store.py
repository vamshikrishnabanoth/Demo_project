"""
Durable PostgreSQL & SQLite Job Store for Architecture E v2.0.

Provides:
- Persistent job lifecycle state tracking (QUEUED -> PROCESSING -> COMPLETED -> FAILED)
- Progress tracking (0% -> 100%) and current execution stage observability
- Idempotency protection (deduplicates identical audio/slide submissions)
- Native PostgreSQL support for Demo_project with automatic SQLite fallback
"""

import os
import json
import sqlite3
import datetime
from typing import Optional, Dict, Any, List
from urllib.parse import urlparse

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False


class JobStatus:
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class JobStore:
    """Manages persistent assessment job states in PostgreSQL or local SQLite."""

    def __init__(self, db_url: Optional[str] = None):
        self.db_url = db_url or os.getenv("DATABASE_URL", os.getenv("POSTGRES_URL", ""))
        self.is_postgres = bool(self.db_url and ("postgres" in self.db_url) and PSYCOPG2_AVAILABLE)
        
        if not self.is_postgres:
            # Fallback to local SQLite (use provided path if sqlite:/// format)
            if self.db_url and self.db_url.startswith("sqlite:///"):
                self.sqlite_path = self.db_url.replace("sqlite:///", "")
            else:
                self.sqlite_path = "production_engine/outputs/assessment_jobs.db"
            os.makedirs(os.path.dirname(os.path.abspath(self.sqlite_path)), exist_ok=True)

        self._init_tables()


    def _clean_postgres_url(self, url: str) -> str:
        """Strips Prisma-specific query parameters like connection_limit that psycopg2 rejects."""
        if not url:
            return url
        import urllib.parse as urlparse
        try:
            parsed = urlparse.urlparse(url)
            query = urlparse.parse_qs(parsed.query)
            for param in ["connection_limit", "pool_timeout", "connect_timeout", "schema"]:
                query.pop(param, None)
            new_query = urlparse.urlencode(query, doseq=True)
            parsed = parsed._replace(query=new_query)
            return urlparse.urlunparse(parsed)
        except Exception:
            return url.split("?")[0]

    def _get_connection(self):
        if self.is_postgres:
            cleaned_url = self._clean_postgres_url(self.db_url)
            return psycopg2.connect(cleaned_url)
        else:
            conn = sqlite3.connect(self.sqlite_path)
            conn.row_factory = sqlite3.Row
            return conn

    def _init_tables(self):
        conn = self._get_connection()
        try:
            cur = conn.cursor()
            try:
                if self.is_postgres:
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS assessment_jobs (
                            job_id VARCHAR(64) PRIMARY KEY,
                            idempotency_key VARCHAR(128) UNIQUE,
                            status VARCHAR(32) NOT NULL,
                            current_stage VARCHAR(64) DEFAULT 'QUEUED',
                            progress_pct INTEGER DEFAULT 0,
                            input_audio_path TEXT,
                            input_slides_path TEXT,
                            requested_count INTEGER DEFAULT 5,
                            difficulty VARCHAR(32) DEFAULT 'MIXED',
                            result_suite JSONB,
                            error_message TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        );
                    """)
                else:
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS assessment_jobs (
                            job_id TEXT PRIMARY KEY,
                            idempotency_key TEXT UNIQUE,
                            status TEXT NOT NULL,
                            current_stage TEXT DEFAULT 'QUEUED',
                            progress_pct INTEGER DEFAULT 0,
                            input_audio_path TEXT,
                            input_slides_path TEXT,
                            requested_count INTEGER DEFAULT 5,
                            difficulty TEXT DEFAULT 'MIXED',
                            result_suite TEXT,
                            error_message TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        );
                    """)
                conn.commit()
            finally:
                cur.close()
        finally:
            conn.close()

    def create_job(
        self,
        job_id: str,
        idempotency_key: str,
        input_audio_path: str,
        input_slides_path: Optional[str] = None,
        requested_count: int = 5,
        difficulty: str = "MIXED"
    ) -> Dict[str, Any]:
        """Inserts a new job in QUEUED status. Returns job record dict."""
        existing = self.get_job_by_idempotency(idempotency_key)
        if existing:
            return existing

        now = datetime.datetime.utcnow().isoformat()
        conn = self._get_connection()
        try:
            cur = conn.cursor()
            try:
                placeholder = "%s" if self.is_postgres else "?"
                query = f"""
                    INSERT INTO assessment_jobs (
                        job_id, idempotency_key, status, current_stage, progress_pct,
                        input_audio_path, input_slides_path, requested_count, difficulty,
                        created_at, updated_at
                    ) VALUES ({','.join([placeholder]*11)})
                """
                cur.execute(query, (
                    job_id, idempotency_key, JobStatus.QUEUED, "QUEUED", 0,
                    input_audio_path, input_slides_path or "", requested_count, difficulty,
                    now, now
                ))
                conn.commit()
            finally:
                cur.close()
            return self.get_job(job_id)
        finally:
            conn.close()

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Fetches job by job_id."""
        conn = self._get_connection()
        try:
            placeholder = "%s" if self.is_postgres else "?"
            cur = conn.cursor(cursor_factory=RealDictCursor) if (self.is_postgres and PSYCOPG2_AVAILABLE) else conn.cursor()
            try:
                cur.execute(f"SELECT * FROM assessment_jobs WHERE job_id = {placeholder}", (job_id,))
                row = cur.fetchone()
                if not row:
                    return None
                record = dict(row)
                if isinstance(record.get("result_suite"), str):
                    try:
                        record["result_suite"] = json.loads(record["result_suite"])
                    except Exception:
                        pass
                return record
            finally:
                cur.close()
        finally:
            conn.close()

    def get_job_by_idempotency(self, idempotency_key: str) -> Optional[Dict[str, Any]]:
        """Fetches existing job by idempotency key to prevent duplicate runs."""
        conn = self._get_connection()
        try:
            placeholder = "%s" if self.is_postgres else "?"
            cur = conn.cursor(cursor_factory=RealDictCursor) if (self.is_postgres and PSYCOPG2_AVAILABLE) else conn.cursor()
            try:
                cur.execute(f"SELECT * FROM assessment_jobs WHERE idempotency_key = {placeholder}", (idempotency_key,))
                row = cur.fetchone()
                if not row:
                    return None
                record = dict(row)
                if isinstance(record.get("result_suite"), str):
                    try:
                        record["result_suite"] = json.loads(record["result_suite"])
                    except Exception:
                        pass
                return record
            finally:
                cur.close()
        finally:
            conn.close()

    def update_stage(self, job_id: str, stage: str, progress_pct: int) -> None:
        """Updates the current execution stage and progress percentage."""
        now = datetime.datetime.utcnow().isoformat()
        conn = self._get_connection()
        try:
            cur = conn.cursor()
            try:
                placeholder = "%s" if self.is_postgres else "?"
                cur.execute(f"""
                    UPDATE assessment_jobs 
                    SET status = {placeholder}, current_stage = {placeholder}, progress_pct = {placeholder}, updated_at = {placeholder}
                    WHERE job_id = {placeholder}
                """, (JobStatus.PROCESSING, stage, progress_pct, now, job_id))
                conn.commit()
            finally:
                cur.close()
        finally:
            conn.close()

    def complete_job(self, job_id: str, result_suite: Dict[str, Any]) -> None:
        """Marks a job as COMPLETED and persists the final assessment suite JSON."""
        now = datetime.datetime.utcnow().isoformat()
        conn = self._get_connection()
        try:
            cur = conn.cursor()
            try:
                placeholder = "%s" if self.is_postgres else "?"
                suite_data = json.dumps(result_suite, ensure_ascii=False) if not self.is_postgres else json.dumps(result_suite)
                cur.execute(f"""
                    UPDATE assessment_jobs 
                    SET status = {placeholder}, current_stage = 'COMPLETED', progress_pct = 100, result_suite = {placeholder}, updated_at = {placeholder}
                    WHERE job_id = {placeholder}
                """, (JobStatus.COMPLETED, suite_data, now, job_id))
                conn.commit()
            finally:
                cur.close()
        finally:
            conn.close()

    def fail_job(self, job_id: str, error_message: str) -> None:
        """Marks a job as FAILED and records the error message."""
        now = datetime.datetime.utcnow().isoformat()
        conn = self._get_connection()
        try:
            cur = conn.cursor()
            try:
                placeholder = "%s" if self.is_postgres else "?"
                cur.execute(f"""
                    UPDATE assessment_jobs 
                    SET status = {placeholder}, current_stage = 'FAILED', error_message = {placeholder}, updated_at = {placeholder}
                    WHERE job_id = {placeholder}
                """, (JobStatus.FAILED, error_message, now, job_id))
                conn.commit()
            finally:
                cur.close()
        finally:
            conn.close()

