"""
Comparative Benchmark: Flat RAG (Frozen Architecture E) vs. Hierarchical Parent-Child RAG
Evaluates retrieval precision, narrative context sufficiency, and generated question quality
with all other pipeline components (Router, Planner, Generator, Validator, LLM) strictly frozen.
"""

import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json
import time
import pypdf
from typing import Dict, Any, List

from pipeline_experiment.generator.llm_engine import UnifiedLLMEngine
from production_engine.ingestion.content_processor import ProductionContentProcessor
from production_engine.retrieval.evidence_retriever import ProductionEvidenceRetriever
from production_engine.planner import ProductionAssessmentPlanner
from production_engine.generator import ProductionMCQGenerator
from production_engine.validator import ProductionAssessmentValidator
from production_engine.router import ProductionRouter
from production_engine.extractors.summary_extractor import ProductionSummaryExtractor
from production_engine.extractors.blueprint_extractor import ProductionBlueprintExtractor
from production_engine.extractors.unified_synthesizer import ProductionUnifiedSynthesizer

from production_engine.experimental.hierarchical_rag.hierarchical_chunker import HierarchicalChunker
from production_engine.experimental.hierarchical_rag.hierarchical_retriever import HierarchicalRetriever


def extract_pdf_text(path: str) -> str:
    reader = pypdf.PdfReader(path)
    return "\n\n".join([p.extract_text() or "" for p in reader.pages])


