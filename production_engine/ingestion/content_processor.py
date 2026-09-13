"""
Production Content Processor: Converts raw multi-modal inputs into structured Canonical Chunks
with stable evidence IDs, timestamps, and slide/document metadata.
"""

import re
import os
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

from pipeline_experiment.shared.schemas.canonical_models import (
    CanonicalEducationalInput, SemanticChunk, TimeSpan, InstructionalEvidenceRecord
)


class ContentProcessingResult(BaseModel):
    input_id: str
    title: str
    input_type: str
    total_duration_seconds: float
    total_word_count: int
    chunks: List[SemanticChunk]
    raw_text: str
    supporting_text: Optional[str] = None


class ProductionContentProcessor:
    """Processes Raw Audio Transcripts, PDFs, PPTs, and Markdown into Canonical Chunks."""

    @classmethod
    def process_raw_input(
        cls,
        input_id: str,
        title: str,
        input_type: str,
        content_style: str,
        transcript_data: Optional[Dict[str, Any]] = None,
        raw_text: str = "",
        supporting_text: Optional[str] = None,
        chunk_window_words: int = 150
    ) -> CanonicalEducationalInput:
        chunks: List[SemanticChunk] = []

        # 1. Audio Transcript Ingestion with Segment Timestamps
        if transcript_data and "segments" in transcript_data:
            segments = transcript_data["segments"]
            curr_words: List[str] = []
            curr_start = 0.0
            curr_end = 0.0
            chunk_idx = 1

            for seg in segments:
                text = seg.get("text", "").strip()
                s_time = float(seg.get("start", 0.0))
                e_time = float(seg.get("end", 0.0))

                if not curr_words:
                    curr_start = s_time
                curr_end = e_time
                curr_words.append(text)

                if len(" ".join(curr_words).split()) >= chunk_window_words:
                    chunk_text = " ".join(curr_words)
                    chunk_id = f"C{chunk_idx:02d}"
                    evidence_id = f"E_{chunk_id}"
                    
                    chunks.append(SemanticChunk(
                        chunk_id=chunk_id,
                        source_type="TRANSCRIPT",
                        time_spans=[TimeSpan(start=curr_start, end=curr_end)],
                        text=chunk_text,
                        material_refs=[],
                        topic_candidates=[],
                        evidence=InstructionalEvidenceRecord(
                            evidence_id=evidence_id,
                            chunk_id=chunk_id,
                            dwell_time_seconds=round(curr_end - curr_start, 1)
                        )
                    ))
                    chunk_idx += 1
                    curr_words = []

            if curr_words:
                chunk_text = " ".join(curr_words)
                chunk_id = f"C{chunk_idx:02d}"
                chunks.append(SemanticChunk(
                    chunk_id=chunk_id,
                    source_type="TRANSCRIPT",
                    time_spans=[TimeSpan(start=curr_start, end=curr_end)],
                    text=chunk_text,
                    material_refs=[],
                    evidence=InstructionalEvidenceRecord(
                        evidence_id=f"E_{chunk_id}",
                        chunk_id=chunk_id,
                        dwell_time_seconds=round(curr_end - curr_start, 1)
                    )
                ))

            full_text = transcript_data.get("text", " ".join([c.text for c in chunks]))
            total_duration = max([c.time_spans[0].end for c in chunks], default=0.0) if chunks else 0.0

        # 2. Static Document Ingestion (Paragraph / Section Chunking)
        else:
            full_text = raw_text
            total_duration = 0.0
            paragraphs = [p.strip() for p in re.split(r"\n\s*\n", raw_text) if p.strip()]
            chunk_idx = 1

            for p in paragraphs:
                chunk_id = f"C{chunk_idx:02d}"
                chunks.append(SemanticChunk(
                    chunk_id=chunk_id,
                    source_type="DOCUMENT",
                    time_spans=[],
                    text=p,
                    material_refs=[f"DocSection_{chunk_idx}"],
                    evidence=InstructionalEvidenceRecord(
                        evidence_id=f"E_{chunk_id}",
                        chunk_id=chunk_id
                    )
                ))
                chunk_idx += 1

        # 3. Slide / Supporting Content Chunking
        if supporting_text:
            slide_sections = [s.strip() for s in re.split(r"--- Slide \d+ ---|\n\s*##\s+", supporting_text) if s.strip()]
            for s_idx, slide_content in enumerate(slide_sections):
                chunk_id = f"SLIDE_{s_idx+1:02d}"
                chunks.append(SemanticChunk(
                    chunk_id=chunk_id,
                    source_type="SLIDE",
                    time_spans=[],
                    text=slide_content,
                    material_refs=[f"Slide_{s_idx+1}"],
                    evidence=InstructionalEvidenceRecord(
                        evidence_id=f"E_{chunk_id}",
                        chunk_id=chunk_id
                    )
                ))

        return CanonicalEducationalInput(
            input_id=input_id,
            title=title,
            input_type=input_type,
            content_style=content_style,
            duration_seconds=total_duration,
            raw_content=full_text,
            chunks=chunks,
            supporting_materials_text=supporting_text
        )
