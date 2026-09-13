"""
Fixed Linear LLM Pipeline (Pipeline A Baseline for Experiment 10)

Key Characteristics:
- Fixed Representation: Always applies a generic summary prompt without dynamic PDI routing.
- Fixed Linear Planning: Slices input text into Q sequential segments without 12-facet cognitive expansion or evidence gating.
- Standard Generation: Uses the exact same underlying LLM model (e.g. openai/gpt-oss-20b) and temperature (0.2).
- Fixed Error Handling: Audits with deterministic validator; failing items are dropped without closed-loop critic repair or active replenishment.
"""

import time
from typing import Dict, Any, List, Optional, Tuple
from pydantic import BaseModel

from pipeline_experiment.generator.llm_engine import UnifiedLLMEngine
from pipeline_experiment.shared.schemas.canonical_models import CanonicalEducationalInput
from production_engine.schemas import ProductionMCQ, ProductionAssessmentSuite
from production_engine.validator import ProductionAssessmentValidator


class FixedLinearPlannerTarget(BaseModel):
    target_id: str
    concept_name: str
    chunk_text: str
    difficulty_level: str


class FixedLinearLLMPipeline:
    """
    Fixed Linear LLM Pipeline:
    Executes a rigid, linear sequence:
    Input -> Fixed Generic Summary -> Sequential Q Chunks -> Generate Q MCQs -> Validate & Drop Failing.
    """

    @staticmethod
    def generate_fixed_summary(canonical: CanonicalEducationalInput, llm: UnifiedLLMEngine) -> str:
        """Fixed generic summary prompt without PDI routing or blueprint synthesis."""
        content = (canonical.raw_content or "") + "\n" + (canonical.supporting_materials_text or "")
        prompt = (
            "Summarize the following educational content concisely into core topics and factual definitions.\n"
            "Content:\n" + content[:4000] + "\n\n"
            "Output a brief paragraph summarizing the key points."
        )
        resp = llm.generate_text(prompt)
        return resp

    @staticmethod
    def plan_fixed_linear_targets(
        canonical: CanonicalEducationalInput,
        requested_count: int,
        difficulty: str
    ) -> List[FixedLinearPlannerTarget]:
        """
        Fixed linear planning: Slices the content sequentially into Q equal segments.
        Does not perform 12-facet expansion or evidence-driven facet gating.
        """
        content = (canonical.raw_content or "") + "\n" + (canonical.supporting_materials_text or "")
        words = content.split()
        if not words:
            return []

        chunk_size = max(1, len(words) // requested_count)
        targets: List[FixedLinearPlannerTarget] = []

        for i in range(requested_count):
            start_idx = i * chunk_size
            end_idx = min(len(words), (i + 1) * chunk_size + (20 if i < requested_count - 1 else 0))
            chunk_slice = " ".join(words[start_idx:end_idx])
            concept_name = f"Topic Section {i+1}"
            targets.append(FixedLinearPlannerTarget(
                target_id=f"T{i+1:02d}",
                concept_name=concept_name,
                chunk_text=chunk_slice,
                difficulty_level=difficulty
            ))

        return targets

    @staticmethod
    def generate_mcq_for_target(
        target: FixedLinearPlannerTarget,
        canonical_title: str,
        llm: UnifiedLLMEngine
    ) -> Optional[ProductionMCQ]:
        """
        Generates 1 MCQ for the given target slice using standard LLM prompt.
        """
        prompt = (
            f"Generate a single 4-option multiple choice question (A, B, C, D) based strictly on the following excerpt from '{canonical_title}'.\n\n"
            f"Excerpt:\n{target.chunk_text[:1200]}\n\n"
            f"Difficulty Level: {target.difficulty_level}\n\n"
            "Return STRICT JSON conforming to this schema:\n"
            "{\n"
            '  "question_text": "Stem text...",\n'
            '  "option_a": "Option A text",\n'
            '  "option_b": "Option B text",\n'
            '  "option_c": "Option C text",\n'
            '  "option_d": "Option D text",\n'
            '  "correct_option": "A" or "B" or "C" or "D",\n'
            '  "explanation": "Detailed explanation...",\n'
            '  "target_concept": "' + target.concept_name + '"\n'
            "}"
        )

        try:
            import json
            resp_text = llm.generate_text(prompt)
            # Find json block
            raw_json = resp_text.strip()
            if "```json" in raw_json:
                raw_json = raw_json.split("```json")[1].split("```")[0].strip()
            elif "```" in raw_json:
                raw_json = raw_json.split("```")[1].split("```")[0].strip()

            data = json.loads(raw_json)
            return ProductionMCQ(
                question_id=f"Q_{target.target_id}",
                question_text=data.get("question_text", ""),
                option_a=data.get("option_a", ""),
                option_b=data.get("option_b", ""),
                option_c=data.get("option_c", ""),
                option_d=data.get("option_d", ""),
                correct_option=data.get("correct_option", "A").upper(),
                explanation=data.get("explanation", ""),
                target_concept=target.concept_name,
                cognitive_level="REMEMBER" if target.difficulty_level == "EASY" else "APPLY",
                difficulty_level=target.difficulty_level,
                what_taught=data.get("explanation", "")[:100],
                why_assessed="Fixed linear curriculum check",
                evidence_refs=[target.target_id],
                misconception_rationale="N/A"
            )
        except Exception as e:
            return None

    @classmethod
    def execute(
        cls,
        canonical: CanonicalEducationalInput,
        requested_count: int,
        difficulty: str,
        llm: UnifiedLLMEngine
    ) -> Tuple[ProductionAssessmentSuite, int, float, int, int]:
        """
        Executes the Fixed Linear LLM Pipeline.
        Returns: (suite, first_pass_valid_count, latency_sec, llm_calls_count, tokens_est)
        """
        start_time = time.time()
        llm_calls = 0

        # Step 1: Fixed generic summary
        summary = cls.generate_fixed_summary(canonical, llm)
        llm_calls += 1

        # Step 2: Fixed linear targets
        targets = cls.plan_fixed_linear_targets(canonical, requested_count, difficulty)

        # Step 3: Sequential generation
        raw_questions: List[ProductionMCQ] = []
        for t in targets:
            q = cls.generate_mcq_for_target(t, canonical.title, llm)
            llm_calls += 1
            if q:
                raw_questions.append(q)

        # Step 4: Deterministic Validation & Drop failing (No Critic Repair, No Replenishment)
        raw_evidence = (canonical.raw_content or "") + "\n" + (canonical.supporting_materials_text or "")
        first_pass_valid: List[ProductionMCQ] = []
        for q in raw_questions:
            res = ProductionAssessmentValidator.validate_question(q, raw_evidence)
            if res.is_valid:
                first_pass_valid.append(q)

        latency = round(time.time() - start_time, 2)
        tokens_est = int(latency * 35) + len(raw_questions) * 320

        suite = ProductionAssessmentSuite(
            input_id=canonical.input_id,
            title=canonical.title,
            representation_used="SUMMARY",
            routing_rationale="Fixed Linear Baseline (No dynamic routing or adaptive planning)",
            requested_count=requested_count,
            requested_difficulty=difficulty,
            defensible_capacity=len(first_pass_valid),
            final_question_count=len(first_pass_valid),
            questions=first_pass_valid,
            validation_status="PASSED" if len(first_pass_valid) >= requested_count else "PARTIAL",
            generation_metadata={
                "pipeline": "FIXED_LINEAR_LLM",
                "total_latency_seconds": latency,
                "measured_llm_calls": llm_calls,
                "first_pass_valid_count": len(first_pass_valid)
            }
        )

        return suite, len(first_pass_valid), latency, llm_calls, tokens_est
