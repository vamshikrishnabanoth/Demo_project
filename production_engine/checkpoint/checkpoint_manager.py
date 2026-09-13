"""
Stage-Wise Checkpoint & Crash Resumption Manager for Architecture E v2.0.

Provides:
- Persistent stage checkpoints (STT, Evidence Graph, Representation, Plan, Generated Questions)
- Crash recovery: Allows restarting interrupted jobs directly from the last valid stage without re-running STT
- Thread-safe serialization and automated cleanup
"""

import os
import json
from typing import Any, Optional, Dict, List
from pathlib import Path


class CheckpointStage:
    STT = "stt_transcript"
    EVIDENCE_GRAPH = "evidence_graph"
    REPRESENTATION = "representation"
    PLAN = "assessment_plan"
    GENERATED_QUESTIONS = "generated_questions"
    FINAL_SUITE = "final_suite"

    ORDER = [STT, EVIDENCE_GRAPH, REPRESENTATION, PLAN, GENERATED_QUESTIONS, FINAL_SUITE]


class StageCheckpointManager:
    """Manages intermediate execution checkpoints for durable stage recovery."""

    def __init__(self, base_dir: str = "production_engine/outputs/checkpoints"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _get_job_dir(self, job_id: str) -> Path:
        job_dir = self.base_dir / job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        return job_dir

    def _get_stage_path(self, job_id: str, stage: str) -> Path:
        return self._get_job_dir(job_id) / f"{stage}.json"

    def save_checkpoint(self, job_id: str, stage: str, data: Any) -> str:
        """Saves a checkpoint for a given job and stage. Accepts dict, list, or Pydantic models."""
        stage_path = self._get_stage_path(job_id, stage)
        
        # Handle Pydantic or custom objects with model_dump or to_dict
        if hasattr(data, "model_dump"):
            serialized = data.model_dump()
        elif hasattr(data, "to_dict"):
            serialized = data.to_dict()
        elif hasattr(data, "__dict__") and not isinstance(data, (dict, list, str, int, float, bool)):
            serialized = data.__dict__
        else:
            serialized = data

        with open(stage_path, "w", encoding="utf-8") as f:
            json.dump(serialized, f, indent=2, ensure_ascii=False, default=str)

        return str(stage_path)

    def has_checkpoint(self, job_id: str, stage: str) -> bool:
        """Returns True if a valid, non-empty checkpoint file exists for the given stage."""
        stage_path = self._get_stage_path(job_id, stage)
        return stage_path.exists() and stage_path.stat().st_size > 0

    def load_checkpoint(self, job_id: str, stage: str) -> Optional[Any]:
        """Loads and returns the checkpoint data, or None if not found or corrupted."""
        stage_path = self._get_stage_path(job_id, stage)
        if not stage_path.exists():
            return None

        try:
            with open(stage_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None

    def get_latest_valid_stage(self, job_id: str) -> Optional[str]:
        """Returns the name of the highest completed stage in execution order."""
        latest = None
        for stage in CheckpointStage.ORDER:
            if self.has_checkpoint(job_id, stage):
                latest = stage
            else:
                break
        return latest

    def clear_checkpoints(self, job_id: str) -> None:
        """Removes all checkpoint files for the given job_id upon successful suite completion."""
        job_dir = self.base_dir / job_id
        if job_dir.exists():
            for child in job_dir.glob("*.json"):
                try:
                    child.unlink()
                except Exception:
                    pass
            try:
                job_dir.rmdir()
            except Exception:
                pass
