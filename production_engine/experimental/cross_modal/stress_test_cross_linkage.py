"""
Experiment 2: Cross-Material Linkage Stress-Test Harness
Evaluates whether current cross-modal retrieval fails on complex multimodal edge cases:
- Case 1: Disconnected Terminology (Spoken colloquialism vs Slide formal math)
- Case 2: Code Syntax Symbol Anchoring (Spoken "layer definition" vs Slide Python code)
- Case 3: Brief Dwell-Time Slides (Dense slide text with short audio duration)
- Case 4: Multi-Slide Distributed Concept (Concept spread across multiple non-adjacent slides)
"""

import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json
import pypdf
from typing import Dict, Any, List

from pipeline_experiment.generator.llm_engine import UnifiedLLMEngine
from production_engine.ingestion.content_processor import ProductionContentProcessor
from production_engine.retrieval.evidence_retriever import ProductionEvidenceRetriever
from production_engine.schemas import AssessmentTarget


def extract_pdf_slides(pdf_path: str) -> str:
    reader = pypdf.PdfReader(pdf_path)
    slides = []
    for idx, page in enumerate(reader.pages):
        text = page.extract_text()
        if text:
            slides.append(f"--- Slide {idx+1} ---\n{text.strip()}")
    return "\n\n".join(slides)


