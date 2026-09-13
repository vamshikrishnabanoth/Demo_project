"""
Upfront Feature Extractor for Educational Inputs.
Extracts 6 simple observable structural and pedagogical signals:
1. has_audio (bool)
2. has_ppt (bool)
3. code_density (float)
4. text_length_words (int)
5. pedagogical_marker_density (float) - count of emphasis/cue words per 1000 words
6. dialogue_interaction_density (float) - count of Q&A/interaction markers per 1000 words

STRICT NO-PEEKING: Operates purely on raw text / canonical input before any MCQ generation.
"""

import re
from typing import Dict, Any
from pydantic import BaseModel, Field

from pipeline_experiment.shared.schemas.canonical_models import CanonicalEducationalInput


class UpfrontInputFeatures(BaseModel):
    input_id: str
    has_audio: bool = Field(description="Whether input has live spoken audio recording")
    has_ppt: bool = Field(description="Whether input has visual presentation slides / PPT")
    code_density: float = Field(description="Ratio of code-like lines/tokens to total text (0.0 to 1.0)")
    text_length_words: int = Field(description="Total word count of the canonical content")
    pedagogical_marker_density: float = Field(description="Count of instructional emphasis cues per 1,000 words")
    dialogue_interaction_density: float = Field(description="Count of Q&A / conversational interaction turns per 1,000 words")


class UpfrontFeatureExtractor:
    """Extracts the 6 simple observable features from CanonicalEducationalInput."""

    PEDAGOGICAL_CUES = [
        r"\bremember\b", r"\bimportant\b", r"\bnote that\b", r"\bpay attention\b",
        r"\bkey point\b", r"\bmistake\b", r"\bdon'?t forget\b", r"\bexam\b",
        r"\brule of thumb\b", r"\bnotice how\b", r"\bcareful\b", r"\bcritical\b"
    ]

    DIALOGUE_CUES = [
        r"\bany questions\b", r"\bunderstand\b", r"\byes sir\b", r"\byes ma'?am\b",
        r"\bright\?", r"\bgot it\b", r"\bwho can tell\b", r"\bwhat happens if\b",
        r"\bwhat is the answer\b", r"\bwhy is that\b", r"\bdo you agree\b"
    ]

    CODE_PATTERNS = [
        r"def\s+\w+\(", r"function\s+\w+\(", r"#include\s*<", r"import\s+\w+",
        r"for\s*\([^)]*\)", r"while\s*\([^)]*\)", r"console\.log\(", r"printf\(",
        r"return\s+[^;]+;", r"db\.\w+\.", r"public\s+class\s+\w+"
    ]

    @classmethod
    def extract(cls, canonical: CanonicalEducationalInput) -> UpfrontInputFeatures:
        text = (canonical.raw_content or "") + "\n" + (canonical.supporting_materials_text or "")
        words = re.findall(r"\b\w+\b", text)
        word_count = max(1, len(words))

        # 1. Structural features
        has_audio = canonical.input_type in ["VOICE_ONLY", "VOICE_PLUS_PPT"] or canonical.duration_seconds > 0
        has_ppt = bool(canonical.supporting_materials_text and len(canonical.supporting_materials_text.strip()) > 50) or canonical.input_type == "VOICE_PLUS_PPT"

        # 2. Code density
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        total_lines = max(1, len(lines))
        code_line_count = 0
        for line in lines:
            if any(re.search(pat, line) for pat in cls.CODE_PATTERNS) or line.startswith(("{", "}", "/*", "//", "```", "$")):
                code_line_count += 1
        code_density = round(min(1.0, code_line_count / total_lines), 3)

        # 3. Pedagogical emphasis density (per 1k words)
        ped_count = 0
        for pat in cls.PEDAGOGICAL_CUES:
            ped_count += len(re.findall(pat, text, re.IGNORECASE))
        pedagogical_density = round((ped_count / word_count) * 1000.0, 2)

        # 4. Dialogue interaction density (per 1k words)
        dialogue_count = 0
        for pat in cls.DIALOGUE_CUES:
            dialogue_count += len(re.findall(pat, text, re.IGNORECASE))
        dialogue_density = round((dialogue_count / word_count) * 1000.0, 2)

        return UpfrontInputFeatures(
            input_id=canonical.input_id,
            has_audio=has_audio,
            has_ppt=has_ppt,
            code_density=code_density,
            text_length_words=word_count,
            pedagogical_marker_density=pedagogical_density,
            dialogue_interaction_density=dialogue_density
        )
