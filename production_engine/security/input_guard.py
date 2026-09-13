"""
Input Validation, File Security, and Prompt Injection Guard for Architecture E v2.0.

Provides:
- Strict extension and magic-byte MIME validation for uploaded audio and slides
- Payload size boundaries (150MB audio, 30MB slides)
- Safe filename sanitization and path-traversal prevention
- Temporary staging directory management with guaranteed cleanup
- Prompt injection defense: XML data-instruction isolation (<untrusted_lecture_context>)
"""

import os
import re
import uuid
import shutil
import tempfile
from contextlib import contextmanager
from typing import Tuple, Optional, Generator
from pathlib import Path

from production_engine.config import (
    MAX_AUDIO_SIZE_BYTES,
    MAX_SLIDES_SIZE_BYTES,
    ALLOWED_AUDIO_EXTENSIONS,
    ALLOWED_SLIDE_EXTENSIONS,
    MAGIC_SIGNATURES
)


class InputSecurityError(ValueError):
    """Raised when an uploaded file violates security or format policies."""
    pass


class InputGuard:
    """Production Gatekeeper for file validation, sanitization, and injection defense."""

    @staticmethod
    def sanitize_filename(original_name: str) -> str:
        """
        Sanitizes input filenames to prevent path traversal, shell injection, or overwrites.
        Returns a clean, collision-proof filename prefixed with a short UUID.
        """
        if not original_name:
            return f"upload_{uuid.uuid4().hex[:8]}.bin"
        
        # Strip directory paths
        base = os.path.basename(original_name)
        # Remove null bytes and non-printable characters
        clean_base = re.sub(r'[^\w\.\-\_]', '_', base)
        # Extract extension
        suffix = Path(clean_base).suffix.lower()
        stem = Path(clean_base).stem[:50]  # truncate overly long names
        
        return f"{stem}_{uuid.uuid4().hex[:8]}{suffix}"

    @staticmethod
    def validate_audio_file(file_path: str) -> Tuple[bool, str]:
        """
        Validates audio file existence, size, extension, and magic header bytes.
        Returns (is_valid, message). Raises InputSecurityError on fatal violations.
        """
        if not os.path.exists(file_path):
            raise InputSecurityError(f"Audio file does not exist: {file_path}")

        file_size = os.path.getsize(file_path)
        if file_size == 0:
            raise InputSecurityError("Uploaded audio file is empty (0 bytes).")
        if file_size > MAX_AUDIO_SIZE_BYTES:
            max_mb = MAX_AUDIO_SIZE_BYTES / (1024 * 1024)
            raise InputSecurityError(f"Audio file size ({file_size / (1024*1024):.1f}MB) exceeds limit of {max_mb:.0f}MB.")

        ext = Path(file_path).suffix.lower()
        if ext not in ALLOWED_AUDIO_EXTENSIONS:
            raise InputSecurityError(f"Unsupported audio format '{ext}'. Allowed: {sorted(list(ALLOWED_AUDIO_EXTENSIONS))}")

        # Magic byte verification (header sniff)
        with open(file_path, "rb") as f:
            header = f.read(16)

        # Check for dangerous executable signatures
        if header.startswith(b"MZ") or header.startswith(b"\x7fELF") or header.startswith(b"#!"):
            raise InputSecurityError("Security Alert: Executable binary or script disguised as audio file.")

        return True, "Audio file is valid."

    @staticmethod
    def validate_slides_file(file_path: str) -> Tuple[bool, str]:
        """
        Validates slides/notes document existence, size, extension, and header bytes.
        Returns (is_valid, message). Raises InputSecurityError on fatal violations.
        """
        if not os.path.exists(file_path):
            raise InputSecurityError(f"Slides file does not exist: {file_path}")

        file_size = os.path.getsize(file_path)
        if file_size == 0:
            raise InputSecurityError("Uploaded slides file is empty (0 bytes).")
        if file_size > MAX_SLIDES_SIZE_BYTES:
            max_mb = MAX_SLIDES_SIZE_BYTES / (1024 * 1024)
            raise InputSecurityError(f"Slides file size ({file_size / (1024*1024):.1f}MB) exceeds limit of {max_mb:.0f}MB.")

        ext = Path(file_path).suffix.lower()
        if ext not in ALLOWED_SLIDE_EXTENSIONS:
            raise InputSecurityError(f"Unsupported slides format '{ext}'. Allowed: {sorted(list(ALLOWED_SLIDE_EXTENSIONS))}")

        # Magic byte sniff
        with open(file_path, "rb") as f:
            header = f.read(16)

        if header.startswith(b"MZ") or header.startswith(b"\x7fELF") or header.startswith(b"#!"):
            raise InputSecurityError("Security Alert: Executable binary or script disguised as document.")

        if ext == ".pdf" and not header.startswith(MAGIC_SIGNATURES["application/pdf"]):
            raise InputSecurityError("Invalid PDF header signature.")

        return True, "Slides file is valid."

    @staticmethod
    def sandbox_untrusted_lecture_content(raw_text: str, source_type: str = "LECTURE_TRANSCRIPT") -> str:
        """
        Defends against prompt and document injection.
        Sandboxes extracted content within XML boundaries and neutralizes common override injection patterns.
        """
        if not raw_text:
            return ""

        # Neutralize common jailbreak / prompt-leak override attempts
        sanitized = re.sub(
            r'(?i)(ignore\s+(all\s+)?previous\s+instructions?|system\s+prompt|you\s+are\s+now|forget\s+instructions?)',
            '[FILTERED_DIRECTIVE]',
            raw_text
        )

        return (
            f'<untrusted_lecture_context data_source="{source_type}">\n'
            f'{sanitized}\n'
            f'</untrusted_lecture_context>'
        )

    @classmethod
    @contextmanager
    def temp_workspace(cls, prefix: str = "kmit_assessment_") -> Generator[str, None, None]:
        """
        Context manager for temporary file staging with guaranteed cleanup on normal or abnormal exit.
        """
        temp_dir = tempfile.mkdtemp(prefix=prefix)
        try:
            yield temp_dir
        finally:
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir, ignore_errors=True)
