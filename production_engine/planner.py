"""
Production Unified Assessment Planner.
Estimates content capacity, allocates non-overlapping targets, and aligns cognitive levels
in a single unified stage combining deterministic logic and one semantic LLM call.
"""

import json
import re
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

from pipeline_experiment.generator.llm_engine import UnifiedLLMEngine
from pipeline_experiment.shared.schemas.canonical_models import (
    CanonicalEducationalInput, PedagogicalSummary, PedagogicalBlueprint
)
from production_engine.schemas import (
    ProductionAssessmentPlan, AssessmentTarget, RepresentationType, BloomsLevel
)


class RawPlannerOutput(BaseModel):
    maximum_defensible_capacity: int = Field(description="Max distinct, high-value questions this content genuinely supports")
    capacity_rationale: str = Field(description="Explanation of capacity based on distinct concept density")
    targets: List[AssessmentTarget]


class ProductionAssessmentPlanner:
    """Unified Assessment Planner with Capacity Estimation & Deduplication."""

    @classmethod
    def estimate_deterministic_capacity(
        cls,
        canonical: CanonicalEducationalInput,
        representation_type: RepresentationType,
        summary: Optional[PedagogicalSummary] = None,
        blueprint: Optional[PedagogicalBlueprint] = None
    ) -> int:
        """Deterministic baseline estimation of distinct concept capacity based on density and length."""
        words = len(canonical.raw_content.split())
        if words < 500:
            word_cap = 1
        elif words < 1500:
            word_cap = 3
        elif words < 4000:
            word_cap = 8
        elif words < 8000:
            word_cap = 15
        else:
            word_cap = 25

        if representation_type == "SUMMARY" and summary:
            distinct_concepts = len(summary.concepts_and_definitions) + len(summary.mechanisms_and_formulas)
            return max(1, min(word_cap, max(distinct_concepts, 15 if words > 6000 else distinct_concepts)))
        elif representation_type == "BLUEPRINT" and blueprint:
            return max(1, min(word_cap, max(len(blueprint.topics), 15 if words > 6000 else len(blueprint.topics))))
        elif representation_type == "UNIFIED" and summary and blueprint:
            combined = len(blueprint.topics) + len(summary.mechanisms_and_formulas)
            return max(1, min(word_cap, max(combined, 20 if words > 6000 else combined)))
        
        return word_cap

    @classmethod
    def plan_assessment(
        cls,
        canonical: CanonicalEducationalInput,
        representation_type: RepresentationType,
        requested_count: int,
        llm: UnifiedLLMEngine,
        summary: Optional[PedagogicalSummary] = None,
        blueprint: Optional[PedagogicalBlueprint] = None,
        difficulty: str = "MIXED"
    ) -> ProductionAssessmentPlan:
        # 1. Deterministic capacity bound
        det_capacity = cls.estimate_deterministic_capacity(canonical, representation_type, summary, blueprint)
        target_allocation = min(requested_count, det_capacity)

        # 2. Difficulty Guidance Matrix based on Instructional Depth
        diff_upper = difficulty.upper()
        if diff_upper == "EASY":
            difficulty_guidance = (
                "REQUESTED DIFFICULTY: EASY (Recall / Direct Recognition / Basic Understanding)\n"
                "- TARGET CALIBRATION: Focus strictly on concepts that were directly introduced, mentioned, or defined as standard facts/terms.\n"
                "- COGNITIVE DEMAND: REMEMBER or basic UNDERSTAND.\n"
                "- SCOPE: Dataset names, core block diagram terms (Encoder, Bottleneck, Decoder), basic role definitions, direct parameter numbers explicitly stated.\n"
                "- AVOID: Multi-step derivations, complex code debugging, or deep trade-off analysis."
            )
        elif diff_upper == "MEDIUM":
            difficulty_guidance = (
                "REQUESTED DIFFICULTY: MEDIUM (Procedural Execution / Code Application / Core Rationale)\n"
                "- TARGET CALIBRATION: Focus on concepts that were actively explained, demonstrated, or coded step-by-step in the lecture.\n"
                "- COGNITIVE DEMAND: UNDERSTAND or APPLY.\n"
                "- SCOPE: Code layer configurations, layer symmetry rules, normalization ranges, choice of activation functions (e.g. sigmoid vs softmax for reconstruction), loss function selection (MSE) and self-target training.\n"
                "- AVOID: Pure surface trivia or overly abstract theoretical edge-cases."
            )
        elif diff_upper == "HARD":
            difficulty_guidance = (
                "REQUESTED DIFFICULTY: HARD (Comparative Analysis / Architectural Failure Modes / Multi-Step Evaluation)\n"
                "- TARGET CALIBRATION: Focus on concepts where the teacher engaged in deep comparison, debugging, failure mode analysis, or architectural trade-offs.\n"
                "- COGNITIVE DEMAND: APPLY, ANALYZE, or EVALUATE.\n"
                "- SCOPE: Explaining WHY flattening destroys 2D spatial locality and causes blurriness, evaluating the compression vs clarity trade-off when tuning bottleneck capacity, analyzing why Conv2D + MaxPooling downsampling/upsampling preserves spatial hierarchies, comparing FC-AE vs CAE loss curves and texture fidelity.\n"
                "- AVOID: Simple recall questions, terminology recognition, or superficial syntax."
            )
        else:
            difficulty_guidance = (
                "REQUESTED DIFFICULTY: MIXED (Balanced Assessment Spectrum)\n"
                "- Provide a balanced spread across Bloom's levels (30% Understand, 40% Apply, 30% Analyze)."
            )

        # 3. Build single focused planning prompt
        system_prompt = (
            "You are a Senior University Curriculum and Assessment Designer creating a quiz that strictly reflects "
            "HOW and WHAT THIS SPECIFIC INSTRUCTOR TAUGHT in today's classroom.\n\n"
            "MANDATORY TARGET SELECTION & RANKING PRINCIPLES:\n"
            "1. INSTRUCTIONAL SALIENCE OVER BOILERPLATE: Prioritize concepts where the teacher spent significant dwell time, "
            "repeatedly emphasized core principles, worked through concrete traces/examples with students, or warned about common mistakes.\n"
            "2. DIFFICULTY CALIBRATION TO INSTRUCTIONAL DEPTH: Adhere strictly to the requested difficulty tier.\n"
            f"{difficulty_guidance}\n"
            "3. NO REDUNDANT ASSESSMENT: Ensure no redundant assessment of the same learning target. Each target must assess a "
            "distinct pedagogical objective.\n"
            "4. TEACHER-WARNED MISCONCEPTIONS: Distractors must specifically reflect the misunderstandings, off-by-one errors, and "
            "fallacies the teacher explicitly discussed or that students typically exhibit."
        )

        prompt_body = (
            f"INPUT ID: {canonical.input_id}\n"
            f"TITLE: {canonical.title}\n"
            f"MODALITY: {canonical.input_type}\n"
            f"REQUESTED QUESTIONS: {requested_count}\n"
            f"DIFFICULTY TIER: {diff_upper}\n"
        )

        if representation_type == "SUMMARY" and summary:
            prompt_body += f"\n--- TECHNICAL SUMMARY (WHAT WAS TAUGHT) ---\n"
            prompt_body += f"Concepts: {json.dumps(summary.concepts_and_definitions)}\n"
            prompt_body += f"Formulas/Mechanisms: {json.dumps(summary.mechanisms_and_formulas)}\n"
            prompt_body += f"Code Patterns: {json.dumps(summary.examples_and_code_patterns)}\n"
            prompt_body += f"Summary: {summary.factual_summary_text[:2000]}\n"

        elif representation_type == "BLUEPRINT" and blueprint:
            prompt_body += f"\n--- INSTRUCTIONAL BLUEPRINT (WHY & HOW IT WAS TAUGHT) ---\n"
            bp_topics = [{
                "topic": t.topic,
                "salience": t.salience_score,
                "acts": t.instructional_acts,
                "bloom": t.target_bloom_level,
                "mode": t.dominant_mode,
                "evidence_refs": t.evidence_refs
            } for t in blueprint.topics]
            prompt_body += f"Topics & Pedagogical Intent: {json.dumps(bp_topics, indent=2)}\n"

        elif representation_type == "UNIFIED" and summary and blueprint:
            prompt_body += f"\n--- UNIFIED REPRESENTATION (WHAT + WHY) ---\n"
            prompt_body += f"Technical Summary Concepts: {json.dumps(summary.concepts_and_definitions)}\n"
            prompt_body += f"Technical Formulas: {json.dumps(summary.mechanisms_and_formulas)}\n"
            bp_topics = [{
                "topic": t.topic,
                "salience": t.salience_score,
                "acts": t.instructional_acts,
                "bloom": t.target_bloom_level,
                "mode": t.dominant_mode,
                "evidence_refs": t.evidence_refs
            } for t in blueprint.topics]
            prompt_body += f"Pedagogical Blueprint: {json.dumps(bp_topics, indent=2)}\n"

        prompt_body += (
            f"\nINSTRUCTION:\n"
            f"Generate up to {target_allocation} prioritized assessment targets strictly calibrated to the '{diff_upper}' difficulty level.\n"
            f"Ensure no redundant assessment of the same learning target.\n"
            f"Output strictly valid JSON matching RawPlannerOutput schema."
        )

        raw_output: RawPlannerOutput = llm.generate_pydantic(
            prompt=prompt_body,
            system_prompt=system_prompt,
            pydantic_class=RawPlannerOutput
        )

        # 4. Target List Extraction & Difficulty Assignment
        final_targets = raw_output.targets[:requested_count]
        for t in final_targets:
            if diff_upper in ["EASY", "MEDIUM", "HARD"]:
                t.difficulty_level = diff_upper

        return ProductionAssessmentPlan(
            input_id=canonical.input_id,
            representation_used=representation_type,
            requested_question_count=requested_count,
            requested_difficulty=diff_upper if diff_upper in ["EASY", "MEDIUM", "HARD"] else "MIXED",
            maximum_defensible_capacity=len(final_targets),
            allocated_question_count=len(final_targets),
            targets=final_targets
        )
