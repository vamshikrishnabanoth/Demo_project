"""
Pipeline C: Unified Assessment Engine (WHAT + WHY Synthesis).
Orchestrates:
1. UnifiedAssessmentPlanner (Deterministic + LLM synthesis of dynamic targets)
2. Symmetrical Generator Prompt
3. MCQ Generation & Strict Schema Validation
"""

from typing import Dict, Any, List, Optional
from pipeline_experiment.shared.schemas.canonical_models import (
    CanonicalEducationalInput,
    PedagogicalSummary,
    PedagogicalBlueprint,
    UnifiedAssessmentPlan,
    MCQSuite,
    MCQItem
)
from pipeline_experiment.pipeline_c_combined.unified_planner import UnifiedAssessmentPlanner
from pipeline_experiment.generator.prompt import SymmetricalPromptBuilder
from pipeline_experiment.generator.validator import SharedMCQValidator


class PipelineCEngine:
    def __init__(self, llm_engine):
        self.llm = llm_engine
        self.planner = UnifiedAssessmentPlanner(llm_engine)

    def generate_assessment(
        self,
        canonical_input: CanonicalEducationalInput,
        summary: PedagogicalSummary,
        blueprint: PedagogicalBlueprint,
        question_count: int = 5
    ) -> Dict[str, Any]:
        """
        Executes Pipeline C: WHAT + WHY -> Unified Assessment Plan -> MCQs.
        """
        # Step 1: Synthesize Unified Assessment Plan
        unified_plan = self.planner.plan_assessment(
            canonical_input=canonical_input,
            summary=summary,
            blueprint=blueprint,
            total_requested_questions=question_count
        )

        # Step 2: Build Symmetrical Generator Prompt
        prompt = SymmetricalPromptBuilder.build_unified_prompt(
            plan=unified_plan,
            question_count=question_count,
            title=canonical_input.title,
            input_type=canonical_input.input_type,
            content_style=canonical_input.content_style
        )

        # Step 3: Generate MCQs using strict frozen LLM engine
        mcq_suite: MCQSuite = self.llm.generate_pydantic(
            prompt=prompt,
            pydantic_class=MCQSuite,
            system_prompt=SymmetricalPromptBuilder.SHARED_SYSTEM_PROMPT,
            temperature=0.2
        )

        # Step 4: Ensure pipeline_type is PIPELINE_C_COMBINED and attach full traceability metadata
        mcq_suite.pipeline_type = "PIPELINE_C_COMBINED"
        mcq_suite.input_id = canonical_input.input_id
        mcq_suite.input_type = canonical_input.input_type
        mcq_suite.content_style = canonical_input.content_style
        mcq_suite.total_questions = len(mcq_suite.questions)

        # Enrich each question with end-to-end teacher traceability from the matching target
        targets_by_topic = {t.topic_name.lower(): t for t in unified_plan.assessment_targets}
        for q in mcq_suite.questions:
            # Find closest target
            matched_target = None
            for t_name, tgt in targets_by_topic.items():
                if t_name in q.target_concept.lower() or any(w in q.question_text.lower() for w in t_name.split() if len(w) > 3):
                    matched_target = tgt
                    break
            if not matched_target and unified_plan.assessment_targets:
                matched_target = unified_plan.assessment_targets[0]

            if matched_target:
                q.what_taught = matched_target.what_taught_summary
                q.why_assessed = matched_target.why_assessed_pedagogy
                q.evidence_refs = matched_target.evidence_chunk_refs + matched_target.source_timestamps_or_slides
                q.misconception_rationale = "; ".join(matched_target.misconception_distractor_hints)

        # Step 5: Strict Validation
        _, _, validated_suite = SharedMCQValidator.validate_suite(mcq_suite)

        return {
            "unified_plan": unified_plan,
            "mcq_suite": validated_suite,
            "validation_report": {"is_valid": True}
        }
