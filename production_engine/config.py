"""
Central Production Configuration & Version Pinning for Architecture E v2.0.

Defines:
- Pinned engine and prompt versions
- Frozen model assignments per task
- Task-specific fallback hierarchies
- Configurable initial production thresholds (pending real faculty empirical calibration)
- Security and file validation constraints
"""

import os
from typing import Dict, List
from dotenv import load_dotenv

load_dotenv()
_project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_demo_env = os.path.join(_project_dir, ".env")
if os.path.exists(_demo_env):
    load_dotenv(_demo_env)
_server_env = os.path.join(_project_dir, "server", ".env")
if os.path.exists(_server_env):
    load_dotenv(_server_env)

# ==============================================================================
# 1. VERSION PINNING & PROVENANCE
# ==============================================================================
PIPELINE_VERSION = "2.0.0"
PROMPT_VERSION = "2026.09.v1"
ENGINE_CODENAME = "Architecture E v2.0 (Production Hardened)"

# ==============================================================================
# 2. FROZEN PRODUCTION MODEL ASSIGNMENTS
# ==============================================================================
# Target Architecture: fine-tuned local LLaMA on KMIT GPU
# Temporary Serving Mode: configuration-driven hosted LLaMA family via approved provider
GENERATOR_PROVIDER = os.getenv("GENERATOR_PROVIDER", "groq")
GENERATOR_MODEL = os.getenv("GENERATOR_MODEL", "allam-2-7b")
GENERATOR_PROVIDER_TARGET = os.getenv("GENERATOR_PROVIDER_TARGET", "kmit_gpu")
GENERATOR_MODEL_TARGET = os.getenv("GENERATOR_MODEL_TARGET", "ft-llama-3-8b-kmit")
SERVING_MODE = "KMIT_GPU" if GENERATOR_PROVIDER == "kmit_gpu" else "TEMPORARY_HOSTED_DEMO"

MODEL_MAP = {
    # Speech-to-Text: 0.0% Clean WER, 100% CS Technical Term Accuracy (Exp 1)
    "stt": "whisper-large-v3",
    
    # Representation Extraction: 100% math formula and code syntax retention (Exp 9)
    "representation": "openai/gpt-oss-20b",
    
    # Adaptive Assessment Planning: 12 pedagogical facets, 0% grounding violations (Exp 4 & 9)
    "planning": "openai/gpt-oss-20b",
    
    # MCQ Generation: Specialized pedagogical distractors, $0.00 campus API cost
    "generator": "ft-llama-3-8b-kmit",
    
    # Critic & Surgical Patch Repair: 100% non-defective field preservation (Exp 5 & 9)
    "critic": "openai/gpt-oss-120b",
    
    # Text Embedding & Graph Alignment: Fast local sub-millisecond cosine distance
    "embedding": "all-MiniLM-L6-v2",
    
    # Router & Integrity Validation: Pure Python deterministic core (0 LLM calls)
    "router": "deterministic",
    "validator": "deterministic"
}

# Task-Specific Fallbacks (Preserves task contracts; strictly LLaMA family for generator)
TASK_FALLBACKS: Dict[str, List[str]] = {
    "stt": ["deepgram/nova-2"],
    "representation": ["groq/llama-3.3-70b-versatile", "google/gemini-2.5-flash"],
    "planning": ["groq/llama-3.3-70b-versatile", "google/gemini-2.5-flash"],
    "generator": ["groq/allam-2-7b", "groq/llama-3.3-70b-versatile"],  # Strictly LLaMA family to preserve prompt format
    "critic": ["openai/gpt-4o", "openai/gpt-oss-20b"]
}

# ==============================================================================
# 3. CONFIGURABLE INITIAL PRODUCTION DEFAULTS
# ==============================================================================
# NOTE: These are empirical starting thresholds awaiting broader multi-faculty calibration.
# Do NOT treat these as theoretically optimal constants.
SIMILARITY_THRESHOLD_EMBEDDING: float = float(os.getenv("SIMILARITY_THRESHOLD_EMBEDDING", "0.65"))
SIMILARITY_THRESHOLD_DEDUP: float = float(os.getenv("SIMILARITY_THRESHOLD_DEDUP", "0.75"))
TARGET_WORDS_PER_QUESTION: int = int(os.getenv("TARGET_WORDS_PER_QUESTION", "35"))
STT_TIMEOUT_SECONDS: int = int(os.getenv("STT_TIMEOUT_SECONDS", "120"))
CACHE_TTL_DAYS: int = int(os.getenv("CACHE_TTL_DAYS", "7"))

# Router PDI (Pedagogical Delivery Index) Thresholds
PDI_SUMMARY_THRESHOLD: float = 0.35
PDI_BLUEPRINT_THRESHOLD: float = 0.70

# ==============================================================================
# 4. SECURITY & FILE CONSTRAINTS
# ==============================================================================
MAX_AUDIO_SIZE_BYTES = 150 * 1024 * 1024  # 150 MB max audio
MAX_SLIDES_SIZE_BYTES = 30 * 1024 * 1024   # 30 MB max slides/PDF

ALLOWED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".aac", ".ogg", ".flac"}
ALLOWED_SLIDE_EXTENSIONS = {".pdf", ".pptx", ".ppt"}

# Magic byte signatures for MIME validation
MAGIC_SIGNATURES = {
    "audio/wav": b"RIFF",
    "audio/mpeg": b"\xff\xfb",
    "audio/mp3_id3": b"ID3",
    "application/pdf": b"%PDF",
    "application/zip_pptx": b"PK\x03\x04"  # Modern Office PPTX is a zip archive
}

# ==============================================================================
# 5. DATABASE CONFIGURATION (Demo_project PostgreSQL or SQLite fallback)
# ==============================================================================
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    os.getenv(
        "POSTGRES_URL",
        "sqlite:///./production_engine/outputs/assessment_jobs.db"
    )
)
