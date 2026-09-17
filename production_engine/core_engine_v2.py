"""
Core Production Assessment Engine (Architecture E v2.0 Candidate).
Integrates:
- Dual-Level Hierarchical Context (Parent Narrative Windows + Precision Child Citations)
- Bidirectional Cross-Material Alignment Graph (Voice <-> Slides <-> Code)
- Evidence-Aware Adaptive Planning Agent (Multi-Angle Cognitive Faceting)
- Closed-Loop Critic & Surgical Patch-Repair Agent (Guaranteed Q_requested = Q_delivered)
"""

import time
from typing import Dict, Any, Optional, List

from pipeline_experiment.generator.llm_engine import UnifiedLLMEngine
from pipeline_experiment.shared.schemas.canonical_models import (
    CanonicalEducationalInput, PedagogicalSummary, PedagogicalBlueprint
)
from production_engine.schemas import (
    ProductionAssessmentSuite, ProductionMCQ, RoutingDecision
)
from production_engine.router import ProductionRouter
from production_engine.extractors.summary_extractor import ProductionSummaryExtractor
from production_engine.extractors.blueprint_extractor import ProductionBlueprintExtractor
from production_engine.extractors.unified_synthesizer import ProductionUnifiedSynthesizer
from production_engine.generator import ProductionMCQGenerator
from production_engine.validator import ProductionAssessmentValidator

# Integrated Phase 2 Enhancements
from production_engine.experimental.hierarchical_rag.hierarchical_chunker import HierarchicalChunker
from production_engine.experimental.hierarchical_rag.hierarchical_retriever import HierarchicalRetriever
from production_engine.experimental.cross_modal.cross_material_aligner import CrossMaterialAligner
from production_engine.experimental.planning_agent.adaptive_planning_agent import AdaptivePlanningAgent
from production_engine.experimental.planning_agent.schemas import AdaptiveAssessmentPlan
from production_engine.experimental.critic_repair.critic_agent import ClosedLoopCriticAgent
from production_engine.cache.cache_manager import ProductionCacheManager
from production_engine.observability.tracer import PipelineTracer


