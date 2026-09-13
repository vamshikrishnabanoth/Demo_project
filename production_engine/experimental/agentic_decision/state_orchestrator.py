"""
Controlled Autonomous Agentic State-Machine Orchestrator for Architecture E v2.0.
Executes bounded, deterministic-guided state transitions across 10 operational decision points.
"""

from typing import Dict, Any, List, Optional, Tuple
from production_engine.experimental.agentic_decision.schemas import (
    AgenticState, AgentActionType
)


class AgenticStateOrchestrator:
    """Bounded, state-managed autonomous decision orchestrator."""

    @classmethod
    def evaluate_and_decide(cls, state: AgenticState) -> Tuple[AgentActionType, str]:
        """
        Autonomously inspects the current pipeline state and decides the next optimal action.
        """
        # Rule Gate 1: Non-Academic Content Check
        if not state.is_academic:
            return "TERMINATE_NON_ACADEMIC", "Non-academic content detected; terminating to avoid hallucination."

        # Rule Gate 2: Extremely Limited Content with High Request
        if state.available_concepts_count == 1 and state.requested_count >= 15 and state.current_targets_count >= 10:
            return "DELIVER_MAX_DEFENSIBLE_WITH_NOTICE", "Evidence exhausted on minimal content; returning maximum defensible set with transparent notice."

        # Rule Gate 3: Repair Escalation (Patched item failed secondary validation)
        if state.repair_attempts >= 1 and state.failed_items_count > 0 and not state.is_structural_defect:
            return "ESCALATE_TO_REGENERATION", "Secondary validation failed after surgical patch; escalating to targeted item regeneration."

        # Rule Gate 4: Structural Defect in Validation
        if state.failed_items_count > 0 and state.is_structural_defect:
            return "TARGETED_ITEM_REGENERATION", "Multi-field / structural defect detected in validator audit; regenerating item."

        # Rule Gate 5: Single Field Defect in Validation
        if state.failed_items_count > 0 and state.current_defect_field and not state.is_structural_defect:
            return "SURGICAL_FIELD_PATCH", f"Isolated defect in field '{state.current_defect_field}'; applying localized JSON patch."

        # Rule Gate 6: Duplicate Target Resolution
        if len(state.allocated_facets) != len(set(state.allocated_facets)) and state.allocated_facets:
            return "DEDUPLICATE_TARGETS", "Duplicate concept-facet pair detected in planning pool; resolving duplicate."

        # Rule Gate 7: Cross-Material Linkage Required
        if state.has_slides and state.has_spoken_audio and not any(e.startswith("E_SLIDE") for e in state.available_evidence_ids):
            return "TRIGGER_CROSS_MATERIAL_ENRICHMENT", "Spoken audio missing linked slide evidence; querying cross-material alignment graph."

        # Rule Gate 8: Reasoning Context Window Expansion
        if any(e.startswith("E_CHILD") for e in state.available_evidence_ids) and not any(e.startswith("E_PARENT") for e in state.available_evidence_ids):
            return "EXPAND_TO_PARENT_WINDOW", "Child snippet context narrow for reasoning item; expanding to parent narrative window."

        # Rule Gate 9: Capacity Facet Expansion
        if state.available_concepts_count < state.requested_count and state.current_targets_count < state.requested_count:
            return "EXPAND_COGNITIVE_FACETS", f"Unique concepts ({state.available_concepts_count}) < requested Q ({state.requested_count}); expanding along 12 cognitive facets."

        # Rule Gate 10: Direct Generation (Sufficient Grounded Evidence)
        return "DIRECT_GENERATE", "State satisfies all evidence, facet, and capacity invariants; proceeding to direct batch generation."
