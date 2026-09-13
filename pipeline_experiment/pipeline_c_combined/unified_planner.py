"""
Pipeline C: Unified Assessment Planner (WHAT + WHY Synthesis).
Fuses Technical Summary (WHAT) and Instructional Blueprint (WHY) into dynamic, content-driven assessment targets.
- Deterministic Responsibilities:
  1. Topic & concept matching
  2. Source reference & chunk timestamp attachment
  3. Technical definition & formula retrieval from summary
  4. Dynamic quota allocation of N questions across K targets based on Blueprint salience
- LLM Responsibilities:
  1. Synthesizing WHAT + WHY into focused target descriptions
  2. Formulating distractor misconception hints
"""

from typing import List, Dict, Any, Optional
import math
from pydantic import BaseModel, Field
from pipeline_experiment.shared.schemas.canonical_models import (
    CanonicalEducationalInput,
    PedagogicalSummary,
    PedagogicalBlueprint,
    UnifiedAssessmentTarget,
    UnifiedAssessmentPlan,
    BloomsLevel
)


class TargetSynthesisItem(BaseModel):
    topic_id: str
    target_bloom_level: BloomsLevel = "UNDERSTAND"
    what_taught_summary: str = Field(description="Synthesized summary of technical knowledge to be tested")
    why_assessed_pedagogy: str = Field(description="Explanation of why this target is important from teacher instruction")
    misconception_distractor_hints: List[str] = Field(description="2-3 plausible misunderstandings for distractors")


class TargetSynthesisBatch(BaseModel):
    targets: List[TargetSynthesisItem]


