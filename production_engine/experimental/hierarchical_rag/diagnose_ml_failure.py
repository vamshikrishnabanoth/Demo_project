"""
Diagnostic script to investigate the single question failure on ML lecture
under Hierarchical RAG.
"""

import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json

from pipeline_experiment.generator.llm_engine import UnifiedLLMEngine
from production_engine.ingestion.content_processor import ProductionContentProcessor
from production_engine.planner import ProductionAssessmentPlanner
from production_engine.generator import ProductionMCQGenerator
from production_engine.validator import ProductionAssessmentValidator
from production_engine.router import ProductionRouter
from production_engine.extractors.summary_extractor import ProductionSummaryExtractor
from production_engine.experimental.hierarchical_rag.hierarchical_chunker import HierarchicalChunker
from production_engine.experimental.hierarchical_rag.hierarchical_retriever import HierarchicalRetriever


def diagnose():
    print("="*70)
    print("DIAGNOSING ML LECTURE REGRESSION (BENCH_03_ML)")
    print("="*70)

    transcript_path = "pipeline_experiment/data/transcripts/ml_madhurikamam_transcript.json"
    with open(transcript_path, "r", encoding="utf-8") as f:
        transcript_data = json.load(f)

    llm = UnifiedLLMEngine(provider="groq", model="qwen/qwen3.8-27b", temperature=0.2)

    canonical = ProductionContentProcessor.process_raw_input(
        input_id="BENCH_03_ML",
        title="Machine Learning: Supervised Model Training (Prof. Madhurika)",
        input_type="VOICE_ONLY",
        content_style="CONCEPTUAL",
        transcript_data=transcript_data
    )

    hier_store = HierarchicalChunker.build_store(canonical, transcript_data=transcript_data)
    summary = ProductionSummaryExtractor.extract(canonical, llm)

    plan = ProductionAssessmentPlanner.plan_assessment(
        canonical=canonical,
        representation_type="SUMMARY",
        requested_count=2,
        llm=llm,
        summary=summary,
        difficulty="MEDIUM"
    )

    hier_retrieved_map = HierarchicalRetriever.retrieve_for_plan(hier_store, plan.targets)
    
    adapted_hier_map = {}
    for t_id, h_ev in hier_retrieved_map.items():
        from production_engine.retrieval.evidence_retriever import RetrievedEvidence
        adapted_hier_map[t_id] = RetrievedEvidence(
            target_id=h_ev.target_id,
            concept_name=h_ev.concept_name,
            primary_chunk_id=h_ev.matched_child_ids[0] if h_ev.matched_child_ids else "C_01",
            evidence_ids=h_ev.matched_child_ids,
            time_spans_text=h_ev.citation_spans_text,
            retrieved_content=h_ev.retrieved_content,
            relevance_score=h_ev.relevance_score
        )

    print("\n--- Generating Questions with Hierarchical Context ---")
    raw_questions = ProductionMCQGenerator.generate_questions(
        canonical=canonical,
        plan=plan,
        llm=llm,
        retrieved_evidence_map=adapted_hier_map
    )

    print(f"\nGenerated {len(raw_questions)} Raw Candidate MCQs:")
    raw_evidence = canonical.raw_content or ""

    for idx, q in enumerate(raw_questions):
        print(f"\n--- Inspecting Raw Question {idx+1} ---")
        print(f"Stem: {q.question_text[:120]}...")
        print(f"Options: A) {q.option_a[:40]} | B) {q.option_b[:40]} | C) {q.option_c[:40]} | D) {q.option_d[:40]}")
        print(f"Correct Option: {q.correct_option}")
        print(f"Evidence Refs: {q.evidence_refs}")
        print(f"What Taught: '{q.what_taught}'")
        print(f"Misconception Rationale: '{q.misconception_rationale[:60]}...'")

        res = ProductionAssessmentValidator.validate_question(q, raw_evidence)
        print(f"Validation Passed: {res.is_valid}")
        if not res.is_valid:
            print(f"Issues Flagged: {res.issues}")


if __name__ == "__main__":
    diagnose()
