"""
Cross-Input Modality x Difficulty Validation Matrix
Evaluates Architecture E across:
- Modalities: VOICE_ONLY, VOICE_PLUS_PPT, STATIC_PDF
- Difficulties: EASY, MEDIUM, HARD
Verifies that instructional depth-calibrated difficulty holds across all educational modalities.
"""

import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json
import time
import pypdf
from typing import Dict, Any, List

from pipeline_experiment.generator.llm_engine import UnifiedLLMEngine
from production_engine.core_engine import AdaptiveAssessmentEngine
from production_engine.ingestion.content_processor import ProductionContentProcessor


def extract_pdf_text(path: str) -> str:
    reader = pypdf.PdfReader(path)
    return "\n\n".join([p.extract_text() or "" for p in reader.pages])


def run_cross_input_difficulty_matrix():
    print("="*75)
    print("CROSS-INPUT MODALITY x DIFFICULTY VALIDATION MATRIX BENCHMARK")
    print("="*75)

    engine = AdaptiveAssessmentEngine(provider="groq", model="qwen/qwen3.8-27b", temperature=0.2)

    # 3 Benchmark Modalities
    inputs = [
        {
            "id": "MODALITY_01_VOICE_ONLY",
            "title": "DAA: Binary Search on Median of Two Sorted Arrays",
            "type": "VOICE_ONLY",
            "style": "PROBLEM_SOLVING",
            "transcript": "pipeline_experiment/data/transcripts/day13_daa_median_transcript.json",
            "slides": None,
            "raw_doc": None
        },
        {
            "id": "MODALITY_02_VOICE_PLUS_PPT",
            "title": "Deep Learning: Variational Autoencoders (Fashion-MNIST)",
            "type": "VOICE_PLUS_PPT",
            "style": "PROBLEM_SOLVING",
            "transcript": "pipeline_experiment/data/transcripts/ashamam_vae_transcript.json",
            "slides": "Audio/voice+ppt/Ashamam_VAE/CSE-AI-MODULE2-EX3_VAE_FASHIONMNIST.pdf",
            "raw_doc": None
        },
        {
            "id": "MODALITY_03_PDF_STATIC",
            "title": "Computer Vision: Faster R-CNN vs YOLO Object Detection",
            "type": "PDF",
            "style": "THEORY",
            "transcript": None,
            "slides": None,
            "raw_doc": "Audio/only material/EX2-CNN-OBJECT DETECTION-FASTRCNN VS YOLO-.pdf"
        }
    ]

    difficulties = ["EASY", "MEDIUM", "HARD"]
    matrix_results = {}

    for inp in inputs:
        print(f"\n=======================================================")
        print(f"Ingesting Modality: {inp['type']} -> {inp['title']}")
        print(f"=======================================================")

        transcript_data = None
        if inp.get("transcript") and os.path.exists(inp["transcript"]):
            with open(inp["transcript"], "r", encoding="utf-8") as f:
                transcript_data = json.load(f)

        raw_doc_text = ""
        if inp.get("raw_doc") and os.path.exists(inp["raw_doc"]):
            raw_doc_text = extract_pdf_text(inp["raw_doc"])

        supp_text = ""
        if inp.get("slides") and os.path.exists(inp["slides"]):
            supp_text = extract_pdf_text(inp["slides"])

        canonical = ProductionContentProcessor.process_raw_input(
            input_id=inp["id"],
            title=inp["title"],
            input_type=inp["type"],
            content_style=inp["style"],
            transcript_data=transcript_data,
            raw_text=raw_doc_text if raw_doc_text else None,
            supporting_text=supp_text if supp_text else None
        )

        matrix_results[inp["id"]] = {
            "title": inp["title"],
            "modality": inp["type"],
            "router_decision": None,
            "pdi_score": None,
            "tiers": {}
        }

        for diff in difficulties:
            print(f"\n--- Running Tier: {diff} on {inp['type']} ---")
            t0 = time.time()
            suite = engine.generate_assessment(
                canonical=canonical,
                requested_count=2,  # 2 focused items per cell
                difficulty=diff
            )
            dur = round(time.time() - t0, 1)

            matrix_results[inp["id"]]["router_decision"] = suite.representation_used
            matrix_results[inp["id"]]["routing_rationale"] = suite.routing_rationale

            traceable = sum(1 for q in suite.questions if q.evidence_refs)
            trace_rate = round((traceable / max(1, len(suite.questions))) * 100, 1)
            cog_dist = {}
            for q in suite.questions:
                cog_dist[q.cognitive_level] = cog_dist.get(q.cognitive_level, 0) + 1

            matrix_results[inp["id"]]["tiers"][diff] = {
                "difficulty_requested": diff,
                "latency_seconds": dur,
                "question_count": len(suite.questions),
                "validation_status": suite.validation_status,
                "traceability_rate": trace_rate,
                "cognitive_distribution": cog_dist,
                "questions": [q.model_dump() for q in suite.questions]
            }

            print(f"  Finished {diff} in {dur}s | Questions: {len(suite.questions)} | Validation: {suite.validation_status} | Cog: {cog_dist}")

    out_file = "production_engine/outputs/cross_input_difficulty_matrix_results.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(matrix_results, f, indent=2)

    print("\n" + "="*75)
    print(f"Validation Matrix Complete! Results saved to: {out_file}")
    print("="*75)


if __name__ == "__main__":
    run_cross_input_difficulty_matrix()
