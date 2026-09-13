"""
Benchmark Evaluation for Experiment 3: Evidence-Aware Adaptive Planning Agent
Tests fulfillment of high question count requests (Q=10) on complex lectures
using multi-angle cognitive faceting and evidence linkage.
"""

import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json
import time
import pypdf

from pipeline_experiment.generator.llm_engine import UnifiedLLMEngine
from production_engine.ingestion.content_processor import ProductionContentProcessor
from production_engine.router import ProductionRouter
from production_engine.extractors.summary_extractor import ProductionSummaryExtractor
from production_engine.extractors.blueprint_extractor import ProductionBlueprintExtractor
from production_engine.extractors.unified_synthesizer import ProductionUnifiedSynthesizer
from production_engine.experimental.hierarchical_rag.hierarchical_chunker import HierarchicalChunker
from production_engine.experimental.cross_modal.cross_material_aligner import CrossMaterialAligner
from production_engine.experimental.planning_agent.adaptive_planning_agent import AdaptivePlanningAgent


def extract_pdf_slides(pdf_path: str) -> str:
    reader = pypdf.PdfReader(pdf_path)
    return "\n\n".join([f"--- Slide {idx+1} ---\n{p.extract_text() or ''}" for idx, p in enumerate(reader.pages)])


def run_adaptive_planning_benchmark():
    print("="*75)
    print("EXPERIMENT 3: EVIDENCE-AWARE ADAPTIVE PLANNING AGENT BENCHMARK (Q=10)")
    print("="*75)

    llm = UnifiedLLMEngine(provider="groq", model="qwen/qwen3.8-27b", temperature=0.2)

    test_scenarios = [
        {
            "id": "PLAN_BENCH_01_DAA",
            "title": "DAA: Binary Search on Median of Two Sorted Arrays",
            "type": "VOICE_ONLY",
            "style": "PROBLEM_SOLVING",
            "transcript_path": "pipeline_experiment/data/transcripts/day13_daa_median_transcript.json",
            "slides_path": None,
            "requested_q": 10,
            "requested_difficulty": "HARD"
        },
        {
            "id": "PLAN_BENCH_02_VAE",
            "title": "Deep Learning: Variational Autoencoders (Fashion-MNIST)",
            "type": "VOICE_PLUS_PPT",
            "style": "PROBLEM_SOLVING",
            "transcript_path": "pipeline_experiment/data/transcripts/ashamam_vae_transcript.json",
            "slides_path": "Audio/voice+ppt/Ashamam_VAE/CSE-AI-MODULE2-EX3_VAE_FASHIONMNIST.pdf",
            "requested_q": 10,
            "requested_difficulty": "MEDIUM"
        }
    ]

    all_results = {}

    for sc in test_scenarios:
        print(f"\n" + "="*65)
        print(f"Testing Scenario: {sc['title']} (Requested Q={sc['requested_q']}, Difficulty={sc['requested_difficulty']})")
        print("="*65)

        with open(sc["transcript_path"], "r", encoding="utf-8") as f:
            transcript_data = json.load(f)

        slides_text = None
        if sc.get("slides_path") and os.path.exists(sc["slides_path"]):
            slides_text = extract_pdf_slides(sc["slides_path"])

        # 1. Canonical Ingestion
        canonical = ProductionContentProcessor.process_raw_input(
            input_id=sc["id"],
            title=sc["title"],
            input_type=sc["type"],
            content_style=sc["style"],
            transcript_data=transcript_data,
            supporting_text=slides_text
        )

        # 2. Hierarchical Store & Cross-Material Alignment
        hier_store = HierarchicalChunker.build_store(canonical, transcript_data=transcript_data)
        alignment_graph = CrossMaterialAligner.build_alignment_graph(canonical)

        # 3. Representation Extraction
        routing = ProductionRouter.route(canonical)
        rep_type = routing.selected_representation
        summary, blueprint = None, None

        if rep_type == "SUMMARY":
            summary = ProductionSummaryExtractor.extract(canonical, llm)
        elif rep_type == "BLUEPRINT":
            blueprint = ProductionBlueprintExtractor.extract(canonical, llm)
        elif rep_type == "UNIFIED":
            summary, blueprint = ProductionUnifiedSynthesizer.extract_both(canonical, llm)

        # 4. Run Adaptive Planning Agent
        t0 = time.time()
        plan = AdaptivePlanningAgent.plan_assessment(
            canonical=canonical,
            hier_store=hier_store,
            alignment_graph=alignment_graph,
            requested_count=sc["requested_q"],
            requested_difficulty=sc["requested_difficulty"],
            llm=llm,
            summary=summary,
            blueprint=blueprint,
            representation_type=rep_type
        )
        plan_lat = round(time.time() - t0, 1)

        # 5. Measure Plan Quality & Diversity Metrics
        unique_concepts = len(set(t.concept_name for t in plan.targets))
        unique_facets = len(plan.facet_distribution)
        all_grounded = all(t.primary_evidence_id in hier_store.child_map or t.primary_evidence_id.startswith("E_") for t in plan.targets)

        print(f"\nAdaptive Plan Results for {sc['id']}:")
        print(f"  Requested Targets:     {plan.requested_count}")
        print(f"  Allocated Targets:     {plan.allocated_count} ({'100% Fulfilled' if plan.allocated_count == plan.requested_count else 'Partial'})")
        print(f"  Unique Concepts:       {unique_concepts}")
        print(f"  Unique Facets Used:    {unique_facets} ({list(plan.facet_distribution.keys())})")
        print(f"  Facet Breakdown:       {plan.facet_distribution}")
        print(f"  Cognitive Breakdown:   {plan.cognitive_distribution}")
        print(f"  All Evidence Grounded: {all_grounded}")
        print(f"  Planning Strategy:     {plan.planning_strategy_notes[:120]}...")

        # Print Sample Targets
        print("\n  Sample Planned Targets:")
        for t in plan.targets[:4]:
            print(f"    - [{t.target_id}] ({t.assessment_facet}) {t.concept_name} -> {t.cognitive_level} ({t.primary_evidence_id})")

        all_results[sc["id"]] = {
            "title": sc["title"],
            "requested_count": plan.requested_count,
            "allocated_count": plan.allocated_count,
            "fulfillment_percentage": (plan.allocated_count / plan.requested_count) * 100,
            "unique_concepts": unique_concepts,
            "unique_facets_count": unique_facets,
            "facet_distribution": plan.facet_distribution,
            "cognitive_distribution": plan.cognitive_distribution,
            "all_evidence_grounded": all_grounded,
            "planning_latency_seconds": plan_lat,
            "planning_strategy_notes": plan.planning_strategy_notes,
            "targets": [t.model_dump() for t in plan.targets]
        }

    out_file = "production_engine/outputs/adaptive_planning_agent_results.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2)

    print("\n" + "="*75)
    print(f"Experiment 3 Complete! Benchmark saved to: {out_file}")
    print("="*75)


if __name__ == "__main__":
    run_adaptive_planning_benchmark()
