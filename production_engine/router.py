"""
Production 3-Way Representation Router.
Determines whether to route to Summary (WHAT), Blueprint (WHY), or Unified (WHAT + WHY)
based on 6 observable upfront input features.
"""

import re
from typing import Dict, Any
from production_engine.schemas import InputFeatures, RoutingDecision, RepresentationType
from pipeline_experiment.shared.schemas.canonical_models import CanonicalEducationalInput


class ProductionRouter:
    """Deterministic, explainable 3-way representation router."""

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
    def extract_features(cls, canonical: CanonicalEducationalInput) -> InputFeatures:
        text = (canonical.raw_content or "") + "\n" + (canonical.supporting_materials_text or "")
        words = re.findall(r"\b\w+\b", text)
        word_count = max(1, len(words))

        has_audio = canonical.input_type in ["VOICE_ONLY", "VOICE_PLUS_PPT"] or canonical.duration_seconds > 0
        has_ppt = bool(canonical.supporting_materials_text and len(canonical.supporting_materials_text.strip()) > 50) or canonical.input_type == "VOICE_PLUS_PPT"

        lines = [l.strip() for l in text.split("\n") if l.strip()]
        total_lines = max(1, len(lines))
        code_count = sum(
            1 for l in lines
            if any(re.search(pat, l) for pat in cls.CODE_PATTERNS) or l.startswith(("{", "}", "/*", "//", "```", "$"))
        )
        code_density = round(min(1.0, code_count / total_lines), 3)

        ped_count = sum(len(re.findall(pat, text, re.IGNORECASE)) for pat in cls.PEDAGOGICAL_CUES)
        ped_density = round((ped_count / word_count) * 1000.0, 2)

        dialogue_count = sum(len(re.findall(pat, text, re.IGNORECASE)) for pat in cls.DIALOGUE_CUES)
        dialogue_density = round((dialogue_count / word_count) * 1000.0, 2)

        return InputFeatures(
            has_audio=has_audio,
            has_ppt=has_ppt,
            code_density=code_density,
            text_length_words=word_count,
            pedagogical_marker_density=ped_density,
            dialogue_interaction_density=dialogue_density
        )

    @classmethod
    def route(cls, canonical: CanonicalEducationalInput) -> RoutingDecision:
        feats = cls.extract_features(canonical)

        audio_signal = 1.0 if feats.has_audio else 0.0
        ppt_signal = 1.0 if feats.has_ppt else 0.0
        dialogue_signal = min(1.0, feats.dialogue_interaction_density / 1.5)
        ped_marker_signal = min(1.0, feats.pedagogical_marker_density / 1.0)
        static_code_penalty = (feats.code_density * (1.0 - audio_signal))

        pdi = round(
            (0.50 * audio_signal) +
            (0.30 * ppt_signal) +
            (0.15 * dialogue_signal) +
            (0.05 * ped_marker_signal) -
            (0.30 * static_code_penalty),
            3
        )

        # 3-Way Production Decision Rule
        if feats.has_audio and feats.has_ppt:
            choice: RepresentationType = "UNIFIED"
            rationale = f"Multimodal Classroom (Audio + PPT/Code with PDI={pdi:.3f}): Requires Unified Synthesis of technical slide concepts (WHAT) and spoken teacher emphasis (WHY)."
        elif pdi >= 0.60:
            choice = "BLUEPRINT"
            rationale = f"High Pedagogical Delivery Index (PDI={pdi:.3f} >= 0.60): Strong live interactive teaching and emphasis signals detected without slides. Routed to Instructional Blueprint."
        else:
            choice = "SUMMARY"
            rationale = f"PDI={pdi:.3f} < 0.60: Material is predominantly static, code-dense, or monologue exposition. Routed to Technical Summary."

        return RoutingDecision(
            selected_representation=choice,
            pedagogical_delivery_index=pdi,
            rationale=rationale,
            features=feats
        )
