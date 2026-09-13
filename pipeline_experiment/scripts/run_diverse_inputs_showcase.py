"""
Diverse Inputs Benchmark & Showcase for Adaptive Assessment Engine (Architecture E)
Runs the complete production pipeline across 5 diverse educational inputs:
1. Algorithmic Problem Solving (Voice Only): DAA Median of Two Sorted Arrays
2. Multimodal Deep Learning (Voice + Slides): Variational Autoencoders (VAE)
3. Web Engineering (Voice Only): DOM Architecture & Event Lifecycle
4. Core Data Structures (Voice + Slides): Binary Trees & Traversals
5. Technical Document (Text Only): CNN Object Detection (Faster R-CNN vs YOLO)
"""

import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json
import time
import math
from typing import List, Dict, Any, Optional
import pypdf

from pipeline_experiment.generator.llm_engine import UnifiedLLMEngine
from pipeline_experiment.shared.schemas.canonical_models import CanonicalEducationalInput
from production_engine.ingestion.content_processor import ProductionContentProcessor
from production_engine.core_engine import AdaptiveAssessmentEngine
from production_engine.schemas import ProductionAssessmentSuite


def extract_text_from_pdf(pdf_path: str) -> str:
    reader = pypdf.PdfReader(pdf_path)
    text_parts = []
    for idx, page in enumerate(reader.pages):
        page_text = page.extract_text()
        if page_text:
            text_parts.append(f"--- Page {idx+1} ---\n{page_text}")
    return "\n\n".join(text_parts)


def run_benchmark_on_input(
    engine: AdaptiveAssessmentEngine,
    canonical: CanonicalEducationalInput,
    difficulty: str = "MIXED",
    requested_count: int = 5
) -> Dict[str, Any]:
    print(f"\n=======================================================")
    print(f"--- Processing Input: {canonical.title} ---")
    print(f"Modality: {canonical.input_type} | Style: {canonical.content_style} | Chunks: {len(canonical.chunks)}")
    print(f"=======================================================")

    suite: ProductionAssessmentSuite = engine.generate_assessment(
        canonical=canonical,
        requested_count=requested_count,
        difficulty=difficulty
    )

    questions = suite.questions
    total_q = len(questions)

    bloom_counts = {"REMEMBER": 0, "UNDERSTAND": 0, "APPLY": 0, "ANALYZE": 0, "EVALUATE": 0}
    for q in questions:
        lvl = q.cognitive_level.upper()
        bloom_counts[lvl] = bloom_counts.get(lvl, 0) + 1

    traceable_count = sum(1 for q in questions if q.evidence_refs and len(q.evidence_refs) > 0)
    traceability_rate = round((traceable_count / total_q) * 100, 1) if total_q > 0 else 0.0

    misconception_count = sum(1 for q in questions if q.misconception_rationale and len(q.misconception_rationale) > 10)
    misconception_rate = round((misconception_count / total_q) * 100, 1) if total_q > 0 else 0.0

    stems = [q.question_text.lower()[:45] for q in questions]
    unique_stems = len(set(stems))
    redundancy_rate = round(((total_q - unique_stems) / total_q) * 100, 1) if total_q > 0 else 0.0

    print(f"Finished {canonical.title} in {suite.generation_metadata.get('total_latency_seconds')}s")
    print(f"Router Decision: {suite.representation_used} (PDI: {suite.generation_metadata.get('pedagogical_delivery_index')})")
    print(f"Questions Generated: {total_q} | Traceability: {traceability_rate}% | Redundancy: {redundancy_rate}%")

    return {
        "input_id": canonical.input_id,
        "title": canonical.title,
        "modality": canonical.input_type,
        "content_style": canonical.content_style,
        "representation_routed": suite.representation_used,
        "routing_rationale": suite.routing_rationale,
        "pdi_score": suite.generation_metadata.get("pedagogical_delivery_index"),
        "latency_seconds": suite.generation_metadata.get("total_latency_seconds"),
        "llm_calls": suite.generation_metadata.get("measured_llm_calls"),
        "questions_generated": total_q,
        "cognitive_distribution": bloom_counts,
        "traceability_rate": traceability_rate,
        "misconception_rate": misconception_rate,
        "redundancy_rate": redundancy_rate,
        "questions": [q.model_dump() for q in suite.questions]
    }


