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
        concept_candidates = []
        if blueprint and blueprint.topics:
            for b in blueprint.topics:
                concept_candidates.append({
                    "concept": b.topic,
                    "what": f"Instructional act: {', '.join(b.instructional_acts)} | Dominant mode: {b.dominant_mode}",
                    "why": f"Teacher specificity: {b.teacher_specificity} (Salience {b.salience_score:.2f})",
                    "evidence_refs": b.evidence_refs
                })
        elif summary:
            for c in summary.concepts_and_definitions:
                concept_candidates.append({
                    "concept": c,
                    "what": c,
                    "why": "Core curriculum definition",
                    "evidence_refs": []
                })
            for m in summary.mechanisms_and_formulas:
                concept_candidates.append({
                    "concept": m,
                    "what": m,
                    "why": "Mathematical / algorithmic mechanism",
                    "evidence_refs": []
                })
        else:
            # Extract concepts from hierarchical parent chunks
            for p in hier_store.parents[:8]:
                concept_candidates.append({
                    "concept": p.title,
                    "what": p.full_text[:200],
                    "why": "Instructional segment coverage",
                    "evidence_refs": p.child_ids
                })

        if not concept_candidates:
            concept_candidates = [{"concept": "Core Methodology", "what": canonical.title, "why": "Core topic", "misconceptions": []}]

        # 2. Build Multi-Angle Facet Prompt for LLM Agent
        # Provide the LLM with the concepts, available parent windows, and slide links
        prompt = f"""You are the Lead Pedagogical Assessment Planning Agent.
The instructor requested {requested_count} high-quality, non-redundant assessment targets at difficulty: {requested_difficulty.upper()}.

AVAILABLE INSTRUCTIONAL CONCEPTS & EVIDENCE:
{json.dumps(concept_candidates, indent=2)}

AVAILABLE HIERARCHICAL PARENT SECTIONS:
{json.dumps([{"parent_id": p.evidence_id, "title": p.title, "children": p.child_ids} for p in hier_store.parents[:10]], indent=2)}

MISSION:
Fulfill the teacher's request for exactly {requested_count} targets.
If the number of unique concepts ({len(concept_candidates)}) is less than {requested_count}, do NOT invent unrelated topics.
Instead, assess the available core concepts from MULTIPLE DISTINCT PEDAGOGICAL FACETS:
1. CONCEPT_UNDERSTANDING (Fundamental definitions and mechanism mechanics)
2. THEORETICAL_RATIONALE (Why design decisions/formulas were chosen)
3. CODE_INTERPRETATION (API semantics, syntax, tensor manipulation)
4. OUTPUT_PREDICTION (Tracing concrete execution and output calculation)
5. ERROR_DIAGNOSIS (Invariant violations, bug diagnosis, condition checks)
6. BOUNDARY_EDGE_CASE (Sentinels, empty partitions, extreme limits)
7. PARAMETER_CHANGE (Altering dimensions, parameters, or hyperparameters)
8. COMPLEXITY_ANALYSIS (Time/space asymptotic bounds and trade-offs)
9. ARCHITECTURAL_COMPARISON (Contrasting two methods or paradigms)
10. PRACTICAL_APPLICATION (Applying the method to a realistic problem)
11. OFF_BY_ONE_ANALYSIS (Loop bounds, partition indices, integer division (+1))
12. MISCONCEPTION_TARGETING (Targeting common student traps and false assumptions)

Return a strictly valid JSON object matching this schema:
{{
  "planning_strategy_notes": "<Brief explanation of how the requested count was fulfilled across facets>",
  "targets": [
    {{
      "target_id": "T01",
      "concept_name": "<Specific concept name>",
      "assessment_facet": "<CONCEPT_UNDERSTANDING | THEORETICAL_RATIONALE | CODE_INTERPRETATION | OUTPUT_PREDICTION | ERROR_DIAGNOSIS | BOUNDARY_EDGE_CASE | PARAMETER_CHANGE | COMPLEXITY_ANALYSIS | ARCHITECTURAL_COMPARISON | PRACTICAL_APPLICATION | OFF_BY_ONE_ANALYSIS | MISCONCEPTION_TARGETING>",
      "what_taught": "<Precise factual content taught in lecture>",
      "why_assessed": "<Pedagogical rationale for assessing this specific facet>",
      "cognitive_level": "<REMEMBER | UNDERSTAND | APPLY | ANALYZE | EVALUATE>",
      "difficulty_level": "{requested_difficulty.upper()}",
      "primary_evidence_id": "<e.g. E_CHILD_001 or E_SLIDE_01>",
      "plausible_misconceptions": ["<Misconception 1>", "<Misconception 2>"]
    }}
  ]
}}
Generate EXACTLY {requested_count} distinct targets."""

        raw_response = llm.generate_text(prompt=prompt, json_mode=True)
        try:
            cleaned = raw_response.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned.split("```json")[1].split("```")[0].strip()
            elif cleaned.startswith("```"):
                cleaned = cleaned.split("```")[1].split("```")[0].strip()
            parsed = json.loads(cleaned)
        except Exception:
            # Fallback heuristic expansion if JSON parse fails
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

        for idx, t_data in enumerate(raw_targets[:requested_count]):
            facet = t_data.get("assessment_facet", cls.FACET_POOL[idx % len(cls.FACET_POOL)])
            if facet not in cls.FACET_POOL:
                facet = cls.FACET_POOL[idx % len(cls.FACET_POOL)]

            # Evidence-Driven Facet Gating (Prevent Artificial Quota Spam)
            if facet in ["CODE_INTERPRETATION", "OFF_BY_ONE_ANALYSIS"] and not has_code_evidence:
                facet = "THEORETICAL_RATIONALE"
            elif facet == "CALCULATION_MECHANIC" and not has_math_evidence:
                facet = "CONCEPT_UNDERSTANDING"

            # Map primary evidence ID to available child or slide
            p_eid = t_data.get("primary_evidence_id", "")
            if p_eid not in hier_store.child_map and hier_store.children:
                p_eid = hier_store.children[idx % len(hier_store.children)].evidence_id

            diff_val = requested_difficulty.upper() if requested_difficulty.upper() in ["EASY", "MEDIUM", "HARD"] else ["EASY", "MEDIUM", "HARD"][idx % 3]
            target_obj = AdaptiveAssessmentTarget(
                target_id=f"T{idx+1:02d}",
                concept_name=t_data.get("concept_name", f"Concept {idx+1}"),
                assessment_facet=facet,
                what_taught=t_data.get("what_taught", "Taught in lecture"),
                why_assessed=t_data.get("why_assessed", "Instructional assessment"),
                cognitive_level=t_data.get("cognitive_level", "APPLY"),
                difficulty_level=diff_val,
                primary_evidence_id=p_eid,
                supporting_evidence_ids=alignment_graph.get(p_eid, []),
                plausible_misconceptions=t_data.get("plausible_misconceptions", ["Common distractor error"])
            )
            allocated_targets.append(target_obj)
            facet_counts[facet] = facet_counts.get(facet, 0) + 1
            cog_counts[target_obj.cognitive_level] = cog_counts.get(target_obj.cognitive_level, 0) + 1

        # If LLM returned fewer than requested_count, deterministically expand with remaining facets
        while len(allocated_targets) < requested_count:
            idx = len(allocated_targets)
            c_base = concept_candidates[idx % len(concept_candidates)]
            facet = cls.FACET_POOL[idx % len(cls.FACET_POOL)]
            p_eid = hier_store.children[idx % len(hier_store.children)].evidence_id if hier_store.children else "E_C01"
            diff_val = requested_difficulty.upper() if requested_difficulty.upper() in ["EASY", "MEDIUM", "HARD"] else ["EASY", "MEDIUM", "HARD"][idx % 3]

            target_obj = AdaptiveAssessmentTarget(
                target_id=f"T{idx+1:02d}",
                concept_name=f"{c_base['concept']} ({facet.replace('_', ' ').title()})",
                assessment_facet=facet,
                what_taught=c_base["what"],
                why_assessed=f"Assesses {facet.lower().replace('_', ' ')} of {c_base['concept']}",
                cognitive_level="APPLY" if requested_difficulty == "MEDIUM" else ("ANALYZE" if requested_difficulty == "HARD" else "REMEMBER"),
                difficulty_level=diff_val,
                primary_evidence_id=p_eid,
                supporting_evidence_ids=alignment_graph.get(p_eid, []),
                plausible_misconceptions=c_base.get("misconceptions", ["Formula inversion error"])
            )
            allocated_targets.append(target_obj)
            facet_counts[facet] = facet_counts.get(facet, 0) + 1
            cog_counts[target_obj.cognitive_level] = cog_counts.get(target_obj.cognitive_level, 0) + 1

        return AdaptiveAssessmentPlan(
            plan_id=f"ADAPTIVE_PLAN_{canonical.input_id}_{requested_difficulty.upper()}",
            requested_count=requested_count,
            allocated_count=len(allocated_targets),
            requested_difficulty=requested_difficulty.upper(),
            representation_used=representation_type,
            targets=allocated_targets,
            facet_distribution=facet_counts,
            cognitive_distribution=cog_counts,
            planning_strategy_notes=parsed.get("planning_strategy_notes", "Fulfilled Q_req using multi-angle cognitive faceting.")
        )
