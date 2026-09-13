"""
Pipeline B: Layer 4 Assessment Slot Builder.
Instantiates discrete AssessmentSlots defining what to assess and target student misconceptions without writing the question text.
"""

from typing import List
from pydantic import BaseModel, Field
from pipeline_experiment.shared.schemas.canonical_models import (
    CanonicalEducationalInput,
    PedagogicalBlueprint,
    AssessmentPlan,
    AssessmentSlot
)


class SlotBatch(BaseModel):
    slots: List[AssessmentSlot] = Field(description="Discrete assessment slots matching question allocation")


class AssessmentSlotBuilder:
    def __init__(self, llm_engine):
        self.llm = llm_engine

    def build_slots(
        self,
        canonical_input: CanonicalEducationalInput,
        blueprint: PedagogicalBlueprint,
        plan: AssessmentPlan
    ) -> List[AssessmentSlot]:
        """
        Creates actionable AssessmentSlot specifications for the MCQ Generator.
        """
        system_prompt = (
            "You are an assessment slot designer.\n"
            "For each allocated question in the Assessment Plan, generate a discrete AssessmentSlot defining:\n"
            "- assessment_goal (Specific conceptual/applied outcome to test)\n"
            "- misconception_target (Specific error/flaw in student reasoning to test in distractors)\n"
            "- question_type (e.g. NUMERICAL_SCENARIO, CODE_DEBUG_SCENARIO, CONCEPTUAL_SCENARIO)\n"
            "Do NOT write the question itself; define what must be assessed."
        )

        plan_summary = []
        topic_map = {t.topic_id: t for t in blueprint.topics}
        for alloc in plan.allocations:
            if alloc.question_count > 0:
                t = topic_map.get(alloc.topic_id)
                plan_summary.append(
                    f"Topic [{alloc.topic_id}] {alloc.topic_name} (Questions: {alloc.question_count})\n"
                    f"- Dominant Mode: {t.dominant_mode if t else 'CONCEPTUAL'}\n"
                    f"- Target Bloom: {t.target_bloom_level if t else 'UNDERSTAND'}\n"
                    f"- Acts: {', '.join(t.instructional_acts) if t else 'EXPLAIN'}\n"
                    f"- Prerequisites: {', '.join(t.prerequisite_concepts) if t else 'None'}\n"
                    f"- Evidence Refs: {', '.join(t.evidence_refs) if t else 'None'}"
                )

        prompt = (
            f"Title: {canonical_input.title}\n"
            f"Input Type: {canonical_input.input_type} | Content Style: {canonical_input.content_style}\n"
            f"Total Slots Required: {plan.total_questions}\n\n"
            f"--- [ASSESSMENT PLAN & BLUEPRINT TOPICS] ---\n"
            + "\n\n".join(plan_summary)
            + "\n\n"
            f"Task: Generate exactly {plan.total_questions} AssessmentSlots matching the allocated counts per topic.\n"
            "Ensure slot_id is sequentially numbered (S01, S02, S03...)."
        )

        result = self.llm.generate_pydantic(
            prompt=prompt,
            pydantic_class=SlotBatch,
            system_prompt=system_prompt,
            temperature=0.2
        )
        return result.slots
