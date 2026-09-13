"""
Shared Boundary-Preserving Semantic Chunker.
Slices educational input into coherent instructional units (C01, C02...) while capturing observable instructional evidence.
"""

from typing import List, Dict, Any, Optional
import re
from pipeline_experiment.shared.schemas.canonical_models import (
    SemanticChunk,
    InstructionalEvidenceRecord,
    TimeSpan,
    CanonicalEducationalInput
)
from pipeline_experiment.shared.alignment.multimodal_synchronizer import MultimodalSynchronizer


class SemanticInstructionalChunker:
    EMPHASIS_PATTERNS = [
        r"\b(?:very\s+important|crucial|vital|pay\s+attention|keep\s+in\s+mind|essential)\b",
        r"\b(?:in\s+(?:the\s+)?exam|exam\s+question|most\s+frequently\s+asked|high\s+priority)\b",
        r"\b(?:common\s+mistake|students\s+often\s+confuse|don't\s+forget|critical\s+point)\b",
        r"\b(?:always\s+remember|note\s+this\s+down|key\s+takeaway|highlight\s+this)\b"
    ]

    WORKED_EXAMPLE_PATTERNS = [
        r"\b(?:for\s+example|let's\s+take|suppose\s+we\s+have|consider\s+an\s+image\s+of)\b",
        r"\b(?:let's\s+calculate|step\s+by\s+step|substitute\s+into\s+the\s+formula|plug\s+in)\b",
        r"\b(?:numerical\s+example|trace\s+this|walk\s+through\s+this\s+case)\b"
    ]

    DEBUGGING_PATTERNS = [
        r"\b(?:runtimeerror|mismatch|error\s+occurred|traceback|why\s+is\s+it\s+failing)\b",
        r"\b(?:shape\s+mismatch|dimension\s+error|let's\s+fix\s+this|debug|bug|exception)\b"
    ]

    CODE_INTERACTION_PATTERNS = [
        r"\b(?:torch\.|nn\.conv2d|import\s+|def\s+|class\s+|return\s+|self\.|optimizer|flatten)\b",
        r"\b(?:colab|jupyter|run\s+this\s+cell|execution\s+output|tensor\s+shape|cuda)\b",
        r"\b(?:db\.\w+\.aggregate|\$match|\$group|\$project|git\s+checkout|git\s+merge)\b"
    ]

    STUDENT_QNA_PATTERNS = [
        r"\b(?:sir|ma'am|any\s+questions|can\s+you\s+explain\s+again|why\s+is\s+that)\b",
        r"\b(?:good\s+question|student\s+asked|let\s+me\s+clarify|someone\s+in\s+chat)\b"
    ]

    NEGATIVE_INSTRUCTION_PATTERNS = [
        r"\b(?:do\s+not|don't\s+ever|never\s+do|avoid\s+doing|this\s+is\s+wrong|anti-pattern)\b"
    ]

    @classmethod
    def chunk_input(
        cls,
        canonical_input: CanonicalEducationalInput,
        target_chunk_duration: float = 180.0  # ~3 min pedagogical slices
    ) -> CanonicalEducationalInput:
        """
        Segments canonical educational input into semantic chunks and attaches observable evidence.
        """
        raw_text = canonical_input.raw_content
        segments = MultimodalSynchronizer.parse_timestamped_transcript(
            raw_text,
            default_duration=max(10.0, canonical_input.duration_seconds)
        )

        chunks: List[SemanticChunk] = []
        current_texts = []
        current_spans: List[TimeSpan] = []
        chunk_counter = 1

        for seg in segments:
            current_texts.append(seg["text"])
            current_spans.append(seg["time_span"])

            current_duration = sum(s.end - s.start for s in current_spans)
            if current_duration >= target_chunk_duration:
                chunk_obj = cls._build_chunk(
                    chunk_id=f"C{chunk_counter:02d}",
                    source_type=canonical_input.input_type,
                    texts=current_texts,
                    spans=current_spans
                )
                chunks.append(chunk_obj)
                chunk_counter += 1
                current_texts = []
                current_spans = []

        if current_texts:
            chunk_obj = cls._build_chunk(
                chunk_id=f"C{chunk_counter:02d}",
                source_type=canonical_input.input_type,
                texts=current_texts,
                spans=current_spans if current_spans else [TimeSpan(start=0.0, end=canonical_input.duration_seconds or 60.0)]
            )
            chunks.append(chunk_obj)

        canonical_input.chunks = chunks
        return canonical_input

    @classmethod
    def _build_chunk(
        cls,
        chunk_id: str,
        source_type: str,
        texts: List[str],
        spans: List[TimeSpan]
    ) -> SemanticChunk:
        full_text = " ".join(texts)
        text_lower = full_text.lower()

        dwell_time = sum(s.end - s.start for s in spans) if spans else 60.0

        # Extract emphasis markers
        emphasis_matches = []
        for pat in cls.EMPHASIS_PATTERNS:
            emphasis_matches.extend(re.findall(pat, text_lower))

        has_example = any(bool(re.search(pat, text_lower)) for pat in cls.WORKED_EXAMPLE_PATTERNS)
        has_debug = any(bool(re.search(pat, text_lower)) for pat in cls.DEBUGGING_PATTERNS)
        has_code = any(bool(re.search(pat, text_lower)) for pat in cls.CODE_INTERACTION_PATTERNS)
        has_qna = any(bool(re.search(pat, text_lower)) for pat in cls.STUDENT_QNA_PATTERNS)
        has_negative = any(bool(re.search(pat, text_lower)) for pat in cls.NEGATIVE_INSTRUCTION_PATTERNS)

        # Repetition of key domain terms
        key_terms = re.findall(r"\b(?:padding|stride|kernel|channels|receptive\s+field|convolution|aggregation|pipeline|consensus|branch|commit)\b", text_lower)
        repetition_count = len(key_terms)

        evidence = InstructionalEvidenceRecord(
            evidence_id=f"E_{chunk_id}",
            time_spans=spans,
            dwell_time=round(dwell_time, 1),
            repetition_count=repetition_count,
            emphasis_markers=list(set(emphasis_matches)),
            worked_example=has_example,
            demonstration=has_code,
            student_question=has_qna,
            teacher_correction=has_debug,
            debugging_event=has_debug,
            code_interaction=has_code,
            negative_instruction=has_negative
        )

        return SemanticChunk(
            chunk_id=chunk_id,
            source_type=source_type,
            time_spans=spans,
            text=full_text,
            topic_candidates=list(set(key_terms[:4])),
            evidence=evidence
        )
