"""
Evidence-Aware Adaptive Assessment Planning Agent:
Maximizes fulfillment of requested question count (Q=10) across diverse cognitive facets
without hallucination, leveraging Hierarchical Parent Context and Cross-Material Links.
"""

import json
import re
from typing import List, Dict, Any, Optional

from pipeline_experiment.shared.schemas.canonical_models import (
    CanonicalEducationalInput, PedagogicalSummary, PedagogicalBlueprint
)
from pipeline_experiment.generator.llm_engine import UnifiedLLMEngine
from production_engine.schemas import AssessmentTarget
from production_engine.experimental.planning_agent.schemas import (
    AdaptiveAssessmentTarget, AdaptiveAssessmentPlan, AssessmentFacetType
)
from production_engine.experimental.hierarchical_rag.schemas import HierarchicalEvidenceStore
from production_engine.experimental.cross_modal.cross_material_aligner import CrossMaterialAligner


class AdaptivePlanningAgent:
    """Intelligently expands assessment targets across legitimate pedagogical facets to satisfy Q_req."""

    FACET_POOL: List[AssessmentFacetType] = [
        "CONCEPT_UNDERSTANDING",
        "THEORETICAL_RATIONALE",
        "CODE_INTERPRETATION",
        "OUTPUT_PREDICTION",
        "ERROR_DIAGNOSIS",
        "BOUNDARY_EDGE_CASE",
        "PARAMETER_CHANGE",
        "COMPLEXITY_ANALYSIS",
        "ARCHITECTURAL_COMPARISON",
        "PRACTICAL_APPLICATION",
        "OFF_BY_ONE_ANALYSIS",
        "MISCONCEPTION_TARGETING"
    ]

    @classmethod
    def plan_assessment(
        cls,
        canonical: CanonicalEducationalInput,
        hier_store: HierarchicalEvidenceStore,
        alignment_graph: Dict[str, List[str]],
        requested_count: int,
        requested_difficulty: str,
        llm: UnifiedLLMEngine,
        summary: Optional[PedagogicalSummary] = None,
        blueprint: Optional[PedagogicalBlueprint] = None,
        representation_type: str = "BLUEPRINT"
    ) -> AdaptiveAssessmentPlan:
        
        # 1. Gather Available Concept Evidence Base
        META_STOPLIST = {
            "overview", "introduction", "intro", "agenda", "summary", 
            "lecture plan", "study plan", "study tips", "course logistics", 
            "wrap up", "conclusion", "exam tips", "administrative", "lecture segment", "core methodology"
        }

        raw_candidates = []
        if representation_type == "UNIFIED":
            # Multimodal Fusion: Fuse teacher emphasis/pedagogical acts (WHY) from Blueprint 
            # with technical definitions and mechanisms/formulas (WHAT) from Summary
            if blueprint and blueprint.topics:
                for b in blueprint.topics:
                    raw_candidates.append({
                        "concept": b.topic,
                        "what": f"Instructional act: {', '.join(b.instructional_acts)} | Dominant mode: {b.dominant_mode}",
                        "why": f"Teacher specificity: {b.teacher_specificity} (Salience {b.salience_score:.2f})",
                        "evidence_refs": b.evidence_refs
                    })
            if summary:
                for c in summary.concepts_and_definitions:
                    raw_candidates.append({
                        "concept": c,
                        "what": c,
                        "why": "Core curriculum definition",
                        "evidence_refs": []
                    })
                for m in summary.mechanisms_and_formulas:
                    raw_candidates.append({
                        "concept": m,
                        "what": m,
                        "why": "Mathematical / algorithmic mechanism",
                        "evidence_refs": []
                    })
        elif representation_type == "SUMMARY":
            if summary:
                for c in summary.concepts_and_definitions:
                    raw_candidates.append({
                        "concept": c,
                        "what": c,
                        "why": "Core curriculum definition",
                        "evidence_refs": []
                    })
                for m in summary.mechanisms_and_formulas:
                    raw_candidates.append({
                        "concept": m,
                        "what": m,
                        "why": "Mathematical / algorithmic mechanism",
                        "evidence_refs": []
                    })
            elif blueprint and blueprint.topics:
                for b in blueprint.topics:
                    raw_candidates.append({
                        "concept": b.topic,
                        "what": f"Instructional act: {', '.join(b.instructional_acts)} | Dominant mode: {b.dominant_mode}",
                        "why": f"Teacher specificity: {b.teacher_specificity} (Salience {b.salience_score:.2f})",
                        "evidence_refs": b.evidence_refs
                    })
        else: # Default or BLUEPRINT
            if blueprint and blueprint.topics:
                for b in blueprint.topics:
                    raw_candidates.append({
                        "concept": b.topic,
                        "what": f"Instructional act: {', '.join(b.instructional_acts)} | Dominant mode: {b.dominant_mode}",
                        "why": f"Teacher specificity: {b.teacher_specificity} (Salience {b.salience_score:.2f})",
                        "evidence_refs": b.evidence_refs
                    })
            elif summary:
                for c in summary.concepts_and_definitions:
                    raw_candidates.append({
                        "concept": c,
                        "what": c,
                        "why": "Core curriculum definition",
                        "evidence_refs": []
                    })
                for m in summary.mechanisms_and_formulas:
                    raw_candidates.append({
                        "concept": m,
                        "what": m,
                        "why": "Mathematical / algorithmic mechanism",
                        "evidence_refs": []
                    })

        concept_candidates = []
        for cand in raw_candidates:
            c_norm = cand["concept"].strip().lower()
            if c_norm not in META_STOPLIST and not any(c_norm.startswith(m) for m in ["overview", "intro", "study plan"]):
                concept_candidates.append(cand)

        # Fallback to hierarchical parents if concept candidates are sparse
        if len(concept_candidates) < 3 and hier_store.parents:
            for p in hier_store.parents:
                p_title = p.title.strip()
                p_norm = p_title.lower()
                if p_norm not in META_STOPLIST and not any(p_norm.startswith(m) for m in ["overview", "intro", "lecture segment"]):
                    concept_candidates.append({
                        "concept": p_title,
                        "what": p.full_text[:250],
                        "why": "Curricular technical topic",
                        "evidence_refs": p.child_ids
                    })

        if not concept_candidates:
            # Last resort: extract from raw title or first parent text without generic overview label
            fallback_title = canonical.title if canonical.title.lower() not in META_STOPLIST else "Curricular Mechanics"
            concept_candidates = [{"concept": fallback_title, "what": canonical.title, "why": "Curricular topic", "evidence_refs": []}]

        # 2. Build Multi-Angle Facet Prompt for LLM Agent
        prompt = f"""You are the Lead Pedagogical Assessment Planning Agent.
The instructor requested {requested_count} high-quality, non-redundant assessment targets at difficulty: {requested_difficulty.upper()}.

AVAILABLE INSTRUCTIONAL CONCEPTS & EVIDENCE:
{json.dumps(concept_candidates, indent=2)}

AVAILABLE HIERARCHICAL PARENT SECTIONS:
{json.dumps([{"parent_id": p.evidence_id, "title": p.title, "children": p.child_ids} for p in hier_store.parents[:10]], indent=2)}

CRITICAL CURRICULAR RULES:
1. Assess ONLY genuine technical concepts, commands, formulas, mechanisms, syntax, and algorithms taught in the lecture.
2. NEVER generate questions about lecture meta-structure, course schedule, study plans, or 'overview' segments.
3. ANTI-COLLAPSE RULE: Distribute targets diversely across multiple distinct concepts. NEVER assign more than 2 targets to the same concept.
4. Each target must assess a completely distinct pedagogical facet:
- CONCEPT_UNDERSTANDING (Fundamental definitions and mechanism mechanics)
- THEORETICAL_RATIONALE (Why design decisions/formulas were chosen)
- CODE_INTERPRETATION (API semantics, syntax, tensor manipulation)
- OUTPUT_PREDICTION (Tracing concrete execution and output calculation)
- ERROR_DIAGNOSIS (Invariant violations, bug diagnosis, condition checks)
- BOUNDARY_EDGE_CASE (Sentinels, empty partitions, extreme limits)
- PARAMETER_CHANGE (Altering dimensions, parameters, or hyperparameters)
- COMPLEXITY_ANALYSIS (Time/space asymptotic bounds and trade-offs)
- ARCHITECTURAL_COMPARISON (Contrasting two methods or paradigms)
- PRACTICAL_APPLICATION (Applying the method to a realistic problem)
- OFF_BY_ONE_ANALYSIS (Loop bounds, partition indices, integer division (+1))
- MISCONCEPTION_TARGETING (Targeting common student traps and false assumptions)

Return a strictly valid JSON object matching this schema:
{{
  "planning_strategy_notes": "<Brief explanation of how the requested count was fulfilled across facets>",
  "targets": [
    {{
      "target_id": "T01",
      "concept_name": "<Specific technical concept name>",
      "assessment_facet": "<One of the 12 facets above>",
      "what_taught": "<Precise factual content taught in lecture>",
      "why_assessed": "<Pedagogical rationale for assessing this specific facet>",
      "cognitive_level": "<REMEMBER | UNDERSTAND | APPLY | ANALYZE | EVALUATE>",
      "difficulty_level": "{requested_difficulty.upper()}",
      "primary_evidence_id": "<e.g. E_CHILD_001 or E_PARENT_01>",
      "plausible_misconceptions": ["<Misconception 1>", "<Misconception 2>"]
    }}
  ]
}}
Generate EXACTLY {requested_count} distinct targets."""

        raw_response = llm.generate_text(prompt=prompt, json_mode=True)
        # Robust JSON extraction with truncation recovery
        cleaned = raw_response.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned.split("```json")[1].split("```")[0].strip()
        elif cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1].split("```")[0].strip()
        
        parsed = None
        try:
            parsed = json.loads(cleaned)
        except Exception:
            # Recovery: find the last completed target object ending in "}"
            pos = len(cleaned)
            while pos > 0:
                last_brace = cleaned.rfind("}", 0, pos)
                if last_brace == -1:
                    break
                candidate = cleaned[:last_brace+1]
                for t_str in [candidate + "\n]}", candidate + "]}", candidate + "\n  ]\n}"]:
                    try:
                        recovered = json.loads(t_str)
                        if isinstance(recovered, dict) and "targets" in recovered and len(recovered["targets"]) > 0:
                            parsed = recovered
                            break
                    except Exception:
                        continue
                if parsed:
                    break
                pos = last_brace - 1

        if not parsed or not isinstance(parsed, dict):
            parsed = {"targets": [], "planning_strategy_notes": "Deterministic fallback expansion"}

        raw_targets = parsed.get("targets", [])
        
        # Ensure we have exactly requested_count targets
        allocated_targets: List[AdaptiveAssessmentTarget] = []
        facet_counts: Dict[str, int] = {}
        cog_counts: Dict[str, int] = {}

        # Evidence Content Analysis for Gating
        combined_text = (canonical.raw_content or "") + " " + (canonical.supporting_materials_text or "")
        has_code_evidence = any(kw in combined_text for kw in ["def ", "class ", "return ", "while ", "for ", "import ", "len(", "[", "]", "arr[", "mid ="])
        has_math_evidence = any(kw in combined_text for kw in ["=", "+", "-", "*", "/", "O(", "log", "mu", "sigma", "z =", "%"])

        KEY_ROTATION = ["C", "A", "D", "B"]

        concept_allocation_counts: Dict[str, int] = {}

        for idx, t_data in enumerate(raw_targets):
            if len(allocated_targets) >= requested_count:
                break

            c_name = t_data.get("concept_name", f"Concept {idx+1}").strip()
            c_norm = c_name.lower()

            # Skip meta-pedagogical topics completely
            if c_norm in META_STOPLIST or any(c_norm.startswith(m) for m in ["overview", "intro", "study plan", "lecture segment"]):
                continue

            # Anti-Collapse Rule: Maximum 2 targets per distinct concept
            if concept_allocation_counts.get(c_norm, 0) >= 2:
                continue

            facet = t_data.get("assessment_facet", cls.FACET_POOL[len(allocated_targets) % len(cls.FACET_POOL)])
            if facet not in cls.FACET_POOL:
                facet = cls.FACET_POOL[len(allocated_targets) % len(cls.FACET_POOL)]

            # Evidence-Driven Facet Gating (Prevent Artificial Quota Spam)
            if facet in ["CODE_INTERPRETATION", "OFF_BY_ONE_ANALYSIS"] and not has_code_evidence:
                facet = "THEORETICAL_RATIONALE"
            elif facet == "CALCULATION_MECHANIC" and not has_math_evidence:
                facet = "CONCEPT_UNDERSTANDING"

            # Map primary evidence ID to available child or slide
            p_eid = t_data.get("primary_evidence_id", "")
            if p_eid not in hier_store.child_map and hier_store.children:
                p_eid = hier_store.children[len(allocated_targets) % len(hier_store.children)].evidence_id

            # Planned Answer-Key Steering: Round-robin balanced distribution
            assigned_k = KEY_ROTATION[len(allocated_targets) % len(KEY_ROTATION)]

            diff_val = requested_difficulty.upper() if requested_difficulty.upper() in ["EASY", "MEDIUM", "HARD"] else ["EASY", "MEDIUM", "HARD"][len(allocated_targets) % 3]
            target_obj = AdaptiveAssessmentTarget(
                target_id=f"T{len(allocated_targets)+1:02d}",
                concept_name=c_name,
                assessment_facet=facet,
                what_taught=t_data.get("what_taught", "Taught in lecture"),
                why_assessed=t_data.get("why_assessed", "Instructional assessment"),
                cognitive_level=t_data.get("cognitive_level", "APPLY"),
                difficulty_level=diff_val,
                primary_evidence_id=p_eid,
                supporting_evidence_ids=alignment_graph.get(p_eid, []) if alignment_graph else [],
                plausible_misconceptions=t_data.get("plausible_misconceptions", ["Common distractor error"]),
                assigned_key=assigned_k
            )
            allocated_targets.append(target_obj)
            concept_allocation_counts[c_norm] = concept_allocation_counts.get(c_norm, 0) + 1
            facet_counts[facet] = facet_counts.get(facet, 0) + 1
            cog_counts[target_obj.cognitive_level] = cog_counts.get(target_obj.cognitive_level, 0) + 1

        # If LLM returned fewer targets than requested, backfill from concept candidates across distinct facets
        if len(allocated_targets) < requested_count and concept_candidates:
            curr_idx = 0
            # Allow up to 2 rounds across candidates
            max_rounds = len(concept_candidates) * 2
            attempts = 0
            while len(allocated_targets) < requested_count and attempts < max_rounds:
                c_base = concept_candidates[curr_idx % len(concept_candidates)]
                c_norm = c_base["concept"].strip().lower()
                attempts += 1
                curr_idx += 1

                if c_norm in META_STOPLIST or any(c_norm.startswith(m) for m in ["overview", "intro", "study plan"]):
                    continue

                if concept_allocation_counts.get(c_norm, 0) >= 2 and len(concept_allocation_counts) < len(concept_candidates):
                    continue

                tgt_num = len(allocated_targets) + 1
                facet = cls.FACET_POOL[tgt_num % len(cls.FACET_POOL)]
                p_eid = hier_store.children[tgt_num % len(hier_store.children)].evidence_id if hier_store.children else "E_C01"
                diff_val = requested_difficulty.upper() if requested_difficulty.upper() in ["EASY", "MEDIUM", "HARD"] else ["EASY", "MEDIUM", "HARD"][tgt_num % 3]
                assigned_k = KEY_ROTATION[tgt_num % len(KEY_ROTATION)]

                target_obj = AdaptiveAssessmentTarget(
                    target_id=f"T{tgt_num:02d}",
                    concept_name=c_base["concept"],
                    assessment_facet=facet,
                    what_taught=c_base["what"],
                    why_assessed=f"Assesses foundational understanding of {c_base['concept']} ({facet})",
                    cognitive_level="APPLY" if requested_difficulty == "MEDIUM" else ("ANALYZE" if requested_difficulty == "HARD" else "UNDERSTAND"),
                    difficulty_level=diff_val,
                    primary_evidence_id=p_eid,
                    supporting_evidence_ids=alignment_graph.get(p_eid, []),
                    plausible_misconceptions=c_base.get("misconceptions", ["Conceptual misconception"]),
                    assigned_key=assigned_k
                )
                allocated_targets.append(target_obj)
                concept_allocation_counts[c_norm] = concept_allocation_counts.get(c_norm, 0) + 1
                facet_counts[facet] = facet_counts.get(facet, 0) + 1
                cog_counts[target_obj.cognitive_level] = cog_counts.get(target_obj.cognitive_level, 0) + 1

        defensible_capacity = len(allocated_targets)

        return AdaptiveAssessmentPlan(
            plan_id=f"ADAPTIVE_PLAN_{canonical.input_id}_{requested_difficulty.upper()}",
            requested_count=requested_count,
            allocated_count=defensible_capacity,
            requested_difficulty=requested_difficulty.upper(),
            representation_used=representation_type,
            targets=allocated_targets,
            facet_distribution=facet_counts,
            cognitive_distribution=cog_counts,
            planning_strategy_notes=parsed.get("planning_strategy_notes", "Fulfilled Q_req using multi-angle cognitive faceting.")
        )