def main():
    engine = AdaptiveAssessmentEngine(provider="groq", model="qwen/qwen3.8-27b", temperature=0.2)
    all_results = []

    # 1. Input 1: DAA - Binary Search on Median of Two Sorted Arrays (Voice Only)
    transcript_daa = "pipeline_experiment/data/transcripts/day13_daa_median_transcript.json"
    if os.path.exists(transcript_daa):
        with open(transcript_daa, "r", encoding="utf-8") as f:
            data = json.load(f)
        canonical_daa = ProductionContentProcessor.process_raw_input(
            input_id="input_01_daa_median",
            title="Design and Analysis of Algorithms: Finding Median of Two Sorted Arrays in O(log(min(N,M)))",
            input_type="VOICE_ONLY",
            content_style="PROBLEM_SOLVING",
            transcript_data=data
        )
        res_daa = run_benchmark_on_input(engine, canonical_daa, difficulty="MIXED", requested_count=5)
        all_results.append(res_daa)

    # 2. Input 2: AI & Deep Learning - Variational Autoencoders (Voice + Slides)
    transcript_vae = "pipeline_experiment/data/transcripts/ashamam_vae_transcript.json"
    slide_pdf_vae = "Audio/voice+ppt/Ashamam_VAE/CSE-AI-MODULE2-EX3_VAE_FASHIONMNIST.pdf"
    if os.path.exists(transcript_vae):
        with open(transcript_vae, "r", encoding="utf-8") as f:
            data = json.load(f)
        supporting_text = extract_text_from_pdf(slide_pdf_vae) if os.path.exists(slide_pdf_vae) else None
        canonical_vae = ProductionContentProcessor.process_raw_input(
            input_id="input_02_ai_vae_multimodal",
            title="Deep Learning: Variational Autoencoders (VAE) & Latent Space Distribution Modeling on Fashion-MNIST",
            input_type="VOICE_PLUS_PPT",
            content_style="PROBLEM_SOLVING",
            transcript_data=data,
            supporting_text=supporting_text
        )
        res_vae = run_benchmark_on_input(engine, canonical_vae, difficulty="MIXED", requested_count=5)
        all_results.append(res_vae)

    # 3. Input 3: Web Technologies - DOM Manipulation & JavaScript Events (Voice Only)
    transcript_wt = "pipeline_experiment/data/transcripts/wt_19_8_26_transcript.json"
    if os.path.exists(transcript_wt):
        with open(transcript_wt, "r", encoding="utf-8") as f:
            data = json.load(f)
        canonical_wt = ProductionContentProcessor.process_raw_input(
            input_id="input_03_wt_dom_events",
            title="Web Technologies: Document Object Model (DOM) Tree Manipulation & Event-Driven Architecture",
            input_type="VOICE_ONLY",
            content_style="CONCEPTUAL",
            transcript_data=data
        )
        res_wt = run_benchmark_on_input(engine, canonical_wt, difficulty="MIXED", requested_count=5)
        all_results.append(res_wt)

    # 4. Input 4: Data Structures - Binary Trees & Traversals (Voice + Slides)
    transcript_trees = "pipeline_experiment/data/transcripts/binary_trees_transcript.json"
    if os.path.exists(transcript_trees):
        with open(transcript_trees, "r", encoding="utf-8") as f:
            data = json.load(f)
        canonical_trees = ProductionContentProcessor.process_raw_input(
            input_id="input_04_ds_binary_trees",
            title="Data Structures & Algorithms: Binary Trees, Strict Binary Trees & Tree Traversals",
            input_type="VOICE_PLUS_PPT",
            content_style="PROBLEM_SOLVING",
            transcript_data=data
        )
        res_trees = run_benchmark_on_input(engine, canonical_trees, difficulty="MIXED", requested_count=5)
        all_results.append(res_trees)

    # 5. Input 5: Technical Document - Faster R-CNN vs YOLO (Document / Text Only)
    doc_pdf = "Audio/only material/EX2-CNN-OBJECT DETECTION-FASTRCNN VS YOLO-.pdf"
    if os.path.exists(doc_pdf):
        doc_text = extract_text_from_pdf(doc_pdf)
        canonical_doc = ProductionContentProcessor.process_raw_input(
            input_id="input_05_doc_faster_rcnn_yolo",
            title="Computer Vision: Two-Stage (Faster R-CNN) vs Single-Stage (YOLO) Object Detection Architectures",
            input_type="PDF",
            content_style="THEORY",
            raw_text=doc_text
        )
        res_doc = run_benchmark_on_input(engine, canonical_doc, difficulty="MIXED", requested_count=5)
        all_results.append(res_doc)

    out_file = "production_engine/outputs/diverse_inputs_showcase_results.json"
    os.makedirs("production_engine/outputs", exist_ok=True)
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump({
            "showcase": "Production Engine (Architecture E) Across Diverse Educational Inputs",
            "total_inputs_evaluated": len(all_results),
            "results": all_results
        }, f, indent=2)

    print(f"\n=======================================================")
    print(f"Successfully processed all {len(all_results)} diverse inputs!")
    print(f"Results saved to: {out_file}")
    print(f"=======================================================")


if __name__ == "__main__":
    main()
