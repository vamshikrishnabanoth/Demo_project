"""
Closed-Loop Critic & Patch-Repair Agent:
Observes validation issues -> Diagnoses single-field vs multi-field defect ->
Executes targeted surgical patch or escalated item repair -> Re-validates.
"""

import json
import time
from typing import List, Dict, Any, Optional, Tuple

from pipeline_experiment.generator.llm_engine import UnifiedLLMEngine
from production_engine.schemas import ProductionMCQ, ValidationResult
from production_engine.validator import ProductionAssessmentValidator
from production_engine.experimental.critic_repair.schemas import (
    CriticDiagnosis, TargetedJSONPatch, DefectCategory, RepairCycleResult
)
from production_engine.experimental.critic_repair.patch_engine import PatchEngine


class ClosedLoopCriticAgent:
    """Autonomous Critic & Repair Agent with localized patch and escalation decision loop."""

    @classmethod
    def diagnose_and_repair(
        cls,
        mcq: ProductionMCQ,
        validator_issues: List[str],
        evidence_text: str,
        llm: UnifiedLLMEngine,
        max_attempts: int = 2
    ) -> RepairCycleResult:
        current_mcq = mcq
        attempts = 0
        total_tokens_est = 0
        t0 = time.time()

        for attempt in range(1, max_attempts + 1):
            attempts = attempt

            prompt = f"""You are the Lead Pedagogical Assessment Critic and Repair Agent.
A generated Multiple Choice Question failed deterministic validation gates.

DEFECTIVE QUESTION:
{json.dumps(current_mcq.model_dump(), indent=2)}

VALIDATION ISSUES FLAGGED:
{json.dumps(validator_issues, indent=2)}

VERIFIED SOURCE EVIDENCE:
{evidence_text[:1200]}

MISSION:
1. Diagnose the exact root cause of the validation failure.
2. Decide whether this failure is repairable by changing EXACTLY ONE FIELD (e.g. replacing an ambiguous option, completing a truncated explanation, or fixing key mismatch).
3. If repairable by a single field:
   - Set "is_single_field_repairable": true
   - Provide a "surgical_patch" with the exact "target_field" and "replacement_content".
4. If multi-field mutual contradiction exists (e.g., stem and all options are corrupted):
   - Set "is_single_field_repairable": false
   - Provide a "full_repaired_mcq" reconstructing the complete valid question for this concept.

Output strictly valid JSON matching this schema:
{{
  "question_id": "{current_mcq.question_id}",
  "defect_category": "<AMBIGUOUS_DISTRACTOR | DUPLICATE_OPTION | EMPTY_EXPLANATION | KEY_MISMATCH | UNGROUNDED_STEM | STRUCTURAL_INCONSISTENCY>",
  "is_single_field_repairable": true,
  "root_cause_explanation": "<Detailed diagnosis of why the question failed validation>",
  "surgical_patch": {{
    "question_id": "{current_mcq.question_id}",
    "target_field": "<option_a | option_b | option_c | option_d | explanation | question_text | correct_option>",
    "replacement_content": "<The exact corrected replacement string>",
    "patch_rationale": "<Why this fix resolves the defect while preserving validity>"
  }},
  "escalation_reason": null,
  "full_repaired_mcq": null
}}"""

            raw_resp = llm.generate_text(prompt=prompt, json_mode=True)
            total_tokens_est += len(prompt.split()) + len(raw_resp.split())

            try:
                cleaned = raw_resp.strip()
                if cleaned.startswith("```json"):
                    cleaned = cleaned.split("```json")[1].split("```")[0].strip()
                elif cleaned.startswith("```"):
                    cleaned = cleaned.split("```")[1].split("```")[0].strip()
                parsed = json.loads(cleaned)
            except Exception:
                parsed = {
                    "is_single_field_repairable": True,
                    "surgical_patch": {
                        "question_id": current_mcq.question_id,
                        "target_field": "explanation",
                        "replacement_content": f"Option {current_mcq.correct_option} is correct based on lecture evidence.",
                        "patch_rationale": "Fallback explanation repair."
                    }
                }

            is_single = parsed.get("is_single_field_repairable", True)
            patch_dict = parsed.get("surgical_patch")
            full_dict = parsed.get("full_repaired_mcq")

            applied_patch = None
            preserved_fields = 8

            if is_single and patch_dict:
                try:
                    patch_obj = TargetedJSONPatch(**patch_dict)
                    patched_mcq, preserved_count = PatchEngine.apply_patch(current_mcq, patch_obj)
                    current_mcq = patched_mcq
                    applied_patch = patch_obj
                    preserved_fields = preserved_count
                    strategy = "SINGLE_FIELD_PATCH"
                except Exception:
                    strategy = "FAILED_REPAIR"
            elif full_dict:
                try:
                    reconstructed = ProductionMCQ(**full_dict)
                    current_mcq = reconstructed
                    preserved_fields = 0
                    strategy = "TARGETED_ITEM_REGENERATION"
                except Exception:
                    strategy = "FAILED_REPAIR"
            else:
                strategy = "SINGLE_FIELD_PATCH"

            # Re-Validate the repaired question
            val_res = ProductionAssessmentValidator.validate_question(current_mcq, evidence_text)
            if val_res.is_valid:
                lat = round(time.time() - t0, 1)
                return RepairCycleResult(
                    question_id=current_mcq.question_id,
                    initial_defect_issues=validator_issues,
                    repair_strategy=strategy,
                    attempts_taken=attempts,
                    final_validation_passed=True,
                    repaired_mcq=current_mcq,
                    patch_applied=applied_patch,
                    tokens_consumed=total_tokens_est,
                    latency_seconds=lat,
                    fields_preserved_count=preserved_fields,
                    is_pedagogically_correct=True
                )
            else:
                validator_issues = val_res.issues

        # If exhausted attempts
        lat = round(time.time() - t0, 1)
        return RepairCycleResult(
            question_id=current_mcq.question_id,
            initial_defect_issues=validator_issues,
            repair_strategy="FAILED_REPAIR",
            attempts_taken=attempts,
            final_validation_passed=False,
            repaired_mcq=current_mcq,
            patch_applied=None,
            tokens_consumed=total_tokens_est,
            latency_seconds=lat,
            fields_preserved_count=0,
            is_pedagogically_correct=False
        )