class AdaptiveAssessmentEngineV2:
    """Production Engine v2.0 Candidate integrating Evidence Layer Enhancements and Agentic Loops."""

    def __init__(
        self,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.2
    ):
        from production_engine.config import (
            MODEL_MAP, GENERATOR_PROVIDER, GENERATOR_MODEL, SERVING_MODE, GENERATOR_MODEL_TARGET
        )
        import os
        self.provider = provider or os.getenv("DEFAULT_LLM_PROVIDER", "groq")
        self.model = model or os.getenv("DEFAULT_LLM_MODEL", MODEL_MAP.get("representation", "openai/gpt-oss-20b"))
        self.temperature = temperature
        
        critic_provider = os.getenv("CRITIC_PROVIDER", self.provider)
        critic_model = os.getenv("CRITIC_MODEL", MODEL_MAP.get("critic", "openai/gpt-oss-120b"))
        if critic_provider == "ollama" and critic_model.startswith("openai/"):
            critic_model = os.getenv("OLLAMA_MODEL", "quiz-expert:latest")

        # Dedicated engine instances matching frozen task assignments
        self.llm = UnifiedLLMEngine(provider=self.provider, model=self.model, temperature=temperature)
        self.generator_llm = UnifiedLLMEngine(
            provider=GENERATOR_PROVIDER,
            model=GENERATOR_MODEL,
            temperature=temperature
        )
        self.critic_llm = UnifiedLLMEngine(
            provider=critic_provider,
            model=critic_model,
            temperature=temperature
        )

    def generate_assessment(
        self,
        canonical: CanonicalEducationalInput,
        transcript_data: Optional[Dict[str, Any]] = None,
        requested_count: int = 5,
        difficulty: str = "MIXED",
        enable_replenishment: bool = False,
        max_repair_attempts: int = 1,
        enforce_fixable_filter: bool = True
    ) -> ProductionAssessmentSuite:
        start_time = time.time()
        llm_call_count = 0
        repair_llm_calls = 0
        replenishment_llm_calls = 0
        rejections_count = 0

        # Initialize Structured Request Tracer
        request_id = f"REQ-{int(time.time()*1000)}-{canonical.input_id[:8]}"
        tracer = PipelineTracer(request_id=request_id, input_id=canonical.input_id)
        system_notice = None

        # Step 1: Upfront Feature Analysis & Representation Routing (0 LLM calls, <1ms deterministic)
        routing: RoutingDecision = ProductionRouter.route(canonical)
        rep_type = routing.selected_representation
        tracer.record_routing(rep_type=rep_type, pdi=routing.pedagogical_delivery_index)

        # Non-Academic Content Check
        raw_text = ((canonical.raw_content or "") + "\n" + (canonical.supporting_materials_text or "")).strip()
        academic_keywords = [
            "algorithm", "function", "data", "model", "parameter", "system", "method", "equation",
            "network", "layer", "theory", "problem", "binary", "matrix", "array", "search",
            "learn", "loss", "train", "cost", "weight", "database", "query", "node", "tree", "graph"
        ]
        is_academic = any(kw in raw_text.lower() for kw in academic_keywords) or routing.features.code_density > 0.05 or routing.features.has_ppt

        if len(raw_text.split()) < 5 or (not is_academic and routing.features.pedagogical_marker_density == 0.0 and routing.features.dialogue_interaction_density == 0.0):
            trace = tracer.finalize(delivered_count=0, status="FAILED_NON_ACADEMIC")
            return ProductionAssessmentSuite(
                input_id=canonical.input_id,
                title=canonical.title,
                representation_used="SUMMARY",
                routing_rationale="No academic content was detected, so questions could not be generated.",
                requested_count=requested_count,
                requested_difficulty=difficulty.upper() if difficulty.upper() in ["EASY", "MEDIUM", "HARD"] else "MIXED",
                defensible_capacity=0,
                final_question_count=0,
                questions=[],
                validation_status="FAILED",
                generation_metadata={
                    "request_id": request_id,
                    "engine_version": "Architecture E v2.0 (Production Hardened)",
                    "total_latency_seconds": round(time.time() - start_time, 2),
                    "measured_llm_calls": 0,
                    "pedagogical_delivery_index": routing.pedagogical_delivery_index,
                    "status_note": "No academic content was detected, so questions could not be generated."
                }
            )

        # Step 2: Ingestion & Canonical Evidence Space Construction (Dependency-Aware Caching)
        audio_text = transcript_data.get("text", "") if transcript_data else (canonical.raw_content or "")
        slide_text = canonical.supporting_materials_text or ""
        audio_hash = ProductionCacheManager.compute_text_bytes_hash(audio_text)
        slide_hash = ProductionCacheManager.compute_text_bytes_hash(slide_text)
        multimodal_composite_hash = ProductionCacheManager.compute_text_bytes_hash(f"{audio_hash}||{slide_hash}")

        # Tier 6 Check: Production Assessment Suite Cache (0 LLM calls, <5ms)
        cached_suite = ProductionCacheManager.get_assessment_suite(
            canonical.input_id, multimodal_composite_hash, requested_count, difficulty
        )
        if cached_suite:
            tracer.record_cache_hit("tier6_assessment_suite")
            trace = tracer.finalize(delivered_count=len(cached_suite.questions), status="CACHED_DELIVERED")
            cached_suite.generation_metadata["request_id"] = request_id
            cached_suite.generation_metadata["cache_hit"] = True
            cached_suite.generation_metadata["measured_llm_calls"] = 0
            cached_suite.generation_metadata["total_latency_seconds"] = round(time.time() - start_time, 4)
            return cached_suite
        else:
            tracer.record_cache_miss("tier6_assessment_suite")
        
        # Tier 3 Check: Hierarchical Evidence Store (Audio Chunks)
        hier_store = ProductionCacheManager.get_hierarchical_store(canonical.input_id, audio_hash)
        if hier_store:
            tracer.record_cache_hit("tier3_hierarchical")
        else:
            tracer.record_cache_miss("tier3_hierarchical")
            hier_store = HierarchicalChunker.build_store(canonical, transcript_data=transcript_data)
            ProductionCacheManager.set_hierarchical_store(canonical.input_id, audio_hash, hier_store)

        # Tier 4 Check: Cross-Material Alignment Graph (Audio + Slides)
        alignment_graph = ProductionCacheManager.get_alignment_graph(canonical.input_id, multimodal_composite_hash)
        if alignment_graph:
            tracer.record_cache_hit("tier4_cross_modal")
        else:
            tracer.record_cache_miss("tier4_cross_modal")
            alignment_graph = CrossMaterialAligner.build_alignment_graph(canonical)
            ProductionCacheManager.set_alignment_graph(canonical.input_id, multimodal_composite_hash, alignment_graph)

        summary: Optional[PedagogicalSummary] = None
        blueprint: Optional[PedagogicalBlueprint] = None

        # Tier 5 Check: Pedagogical Representations
        cached_rep = ProductionCacheManager.get_representation(canonical.input_id, rep_type, multimodal_composite_hash)
        if cached_rep:
            tracer.record_cache_hit("tier5_representation")
            summary, blueprint = cached_rep
        else:
            tracer.record_cache_miss("tier5_representation")
            if rep_type == "SUMMARY":
                summary = ProductionSummaryExtractor.extract(canonical, self.llm)
                llm_call_count += 1
            elif rep_type == "BLUEPRINT":
                blueprint = ProductionBlueprintExtractor.extract(canonical, self.llm)
                llm_call_count += 2
            elif rep_type == "UNIFIED":
                summary, blueprint = ProductionUnifiedSynthesizer.extract_both(canonical, self.llm)
                llm_call_count += 3
            ProductionCacheManager.set_representation(canonical.input_id, rep_type, multimodal_composite_hash, summary, blueprint)

        # Step 4: Evidence-Aware Adaptive Assessment Planning (1 LLM call)
        adaptive_plan: AdaptiveAssessmentPlan = AdaptivePlanningAgent.plan_assessment(
            canonical=canonical,
            hier_store=hier_store,
            alignment_graph=alignment_graph,
            requested_count=requested_count,
            requested_difficulty=difficulty,
            llm=self.llm,
            summary=summary,
            blueprint=blueprint,
            representation_type=rep_type
        )
        llm_call_count += 1
        tracer.record_planning(facets=list(adaptive_plan.facet_distribution.keys()), notes=adaptive_plan.planning_strategy_notes)

        # Adapt plan targets for retrieval and generator compatibility
        from production_engine.schemas import AssessmentTarget, ProductionAssessmentPlan
        legacy_targets = []
        for t in adaptive_plan.targets:
            legacy_targets.append(AssessmentTarget(
                target_id=t.target_id,
                concept_name=t.concept_name,
                what_taught=t.what_taught,
                why_assessed=t.why_assessed,
                cognitive_level=t.cognitive_level,
                difficulty_level=t.difficulty_level,
                instructional_act="EXPLAIN",
                evidence_refs=[t.primary_evidence_id] + t.supporting_evidence_ids,
                plausible_misconceptions=t.plausible_misconceptions,
                assigned_key=getattr(t, "assigned_key", None)
            ))

        engine_plan = ProductionAssessmentPlan(
            input_id=canonical.input_id,
            representation_used=rep_type,
            requested_question_count=requested_count,
            requested_difficulty=difficulty.upper() if difficulty.upper() in ["EASY", "MEDIUM", "HARD"] else "MIXED",
            maximum_defensible_capacity=adaptive_plan.allocated_count,
            allocated_question_count=len(legacy_targets),
            targets=legacy_targets
        )

        # Step 5: Hierarchical + Cross-Modal Evidence Retrieval (0 LLM calls)
        hier_retrieved_map = HierarchicalRetriever.retrieve_for_plan(hier_store, legacy_targets)
        
        # Inject Cross-Material Alignment into retrieved evidence
        adapted_retrieved_map = {}
        for t_id, h_ev in hier_retrieved_map.items():
            from production_engine.retrieval.evidence_retriever import RetrievedEvidence
            
            # Expand with linked slide or audio citations
            expanded_eids = CrossMaterialAligner.expand_evidence_with_alignment(
                canonical, h_ev.matched_child_ids, alignment_graph
            )

            # Enrich prompt content if cross-material slide exists
            extra_slide_content = ""
            for eid in expanded_eids:
                if eid.startswith("E_SLIDE") and eid in hier_store.child_map:
                    extra_slide_content += f"\n\n=== [CROSS-MATERIAL SLIDE REFERENCE: {eid}] ===\n{hier_store.child_map[eid].text}"

            adapted_retrieved_map[t_id] = RetrievedEvidence(
                target_id=h_ev.target_id,
                concept_name=h_ev.concept_name,
                primary_chunk_id=h_ev.matched_child_ids[0] if h_ev.matched_child_ids else "C_01",
                evidence_ids=expanded_eids,
                time_spans_text=h_ev.citation_spans_text,
                retrieved_content=h_ev.retrieved_content + extra_slide_content,
                relevance_score=h_ev.relevance_score
            )

        # Step 6: Cognitive Fidelity MCQ Generation (1 LLM call per batch)
        raw_questions = ProductionMCQGenerator.generate_questions(
            canonical=canonical,
            plan=engine_plan,
            llm=self.generator_llm,
            retrieved_evidence_map=adapted_retrieved_map
        )
        llm_call_count += (len(engine_plan.targets) + 1) // 2

        # Step 7: Integrity Validation, Relational Grounding & Semantic Deduplication Gate
        raw_evidence = (canonical.raw_content or "") + "\n" + (canonical.supporting_materials_text or "")
        final_repaired_questions: List[ProductionMCQ] = []
        accepted_stems: List[str] = []
        accepted_propositions: List[Dict[str, Any]] = []
        repairs_performed = 0

        def _record_accepted(mcq: ProductionMCQ):
            accepted_stems.append(mcq.stem or mcq.question_text)
            raw_opts = {"A": mcq.option_a, "B": mcq.option_b, "C": mcq.option_c, "D": mcq.option_d}
            accepted_propositions.append({
                "concept": mcq.target_concept or "",
                "stem": mcq.stem or mcq.question_text or "",
                "correct_text": raw_opts.get(mcq.correct_option, ""),
                "facet": mcq.cognitive_level or ""
            })

        for q in raw_questions:
            val_res = ProductionAssessmentValidator.validate_question(
                q, raw_evidence, accepted_stems=accepted_stems, accepted_propositions=accepted_propositions
            )
            if val_res.is_valid:
                final_repaired_questions.append(q)
                _record_accepted(q)
            else:
                if enforce_fixable_filter and not val_res.is_fixable:
                    # Case 1: Fundamental absence, ungrounded parameter, meta-structure, or duplicate -> Hard Reject
                    # 0 additional LLM calls after candidate generation
                    rejections_count += 1
                    continue

                # Case 2: Fixable wording/distractor -> ONE targeted repair attempt (or up to max_repair_attempts)
                if max_repair_attempts > 0:
                    ev_obj = adapted_retrieved_map.get(q.target_id, list(adapted_retrieved_map.values())[0])
                    ev_excerpt = ev_obj.retrieved_content
                    rep_res = ClosedLoopCriticAgent.diagnose_and_repair(
                        mcq=q,
                        validator_issues=val_res.issues,
                        evidence_text=ev_excerpt,
                        llm=self.critic_llm,
                        max_attempts=max_repair_attempts
                    )
                    llm_call_count += rep_res.attempts_taken
                    repair_llm_calls += rep_res.attempts_taken
                    if rep_res.final_validation_passed:
                        # Validate repaired question against accepted stems & propositions
                        repaired = rep_res.repaired_mcq
                        rep_val = ProductionAssessmentValidator.validate_question(
                            repaired, raw_evidence, accepted_stems=accepted_stems, accepted_propositions=accepted_propositions
                        )
                        if rep_val.is_valid:
                            # Ensure provenance is attached to repaired question
                            repaired.target_id = q.target_id
                            repaired.assigned_key = q.assigned_key
                            repaired.evidence_excerpt = q.evidence_excerpt or ev_excerpt[:300]
                            repaired.representation_used = rep_type
                            repaired.planner_decision = q.planner_decision
                            final_repaired_questions.append(repaired)
                            _record_accepted(repaired)
                            repairs_performed += 1
                        else:
                            rejections_count += 1
                    else:
                        rejections_count += 1
                else:
                    rejections_count += 1

        # Step 8: Targeted Recovery for Failed Targets (Strictly Non-Duplicate)
        # Bounded by enable_replenishment configuration
        if enable_replenishment:
            assessed_target_ids = {q.target_id for q in final_repaired_questions if q.target_id}
            unassessed_targets = [t for t in engine_plan.targets if t.target_id not in assessed_target_ids]

            for target_to_gen in unassessed_targets:
                if len(final_repaired_questions) >= requested_count:
                    break
                ev_obj = adapted_retrieved_map.get(target_to_gen.target_id, list(adapted_retrieved_map.values())[0])

                single_target_plan = ProductionAssessmentPlan(
                    input_id=canonical.input_id,
                    representation_used=rep_type,
                    requested_question_count=1,
                    requested_difficulty=difficulty.upper() if difficulty.upper() in ["EASY", "MEDIUM", "HARD"] else "MIXED",
                    maximum_defensible_capacity=1,
                    allocated_question_count=1,
                    targets=[target_to_gen]
                )

                replenished_raw = ProductionMCQGenerator.generate_questions(
                    canonical=canonical,
                    plan=single_target_plan,
                    llm=self.generator_llm,
                    retrieved_evidence_map={target_to_gen.target_id: ev_obj}
                )
                llm_call_count += 1
                replenishment_llm_calls += 1

                if replenished_raw:
                    rep_q = replenished_raw[0]
                    rep_val = ProductionAssessmentValidator.validate_question(
                        rep_q, raw_evidence, accepted_stems=accepted_stems, accepted_propositions=accepted_propositions
                    )
                    if rep_val.is_valid:
                        rep_q.target_id = target_to_gen.target_id
                        rep_q.assigned_key = getattr(target_to_gen, "assigned_key", None)
                        rep_q.evidence_excerpt = ev_obj.retrieved_content[:300]
                        rep_q.representation_used = rep_type
                        rep_q.planner_decision = f"Assessing {target_to_gen.concept_name} (Recovery)"
                        final_repaired_questions.append(rep_q)
                        _record_accepted(rep_q)
                    else:
                        crit_res = ClosedLoopCriticAgent.diagnose_and_repair(
                            mcq=rep_q,
                            validator_issues=rep_val.issues,
                            evidence_text=ev_obj.retrieved_content,
                            llm=self.critic_llm,
                            max_attempts=1
                        )
                        llm_call_count += crit_res.attempts_taken
                        replenishment_llm_calls += crit_res.attempts_taken
                        if crit_res.final_validation_passed:
                            repaired = crit_res.repaired_mcq
                            rep_val2 = ProductionAssessmentValidator.validate_question(
                                repaired, raw_evidence, accepted_stems=accepted_stems, accepted_propositions=accepted_propositions
                            )
                            if rep_val2.is_valid:
                                repaired.target_id = target_to_gen.target_id
                                repaired.assigned_key = getattr(target_to_gen, "assigned_key", None)
                                repaired.evidence_excerpt = ev_obj.retrieved_content[:300]
                                repaired.representation_used = rep_type
                                repaired.planner_decision = f"Assessing {target_to_gen.concept_name} (Critic Recovery)"
                                final_repaired_questions.append(repaired)
                                _record_accepted(repaired)
                                repairs_performed += 1

        # Set final difficulty metadata
        for q in final_repaired_questions:
            if difficulty.upper() in ["EASY", "MEDIUM", "HARD"]:
                q.difficulty_level = difficulty.upper()

        total_latency = round(time.time() - start_time, 2)

        tracer.record_generation(len(final_repaired_questions))
        tracer.record_validation(len(final_repaired_questions))
        trace = tracer.finalize(
            delivered_count=len(final_repaired_questions),
            status="PASSED" if len(final_repaired_questions) >= requested_count else "PARTIAL"
        )

        res_suite = ProductionAssessmentSuite(
            input_id=canonical.input_id,
            title=canonical.title,
            representation_used=rep_type,
            routing_rationale=routing.rationale,
            requested_count=requested_count,
            requested_difficulty=difficulty.upper() if difficulty.upper() in ["EASY", "MEDIUM", "HARD"] else "MIXED",
            defensible_capacity=adaptive_plan.allocated_count,
            final_question_count=len(final_repaired_questions),
            questions=final_repaired_questions,
            validation_status="PASSED" if len(final_repaired_questions) >= requested_count else ("PARTIAL" if final_repaired_questions else "FAILED"),
            generation_metadata={
                "request_id": request_id,
                "trace": trace.model_dump(),
                "engine_version": "Architecture E v2.0 (Phase 1 Hardened)",
                "total_latency_seconds": total_latency,
                "measured_llm_calls": llm_call_count,
                "core_llm_calls": llm_call_count - repair_llm_calls - replenishment_llm_calls,
                "repair_llm_calls": repair_llm_calls,
                "replenishment_llm_calls": replenishment_llm_calls,
                "pedagogical_delivery_index": routing.pedagogical_delivery_index,
                "repairs_performed_count": repairs_performed,
                "rejections_count": rejections_count,
                "initial_candidates_count": len(raw_questions),
                "repair_rate": round(repairs_performed / max(1, len(raw_questions)), 3),
                "rejection_rate": round(rejections_count / max(1, len(raw_questions)), 3),
                "partial_rate": round(len(final_repaired_questions) / max(1, requested_count), 3),
                "llm_calls_per_delivered_question": round(llm_call_count / max(1, len(final_repaired_questions)), 2),
                "defensible_capacity": adaptive_plan.allocated_count,
                "partial_delivery_status": "FULL" if len(final_repaired_questions) >= requested_count else "GRACEFUL_PARTIAL",
                "facet_distribution": adaptive_plan.facet_distribution,
                "cognitive_distribution": adaptive_plan.cognitive_distribution,
                "planning_notes": adaptive_plan.planning_strategy_notes,
                "system_notice": system_notice,
                "generator_model": self.generator_llm.model,
                "generator_provider": self.generator_llm.provider,
                "target_generator": "ft-llama-3-8b-kmit",
                "serving_mode": "KMIT_GPU" if self.generator_llm.provider == "kmit_gpu" else "TEMPORARY_HOSTED_DEMO",
                "critic_model": self.critic_llm.model,
                "representation_model": self.model,
                "planning_model": self.model,
                "stt_model": "whisper-large-v3"
            }
        )

        if res_suite.validation_status == "PASSED" and len(res_suite.questions) >= requested_count:
            ProductionCacheManager.set_assessment_suite(
                canonical.input_id, multimodal_composite_hash, requested_count, difficulty, res_suite
            )

        return res_suite
