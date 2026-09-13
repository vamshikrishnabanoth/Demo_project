"""
Core Production Assessment Engine (Architecture E).
Single entrypoint for adaptive, teacher-grounded assessment generation.
"""

import time
from typing import Dict, Any, Optional

from pipeline_experiment.generator.llm_engine import UnifiedLLMEngine
from pipeline_experiment.shared.schemas.canonical_models import (
    CanonicalEducationalInput, PedagogicalSummary, PedagogicalBlueprint
)
from production_engine.schemas import (
    ProductionAssessmentSuite, ProductionAssessmentPlan, RoutingDecision
)
from production_engine.router import ProductionRouter
from production_engine.extractors.summary_extractor import ProductionSummaryExtractor
from production_engine.extractors.blueprint_extractor import ProductionBlueprintExtractor
from production_engine.extractors.unified_synthesizer import ProductionUnifiedSynthesizer
from production_engine.planner import ProductionAssessmentPlanner
from production_engine.retrieval.evidence_retriever import ProductionEvidenceRetriever
from production_engine.generator import ProductionMCQGenerator
from production_engine.validator import ProductionAssessmentValidator


class AdaptiveAssessmentEngine:
    """Production Adaptive Assessment Engine (Architecture E with RAG & Traceability)."""

    def __init__(
        self,
        provider: str = "groq",
        model: str = "qwen/qwen3.8-27b",
        temperature: float = 0.2
    ):
        self.llm = UnifiedLLMEngine(provider=provider, model=model, temperature=temperature)

    def generate_assessment(
        self,
        canonical: CanonicalEducationalInput,
        requested_count: int = 5,
        difficulty: str = "MIXED"
    ) -> ProductionAssessmentSuite:
        start_time = time.time()
        llm_call_count = 0

        # Step 1: Upfront Feature Analysis & Representation Routing (0 LLM calls, <1ms deterministic)
        routing: RoutingDecision = ProductionRouter.route(canonical)
        rep_type = routing.selected_representation

        summary: Optional[PedagogicalSummary] = None
        blueprint: Optional[PedagogicalBlueprint] = None

        # Step 2: Extract Selected Representation
        if rep_type == "SUMMARY":
            summary = ProductionSummaryExtractor.extract(canonical, self.llm)
            llm_call_count += 1
        elif rep_type == "BLUEPRINT":
            blueprint = ProductionBlueprintExtractor.extract(canonical, self.llm)
            llm_call_count += 2
        elif rep_type == "UNIFIED":
            summary, blueprint = ProductionUnifiedSynthesizer.extract_both(canonical, self.llm)
            llm_call_count += 3

        # Step 3: Dynamic Assessment Planning (1 LLM call + deterministic capacity bound)
        plan: ProductionAssessmentPlan = ProductionAssessmentPlanner.plan_assessment(
            canonical=canonical,
            representation_type=rep_type,
            requested_count=requested_count,
            llm=self.llm,
            summary=summary,
            blueprint=blueprint,
            difficulty=difficulty
        )
        llm_call_count += 1

        # Step 4: Evidence Retrieval Layer (RAG) (0 LLM calls, deterministic vector/lexical retrieval)
        retrieved_evidence = ProductionEvidenceRetriever.retrieve_for_plan(
            canonical=canonical,
            targets=plan.targets
        )

        # Step 5: Cognitive Fidelity MCQ Generation (1 LLM call)
        raw_questions = ProductionMCQGenerator.generate_questions(
            canonical=canonical,
            plan=plan,
            llm=self.llm,
            retrieved_evidence_map=retrieved_evidence
        )
        llm_call_count += 1

        # Step 6: Multi-Layer Validation & Grounding Audit (0 LLM calls, deterministic audit)
        raw_evidence = (canonical.raw_content or "") + "\n" + (canonical.supporting_materials_text or "")
        valid_questions, val_status = ProductionAssessmentValidator.validate_suite(raw_questions, raw_evidence)

        # Ensure question difficulty level is recorded
        for q in valid_questions:
            if difficulty.upper() in ["EASY", "MEDIUM", "HARD"]:
                q.difficulty_level = difficulty.upper()

        total_latency = round(time.time() - start_time, 2)

        return ProductionAssessmentSuite(
            input_id=canonical.input_id,
            title=canonical.title,
            representation_used=rep_type,
            routing_rationale=routing.rationale,
            requested_count=requested_count,
            requested_difficulty=difficulty.upper() if difficulty.upper() in ["EASY", "MEDIUM", "HARD"] else "MIXED",
            defensible_capacity=plan.maximum_defensible_capacity,
            final_question_count=len(valid_questions),
            questions=valid_questions,
            validation_status=val_status,
            generation_metadata={
                "total_latency_seconds": total_latency,
                "measured_llm_calls": llm_call_count,
                "pedagogical_delivery_index": routing.pedagogical_delivery_index,
                "features": routing.features.model_dump(),
                "rag_chunks_retrieved_count": len(retrieved_evidence),
                "requested_difficulty": difficulty.upper()
            }
        )