def run_hierarchical_vs_flat_benchmark():
    print("="*75)
    print("EXPERIMENT 1 BENCHMARK: FLAT RAG (FROZEN E) vs. HIERARCHICAL PARENT-CHILD RAG")
    print("="*75)

    llm = UnifiedLLMEngine(provider="groq", model="qwen/qwen3.8-27b", temperature=0.2)

    test_lectures = [
        {
            "id": "BENCH_01_DAA",
            "title": "DAA: Binary Search on Median of Two Sorted Arrays",
            "type": "VOICE_ONLY",
            "style": "PROBLEM_SOLVING",
            "transcript_path": "pipeline_experiment/data/transcripts/day13_daa_median_transcript.json",
            "slides_path": None
        },
        {
            "id": "BENCH_02_VAE",
            "title": "Deep Learning: Variational Autoencoders (Fashion-MNIST)",
            "type": "VOICE_PLUS_PPT",
            "style": "PROBLEM_SOLVING",
            "transcript_path": "pipeline_experiment/data/transcripts/ashamam_vae_transcript.json",
            "slides_path": "Audio/voice+ppt/Ashamam_VAE/CSE-AI-MODULE2-EX3_VAE_FASHIONMNIST.pdf"
        },
        {
            "id": "BENCH_03_ML",
            "title": "Machine Learning: Supervised Model Training (Prof. Madhurika)",
            "type": "VOICE_ONLY",
            "style": "CONCEPTUAL",
            "transcript_path": "pipeline_experiment/data/transcripts/ml_madhurikamam_transcript.json",
            "slides_path": None
        }
    ]

    benchmark_comparison = {}

    for lec in test_lectures:
        print(f"\n" + "="*65)
        print(f"Evaluating Lecture: {lec['title']} ({lec['type']})")
        print("="*65)

        with open(lec["transcript_path"], "r", encoding="utf-8") as f:
            transcript_data = json.load(f)

        slides_text = None
        if lec.get("slides_path") and os.path.exists(lec["slides_path"]):
            slides_text = extract_pdf_text(lec["slides_path"])

        # 1. Ingest Canonical Representation for Flat Architecture E
        canonical = ProductionContentProcessor.process_raw_input(
            input_id=lec["id"],
            title=lec["title"],
            input_type=lec["type"],
            content_style=lec["style"],
            transcript_data=transcript_data,
            supporting_text=slides_text
        )

        # 2. Build Hierarchical Evidence Store for Branch 1
        hier_store = HierarchicalChunker.build_store(canonical, transcript_data=transcript_data)
        print(f"Hierarchical Index Built: {len(hier_store.parents)} Parent Windows & {len(hier_store.children)} Child Chunks.")

        # 3. Upfront Routing & Extraction (Frozen Baseline Steps)
        routing = ProductionRouter.route(canonical)
        rep_type = routing.selected_representation
        summary, blueprint = None, None

        if rep_type == "SUMMARY":
            summary = ProductionSummaryExtractor.extract(canonical, llm)
        elif rep_type == "BLUEPRINT":
            blueprint = ProductionBlueprintExtractor.extract(canonical, llm)
        elif rep_type == "UNIFIED":
            summary, blueprint = ProductionUnifiedSynthesizer.extract_both(canonical, llm)

        # 4. Plan Assessment Targets (Frozen Baseline Planner, Medium Tier)
        plan = ProductionAssessmentPlanner.plan_assessment(
            canonical=canonical,
            representation_type=rep_type,
            requested_count=2,
            llm=llm,
            summary=summary,
            blueprint=blueprint,
            difficulty="MEDIUM"
        )
        print(f"Assessment Plan Generated: {len(plan.targets)} Targets allocated.")

        # =====================================================================
        # METHOD A: FLAT RAG RETRIEVAL & GENERATION (FROZEN BASELINE E)
        # =====================================================================
        print("\n--- Running Method A: Flat RAG (Frozen Architecture E Baseline) ---")
        t0 = time.time()
        flat_retrieved_map = ProductionEvidenceRetriever.retrieve_for_plan(canonical, plan.targets)
        
        flat_questions_raw = ProductionMCQGenerator.generate_questions(
            canonical=canonical,
            plan=plan,
            llm=llm,
            retrieved_evidence_map=flat_retrieved_map
        )
        raw_evidence_flat = (canonical.raw_content or "") + "\n" + (canonical.supporting_materials_text or "")
        valid_flat_q, status_flat = ProductionAssessmentValidator.validate_suite(flat_questions_raw, raw_evidence_flat)
        lat_flat = round(time.time() - t0, 1)

        # =====================================================================
        # METHOD B: HIERARCHICAL RAG RETRIEVAL & GENERATION (EXPERIMENTAL BRANCH 1)
        # =====================================================================
        print("\n--- Running Method B: Hierarchical Parent-Child RAG (Branch 1) ---")
        t0 = time.time()
        hier_retrieved_map = HierarchicalRetriever.retrieve_for_plan(hier_store, plan.targets)
        
        # Adapt hierarchical map to generator interface
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

        hier_questions_raw = ProductionMCQGenerator.generate_questions(
            canonical=canonical,
            plan=plan,
            llm=llm,
            retrieved_evidence_map=adapted_hier_map
        )
        valid_hier_q, status_hier = ProductionAssessmentValidator.validate_suite(hier_questions_raw, raw_evidence_flat)
        lat_hier = round(time.time() - t0, 1)

        # Measure Comparative Metrics
        flat_avg_context_words = sum(len(ev.retrieved_content.split()) for ev in flat_retrieved_map.values()) / max(1, len(flat_retrieved_map))
        hier_avg_context_words = sum(h.parent_context_length_words for h in hier_retrieved_map.values()) / max(1, len(hier_retrieved_map))

        benchmark_comparison[lec["id"]] = {
            "title": lec["title"],
            "modality": lec["type"],
            "flat_rag": {
                "avg_context_words": round(flat_avg_context_words, 1),
                "latency_seconds": lat_flat,
                "valid_questions_count": len(valid_flat_q),
                "validation_status": status_flat,
                "sample_question": valid_flat_q[0].model_dump() if valid_flat_q else None
            },
            "hierarchical_rag": {
                "avg_parent_context_words": round(hier_avg_context_words, 1),
                "latency_seconds": lat_hier,
                "valid_questions_count": len(valid_hier_q),
                "validation_status": status_hier,
                "sample_question": valid_hier_q[0].model_dump() if valid_hier_q else None
            }
        }

        print(f"\nComparison for {lec['id']}:")
        print(f"  Flat RAG Context: {flat_avg_context_words:.0f} words | Latency: {lat_flat}s | Valid Questions: {len(valid_flat_q)}")
        print(f"  Hierarchical RAG Context: {hier_avg_context_words:.0f} words | Latency: {lat_hier}s | Valid Questions: {len(valid_hier_q)}")

    out_file = "production_engine/outputs/hierarchical_vs_flat_benchmark_results.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(benchmark_comparison, f, indent=2)

    print("\n" + "="*75)
    print(f"Experiment 1 Complete! Benchmark saved to: {out_file}")
    print("="*75)


if __name__ == "__main__":
    run_hierarchical_vs_flat_benchmark()
