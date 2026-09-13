"""
End-to-End Comparative Validation Benchmark:
Architecture E v1.0 (Frozen Baseline) vs. Architecture E v2.0 (Integrated Candidate)
Evaluates output fulfillment (Q=5), cognitive depth, cross-material grounding,
and surgical repair resilience across Voice-Only, Voice+PPT, and Static PDF modalities.
"""

import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json
import time
import pypdf
from typing import Dict, Any

from production_engine.ingestion.content_processor import ProductionContentProcessor
from production_engine.core_engine import AdaptiveAssessmentEngine
from production_engine.core_engine_v2 import AdaptiveAssessmentEngineV2


def extract_pdf_text(path: str) -> str:
    reader = pypdf.PdfReader(path)
    return "\n\n".join([f"--- Slide {idx+1} ---\n{p.extract_text() or ''}" for idx, p in enumerate(reader.pages)])


def run_v1_vs_v2_benchmark():
    print("="*75)
    print("FINAL END-TO-END VALIDATION: ARCHITECTURE E v1.0 vs. ARCHITECTURE E v2.0")
    print("="*75)

    engine_v1 = AdaptiveAssessmentEngine(provider="groq", model="qwen/qwen3.8-27b", temperature=0.2)
    engine_v2 = AdaptiveAssessmentEngineV2(provider="groq", model="qwen/qwen3.8-27b", temperature=0.2)

    test_datasets = [
        {
            "id": "EVAL_01_DAA",
            "title": "DAA: Binary Search on Median of Two Sorted Arrays",
            "type": "VOICE_ONLY",
            "style": "PROBLEM_SOLVING",
            "transcript_path": "pipeline_experiment/data/transcripts/day13_daa_median_transcript.json",
            "slides_path": None,
            "requested_q": 5,
            "requested_difficulty": "HARD"
        },
        {
            "id": "EVAL_02_VAE",
            "title": "Deep Learning: Variational Autoencoders (Fashion-MNIST)",
            "type": "VOICE_PLUS_PPT",
            "style": "PROBLEM_SOLVING",
            "transcript_path": "pipeline_experiment/data/transcripts/ashamam_vae_transcript.json",
            "slides_path": "Audio/voice+ppt/Ashamam_VAE/CSE-AI-MODULE2-EX3_VAE_FASHIONMNIST.pdf",
            "requested_q": 5,
            "requested_difficulty": "MEDIUM"
        },
        {
            "id": "EVAL_03_PDF",
            "title": "Computer Vision: Faster R-CNN vs. YOLO Handout",
            "type": "PDF",
            "style": "CONCEPTUAL",
            "transcript_path": None,
            "slides_path": "notes/unit 2.pdf",
            "raw_text_fallback": (
                "Object Detection Architectures: YOLO vs Fast R-CNN.\n"
                "1. YOLO (You Only Look Once): Single-stage object detector. Performs bounding box regression and classification simultaneously in one single forward pass. Extremely fast inference time, suitable for real-time video streams.\n"
                "2. Fast R-CNN: Two-stage detector. Generates candidate region proposals first (via Selective Search / RPN), then extracts RoI features and classifies each proposal. Higher computational latency and slower inference due to region proposal bottleneck.\n"
                "3. Penn-Fudan Pedestrian Dataset Preprocessing: Native annotations contain pixel-level segmentation masks. To feed into Fast R-CNN, masks must be converted to rectangular bounding boxes [x1, y1, x2, y2]. Image tensors are normalized by dividing by 255.0 after permuting dimensions to (C, H, W)."
            ),
            "requested_q": 5,
            "requested_difficulty": "EASY"
        }
    ]

    bloom_rank = {"REMEMBER": 1, "UNDERSTAND": 2, "APPLY": 3, "ANALYZE": 4, "EVALUATE": 5, "CREATE": 6}
    final_benchmark_results = {}

    for ds in test_datasets:
        print(f"\n" + "="*65)
        print(f"Benchmarking Modality: {ds['title']} ({ds['type']})")
        print(f"Request: {ds['requested_q']} questions at {ds['requested_difficulty']} difficulty")
        print("="*65)

        transcript_data = None
        if ds.get("transcript_path") and os.path.exists(ds["transcript_path"]):
            with open(ds["transcript_path"], "r", encoding="utf-8") as f:
                transcript_data = json.load(f)

        slides_text = None
        if ds.get("slides_path") and os.path.exists(ds["slides_path"]):
            slides_text = extract_pdf_text(ds["slides_path"])

        canonical = ProductionContentProcessor.process_raw_input(
            input_id=ds["id"],
            title=ds["title"],
            input_type=ds["type"],
            content_style=ds["style"],
            transcript_data=transcript_data,
            raw_text=ds.get("raw_text_fallback", ""),
            supporting_text=slides_text
        )

        # -------------------------------------------------------------
        # RUN 1: ARCHITECTURE E v1.0 (FROZEN BASELINE)
        # -------------------------------------------------------------
        print("\n--- Running Architecture E v1.0 (Frozen Baseline) ---")
        t0 = time.time()
        suite_v1 = engine_v1.generate_assessment(
            canonical=canonical,
            requested_count=ds["requested_q"],
            difficulty=ds["requested_difficulty"]
        )
        lat_v1 = round(time.time() - t0, 1)
        mean_bloom_v1 = sum(bloom_rank.get(q.cognitive_level, 2) for q in suite_v1.questions) / max(1, len(suite_v1.questions))
        trace_v1 = sum(1 for q in suite_v1.questions if q.evidence_refs) / max(1, len(suite_v1.questions)) * 100

        # -------------------------------------------------------------
        # RUN 2: ARCHITECTURE E v2.0 (INTEGRATED CANDIDATE)
        # -------------------------------------------------------------
        print("\n--- Running Architecture E v2.0 (Integrated Candidate) ---")
        t0 = time.time()
        suite_v2 = engine_v2.generate_assessment(
            canonical=canonical,
            transcript_data=transcript_data,
            requested_count=ds["requested_q"],
            difficulty=ds["requested_difficulty"]
        )
        lat_v2 = round(time.time() - t0, 1)
        mean_bloom_v2 = sum(bloom_rank.get(q.cognitive_level, 2) for q in suite_v2.questions) / max(1, len(suite_v2.questions))
        trace_v2 = sum(1 for q in suite_v2.questions if q.evidence_refs) / max(1, len(suite_v2.questions)) * 100

        # Report comparison
        print(f"\nRESULTS FOR {ds['id']}:")
        print(f"  v1.0 (Baseline):   {len(suite_v1.questions)}/{ds['requested_q']} Questions | Mean Bloom: {mean_bloom_v1:.1f} | Traceability: {trace_v1:.0f}% | Latency: {lat_v1}s")
        print(f"  v2.0 (Integrated): {len(suite_v2.questions)}/{ds['requested_q']} Questions | Mean Bloom: {mean_bloom_v2:.1f} | Traceability: {trace_v2:.0f}% | Latency: {lat_v2}s")
        print(f"  v2.0 Metadata:     Repairs: {suite_v2.generation_metadata.get('repairs_performed_count', 0)} | Facets: {suite_v2.generation_metadata.get('facet_distribution')}")

        final_benchmark_results[ds["id"]] = {
            "title": ds["title"],
            "modality": ds["type"],
            "requested_q": ds["requested_q"],
            "requested_difficulty": ds["requested_difficulty"],
            "v1_baseline": {
                "delivered_questions": len(suite_v1.questions),
                "fulfillment_rate": (len(suite_v1.questions) / ds["requested_q"]) * 100,
                "mean_bloom_score": round(mean_bloom_v1, 2),
                "traceability_percentage": trace_v1,
                "latency_seconds": lat_v1,
                "questions": [q.model_dump() for q in suite_v1.questions]
            },
            "v2_integrated": {
                "delivered_questions": len(suite_v2.questions),
                "fulfillment_rate": (len(suite_v2.questions) / ds["requested_q"]) * 100,
                "mean_bloom_score": round(mean_bloom_v2, 2),
                "traceability_percentage": trace_v2,
                "latency_seconds": lat_v2,
                "repairs_performed": suite_v2.generation_metadata.get("repairs_performed_count", 0),
                "facet_distribution": suite_v2.generation_metadata.get("facet_distribution", {}),
                "cognitive_distribution": suite_v2.generation_metadata.get("cognitive_distribution", {}),
                "questions": [q.model_dump() for q in suite_v2.questions]
            }
        }

    out_file = "production_engine/outputs/v1_vs_v2_final_validation_results.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(final_benchmark_results, f, indent=2)

    print("\n" + "="*75)
    print(f"FINAL BENCHMARK COMPLETE! Results saved to: {out_file}")
    print("="*75)


if __name__ == "__main__":
    run_v1_vs_v2_benchmark()
