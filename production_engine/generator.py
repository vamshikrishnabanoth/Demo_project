"""
Production Cognitive Fidelity MCQ Generator.
Generates teacher-grounded MCQs strictly conforming to the ProductionAssessmentPlan targets,
embedding plausible student misconception distractors and full teacher traceability.
"""

import json
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

from pipeline_experiment.generator.llm_engine import UnifiedLLMEngine
from pipeline_experiment.shared.schemas.canonical_models import CanonicalEducationalInput
from production_engine.schemas import ProductionAssessmentPlan, ProductionMCQ
from production_engine.retrieval.evidence_retriever import RetrievedEvidence


class RawMCQListOutput(BaseModel):
    questions: List[ProductionMCQ]


class ProductionMCQGenerator:
    """Generates validated, misconception-grounded MCQs from an Assessment Plan & Retrieved Evidence."""

    @classmethod
    def generate_questions(
        cls,
        canonical: CanonicalEducationalInput,
        plan: ProductionAssessmentPlan,
        llm: UnifiedLLMEngine,
        retrieved_evidence_map: Optional[Dict[str, RetrievedEvidence]] = None
    ) -> List[ProductionMCQ]:
        system_prompt = (
            "You are an Expert University Professor and Assessment Item Writer. "
            "Your task is to write high-fidelity, teacher-grounded Multiple Choice Questions (MCQs) "
            "based strictly on the approved Assessment Plan and Retrieved Target Evidence.\n\n"
            "MANDATORY QUALITY RULES:\n"
            "1. CLASSROOM AUTHENTICITY: Frame stems and scenarios around the specific examples, decision rules, and problem-solving "
            "trade-offs the teacher discussed in class (e.g. why we search the smaller array, what happens when bounds are exceeded, "
            "tracing specific array splits, how sentinels work) rather than generic textbook boilerplate.\n"
            "2. NO GENERIC DISTRACTORS: Every incorrect option must represent a plausible student misconception, "
            "common coding bug (e.g. off-by-one, integer division error, internal vs cross-array comparison), or incorrect formula calculation.\n"
            "3. UNAMBIGUOUS SINGLE KEY: Exactly one option (A, B, C, or D) must be fully correct and supported by evidence.\n"
            "4. EXPLANATION INTEGRITY: The explanation must explicitly prove the correct option and refute each distractor.\n"
            "5. TRACEABILITY RECORD: Every question must contain: what_taught, why_assessed, evidence_refs, and misconception_rationale."
        )

        all_questions: List[ProductionMCQ] = []
        batch_size = 2

        for b_start in range(0, len(plan.targets), batch_size):
            batch_targets = plan.targets[b_start:b_start + batch_size]
            targets_payload = []

            for idx, t in enumerate(batch_targets):
                abs_idx = b_start + idx + 1
                ev = retrieved_evidence_map.get(t.target_id) if retrieved_evidence_map else None
                ev_text = ev.retrieved_content[:300] if ev else ""
                ev_refs = ev.evidence_ids if ev else t.evidence_refs

                targets_payload.append({
                    "target_id": t.target_id or f"TGT_{abs_idx:02d}",
                    "concept": t.concept_name,
                    "what_taught": t.what_taught,
                    "why_assessed": t.why_assessed,
                    "cognitive_level": t.cognitive_level,
                    "misconceptions_to_target": t.plausible_misconceptions,
                    "evidence_refs": ev_refs,
                    "retrieved_evidence_excerpt": ev_text
                })

            prompt_body = (
                f"INPUT TITLE: {canonical.title}\n"
                f"REPRESENTATION USED: {plan.representation_used}\n"
                f"TARGET COUNT FOR THIS BATCH: {len(batch_targets)}\n\n"
                f"--- ASSESSMENT TARGETS & RETRIEVED EVIDENCE (RAG) ---\n"
                f"{json.dumps(targets_payload, indent=2)}\n\n"
                f"INSTRUCTION:\n"
                f"Generate exactly {len(batch_targets)} MCQs (one per target). "
                f"Output strictly valid JSON matching RawMCQListOutput schema."
            )

            raw_output: RawMCQListOutput = llm.generate_pydantic(
                prompt=prompt_body,
                system_prompt=system_prompt,
                pydantic_class=RawMCQListOutput
            )

            if raw_output and raw_output.questions:
                for q_idx, q in enumerate(raw_output.questions):
                    matched_target = batch_targets[q_idx] if q_idx < len(batch_targets) else batch_targets[-1]
                    if not q.target_concept:
                        q.target_concept = matched_target.concept_name
                    if not q.what_taught:
                        q.what_taught = matched_target.what_taught
                    if not q.why_assessed:
                        q.why_assessed = matched_target.why_assessed
                    if not q.cognitive_level or q.cognitive_level == "UNDERSTAND":
                        q.cognitive_level = matched_target.cognitive_level
                    if not q.evidence_refs:
                        ev = retrieved_evidence_map.get(matched_target.target_id) if retrieved_evidence_map else None
                        q.evidence_refs = ev.evidence_ids if ev else matched_target.evidence_refs
                    if not q.misconception_rationale and matched_target.plausible_misconceptions:
                        q.misconception_rationale = f"Distractors target: {', '.join(matched_target.plausible_misconceptions)}"
                all_questions.extend(raw_output.questions)

        return all_questions