def run_cross_material_stress_test():
    print("="*75)
    print("EXPERIMENT 2: CROSS-MATERIAL LINKAGE STRESS-TEST (MULTIMODAL EDGE CASES)")
    print("="*75)

    audio_json = "pipeline_experiment/data/transcripts/ashamam_vae_transcript.json"
    slide_pdf = "Audio/voice+ppt/Ashamam_VAE/CSE-AI-MODULE2-EX3_VAE_FASHIONMNIST.pdf"

    if not os.path.exists(audio_json) or not os.path.exists(slide_pdf):
        print("Missing required multimodal files for stress test!")
        return

    with open(audio_json, "r", encoding="utf-8") as f:
        transcript_data = json.load(f)

    slide_text = extract_pdf_slides(slide_pdf)

    # Ingest multimodal lecture
    canonical = ProductionContentProcessor.process_raw_input(
        input_id="STRESS_TEST_VAE_MULTIMODAL",
        title="Variational Autoencoders: Cross-Modal Alignment Stress Test",
        input_type="VOICE_PLUS_PPT",
        content_style="PROBLEM_SOLVING",
        transcript_data=transcript_data,
        supporting_text=slide_text
    )

    audio_chunks = [c for c in canonical.chunks if c.source_type == "TRANSCRIPT"]
    slide_chunks = [c for c in canonical.chunks if c.source_type == "SLIDE"]
    print(f"Ingested {len(audio_chunks)} Spoken Audio Chunks and {len(slide_chunks)} Slide Visual Chunks.")

    # 4 Hard Multimodal Stress Test Targets
    stress_targets = [
        {
            "case_id": "CASE_01_DISCONNECTED_TERMINOLOGY",
            "name": "Disconnected Terminology: Spoken 'Squeeze / Bottleneck' vs Slide 'Latent Dimensionality'",
            "target": AssessmentTarget(
                target_id="T_STRESS_01",
                concept_name="Latent Space Bottleneck & Dimensionality",
                what_taught="The instructor verbally referred to squeezing the input into a bottleneck, while the slide formally defines latent dimension size as 10 or 16.",
                why_assessed="Tests if retrieval connects casual spoken analogies to formal slide parameter definitions.",
                cognitive_level="UNDERSTAND",
                difficulty_level="MEDIUM"
            ),
            "expected_modalities": ["AUDIO", "SLIDE"]
        },
        {
            "case_id": "CASE_02_CODE_SYMBOL_ANCHORING",
            "name": "Code Syntax Anchoring: Custom Keras Sampling Layer",
            "target": AssessmentTarget(
                target_id="T_STRESS_02",
                concept_name="Custom Keras Sampling Layer Implementation",
                what_taught="class Sampling(layers.Layer) with call method computing z = z_mean + tf.exp(0.5 * z_log_var) * epsilon.",
                why_assessed="Tests if retrieval successfully pulls the exact slide code cell when the concept is primarily visual code.",
                cognitive_level="APPLY",
                difficulty_level="HARD"
            ),
            "expected_modalities": ["SLIDE"]
        },
        {
            "case_id": "CASE_03_BRIEF_DWELL_TIME_FORMULA",
            "name": "Brief Dwell-Time Formula: KL Divergence Mathematical Formulation",
            "target": AssessmentTarget(
                target_id="T_STRESS_03",
                concept_name="KL Divergence Formula & Regularization Loss",
                what_taught="KL Loss = -0.5 * sum(1 + log_var - mu^2 - exp(log_var)), which regularizes the latent distribution to standard normal N(0,1).",
                why_assessed="Tests if retrieval can locate the mathematical loss formula on slides even if the spoken audio was brief.",
                cognitive_level="ANALYZE",
                difficulty_level="HARD"
            ),
            "expected_modalities": ["AUDIO", "SLIDE"]
        },
        {
            "case_id": "CASE_04_CONV2D_TENSOR_RESYMMETRY",
            "name": "Multi-Slide Architectural Symmetry: Conv2D Transpose Decoder Reconstruction",
            "target": AssessmentTarget(
                target_id="T_STRESS_04",
                concept_name="Conv2DTranspose Decoder Reconstruction",
                what_taught="The decoder mirrors the encoder layers using Conv2DTranspose (e.g. 64 -> 32 -> 1) with sigmoid output activation to reconstruct 28x28 images.",
                why_assessed="Tests if retrieval links encoder slide specs with decoder slide specs across different slides.",
                cognitive_level="APPLY",
                difficulty_level="MEDIUM"
            ),
            "expected_modalities": ["AUDIO", "SLIDE"]
        }
    ]

    from production_engine.experimental.cross_modal.cross_material_aligner import CrossMaterialAligner
    alignment_graph = CrossMaterialAligner.build_alignment_graph(canonical)
    print(f"Built Cross-Material Alignment Graph with {len(alignment_graph)} bidirectional nodes.")

    results_baseline = []
    results_aligned = []
    passed_baseline = 0
    passed_aligned = 0

    print("\n--- Testing Condition A: Standard Flat RAG vs Condition B: Graph-Aligned RAG ---")
    for st in stress_targets:
        target = st["target"]
        retrieved_ev = ProductionEvidenceRetriever.retrieve_for_target(canonical, target, top_k=3)
        
        # Baseline check
        has_audio_base = any(eid.startswith("E_C") for eid in retrieved_ev.evidence_ids)
        has_slide_base = any(eid.startswith("E_SLIDE") for eid in retrieved_ev.evidence_ids)
        exp = st["expected_modalities"]

        success_base = True
        if "AUDIO" in exp and not has_audio_base:
            success_base = False
        if "SLIDE" in exp and not has_slide_base:
            success_base = False
        if success_base:
            passed_baseline += 1

        # Graph-Aligned check
        expanded_eids = CrossMaterialAligner.expand_evidence_with_alignment(
            canonical, retrieved_ev.evidence_ids, alignment_graph
        )
        has_audio_aligned = any(eid.startswith("E_C") for eid in expanded_eids)
        has_slide_aligned = any(eid.startswith("E_SLIDE") for eid in expanded_eids)

        success_aligned = True
        if "AUDIO" in exp and not has_audio_aligned:
            success_aligned = False
        if "SLIDE" in exp and not has_slide_aligned:
            success_aligned = False
        if success_aligned:
            passed_aligned += 1

        print(f"\n[{st['case_id']}] {st['name']}")
        print(f"  Standard RAG Citations:     {retrieved_ev.evidence_ids} -> {'[PASS]' if success_base else '[FAIL (Modality Dropped)]'}")
        print(f"  Graph-Aligned Citations:    {expanded_eids} -> {'[PASS]' if success_aligned else '[FAIL]'}")

    rate_base = round((passed_baseline / len(stress_targets)) * 100, 1)
    rate_aligned = round((passed_aligned / len(stress_targets)) * 100, 1)

    print("\n" + "="*75)
    print(f"EXPERIMENT 2 BENCHMARK RESULTS:")
    print(f"  Condition A (Standard RAG Baseline):     {passed_baseline}/{len(stress_targets)} ({rate_base}%)")
    print(f"  Condition B (Graph-Aligned Enhancement): {passed_aligned}/{len(stress_targets)} ({rate_aligned}%)")
    print("="*75)

    out_file = "production_engine/outputs/cross_material_stress_test_results.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump({
            "test": "Experiment 2: Cross-Material Linkage Stress-Test",
            "total_cases": len(stress_targets),
            "passed_baseline": passed_baseline,
            "passed_aligned": passed_aligned,
            "success_rate_baseline_percentage": rate_base,
            "success_rate_aligned_percentage": rate_aligned
        }, f, indent=2)


if __name__ == "__main__":
    run_cross_material_stress_test()