class UnifiedAssessmentPlanner:
    def __init__(self, llm_engine):
        self.llm = llm_engine

    def plan_assessment(
        self,
        canonical_input: CanonicalEducationalInput,
        summary: PedagogicalSummary,
        blueprint: PedagogicalBlueprint,
        total_requested_questions: int = 5
    ) -> UnifiedAssessmentPlan:
        """
        Synthesizes Summary (WHAT) and Blueprint (WHY) into dynamic assessment targets.
        """
        # --- 1. DETERMINISTIC: Extract candidate targets from Blueprint ---
        bp_topics = blueprint.topics
        if not bp_topics:
            raise ValueError("Blueprint contains no topics to assess.")

        # --- 2. DETERMINISTIC: Dynamic Question Allocation across K topics based on salience ---
        total_salience = sum(t.salience_score for t in bp_topics) or 1.0
        
        # Raw fractional allocations
        raw_allocations = [
            max(1, round((t.salience_score / total_salience) * total_requested_questions))
            for t in bp_topics
        ]
        
        # Adjust sum to match exactly total_requested_questions
        current_sum = sum(raw_allocations)
        diff = total_requested_questions - current_sum
        if diff != 0:
            # Sort topic indices by salience
            sorted_indices = sorted(range(len(bp_topics)), key=lambda i: bp_topics[i].salience_score, reverse=True)
            for idx in sorted_indices:
                if diff == 0:
                    break
                if diff > 0:
                    raw_allocations[idx] += 1
                    diff -= 1
                elif diff < 0 and raw_allocations[idx] > 1:
                    raw_allocations[idx] -= 1
                    diff += 1

        # --- 3. DETERMINISTIC: Match Summary technical concepts & chunks to each topic ---
        matched_context_blocks = []
        for i, t in enumerate(bp_topics):
            # Collect matching chunk texts and timestamps
            ev_refs = getattr(t, "evidence_refs", []) or getattr(t, "associated_chunk_ids", [])
            matched_chunks = [
                c for c in canonical_input.chunks
                if c.chunk_id in ev_refs or f"E_{c.chunk_id}" in ev_refs or any(c.chunk_id in ref for ref in ev_refs)
            ]
            if not matched_chunks:
                matched_chunks = canonical_input.chunks[:3]

            chunk_timestamps = []
            for c in matched_chunks:
                if c.time_spans:
                    chunk_timestamps.append(f"[{c.time_spans[0].start:.1f}s - {c.time_spans[-1].end:.1f}s]")
                else:
                    chunk_timestamps.append(f"[{c.chunk_id}]")

            slide_refs = []
            for c in matched_chunks:
                slide_refs.extend(c.evidence.source_refs)
                slide_refs.extend(c.material_refs)
            slide_refs = list(dict.fromkeys(slide_refs))

            # Retrieve technical keywords from summary matching topic
            t_words = set(t.topic.lower().split())
            matching_defs = [
                d for d in summary.concepts_and_definitions
                if any(w in d.lower() for w in t_words if len(w) > 3)
            ]
            matching_formulas = [
                f for f in summary.mechanisms_and_formulas
                if any(w in f.lower() for w in t_words if len(w) > 3)
            ]
            matching_code = [
                ex for ex in summary.examples_and_code_patterns
                if any(w in ex.lower() for w in t_words if len(w) > 3)
            ]

            matched_context_blocks.append({
                "topic_id": t.topic_id,
                "topic_name": t.topic,
                "salience": t.salience_score,
                "blueprint_bloom": t.target_bloom_level,
                "blueprint_acts": t.instructional_acts,
                "dominant_mode": t.dominant_mode,
                "allocated_count": raw_allocations[i],
                "chunk_refs": ev_refs,
                "timestamps": chunk_timestamps[:3],
                "slide_refs": slide_refs[:3],
                "summary_defs": matching_defs or summary.concepts_and_definitions[:2],
                "summary_formulas": matching_formulas or summary.mechanisms_and_formulas[:1],
                "summary_code": matching_code or summary.examples_and_code_patterns[:1]
            })

        # --- 4. LLM: Semantic Synthesis of WHAT + WHY into compact Assessment Targets ---
        prompt_blocks = []
        for b in matched_context_blocks:
            prompt_blocks.append(
                f"Topic [{b['topic_id']}]: {b['topic_name']}\n"
                f"- Blueprint Target Bloom: {b['blueprint_bloom']} | Acts: {', '.join(b['blueprint_acts'])}\n"
                f"- Dominant Mode: {b['dominant_mode']} (Salience: {b['salience']:.2f})\n"
                f"- Available Technical Knowledge:\n"
                f"  * Definitions: {' | '.join(b['summary_defs'][:2])}\n"
                f"  * Formulas/Mechanisms: {' | '.join(b['summary_formulas'][:2])}\n"
                f"  * Code/Examples: {' | '.join(b['summary_code'][:2])}"
            )

        prompt = (
            f"Educational Title: {canonical_input.title}\n"
            f"Input Type: {canonical_input.input_type} | Content Style: {canonical_input.content_style}\n\n"
            f"Task: Synthesize the WHAT (technical content from Summary) and the WHY (pedagogical focus from Blueprint) "
            f"for each of the {len(matched_context_blocks)} topics.\n\n"
            + "\n\n".join(prompt_blocks) + "\n\n"
            "Return a TargetSynthesisBatch containing for each topic:\n"
            "- topic_id (matching the input ID)\n"
            "- target_bloom_level (REMEMBER, UNDERSTAND, APPLY, ANALYZE, or EVALUATE)\n"
            "- what_taught_summary (1-2 sentences stating the exact technical formula, syntax, or mechanism)\n"
            "- why_assessed_pedagogy (1 sentence stating why the teacher spent time on this / pedagogical objective)\n"
            "- misconception_distractor_hints (2-3 realistic student errors or wrong assumptions for distractors)"
        )

        system_prompt = (
            "You are an expert pedagogical assessment designer.\n"
            "Your task is to combine technical accuracy (WHAT) with instructional intent (WHY) "
            "into clear assessment target specifications."
        )

        llm_synthesis: TargetSynthesisBatch = self.llm.generate_pydantic(
            prompt=prompt,
            pydantic_class=TargetSynthesisBatch,
            system_prompt=system_prompt,
            temperature=0.2
        )

        # Build lookup for synthesized items
        synth_map = {item.topic_id: item for item in llm_synthesis.targets}

        # --- 5. DETERMINISTIC: Assemble final UnifiedAssessmentPlan ---
        unified_targets = []
        for i, b in enumerate(matched_context_blocks):
            t_id = b["topic_id"]
            synth = synth_map.get(t_id)

            what_text = synth.what_taught_summary if synth else "; ".join(b["summary_defs"][:2])
            why_text = synth.why_assessed_pedagogy if synth else f"Teacher emphasized {b['topic_name']} with salience {b['salience']:.2f}"
            bloom = synth.target_bloom_level if synth else b["blueprint_bloom"]
            hints = synth.misconception_distractor_hints if synth else ["Confusing core concept with related subtopic"]

            unified_targets.append(
                UnifiedAssessmentTarget(
                    target_id=f"TGT_{i+1:02d}",
                    topic_name=b["topic_name"],
                    what_taught_summary=what_text,
                    why_assessed_pedagogy=why_text,
                    target_bloom_level=bloom,
                    misconception_distractor_hints=hints,
                    allocated_question_count=b["allocated_count"],
                    evidence_chunk_refs=b["chunk_refs"],
                    source_timestamps_or_slides=b["timestamps"] + b["slide_refs"]
                )
            )

        return UnifiedAssessmentPlan(
            input_id=canonical_input.input_id,
            title=canonical_input.title,
            total_requested_questions=total_requested_questions,
            total_available_targets=len(unified_targets),
            assessment_targets=unified_targets
        )
