"""
Run 20 MCQ Generation on Day 13 DAA: Median of Two Sorted Arrays
Using the Production Adaptive Assessment Engine (Architecture E).
"""

import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json
import time

from production_engine.ingestion.content_processor import ProductionContentProcessor
from production_engine.core_engine import AdaptiveAssessmentEngine


def main():
    transcript_file = "pipeline_experiment/data/transcripts/day13_daa_median_transcript.json"

    if not os.path.exists(transcript_file):
        print(f"Waiting for transcript file: {transcript_file}")
        return

    with open(transcript_file, "r", encoding="utf-8") as f:
        transcript_data = json.load(f)

    print("=" * 115)
    print("DAY 13 DAA LECTURE: MEDIAN OF TWO SORTED ARRAYS USING BINARY SEARCH")
    print(f"Total Audio Duration: {transcript_data.get('duration_seconds', 0.0):.1f}s (~{transcript_data.get('duration_seconds', 0.0)/60:.1f} mins)")
    print(f"Total Segments: {transcript_data.get('total_segments', 0)} | Total Words: {len(transcript_data.get('text', '').split())}")
    print("Requested MCQs: 20")
    print("=" * 115)

    # 1. Content Processing & Canonical Ingestion
    canonical = ProductionContentProcessor.process_raw_input(
        input_id="input_22_day13_daa_median",
        title="Design & Analysis of Algorithms: Day 13 - Median of Two Sorted Arrays using Binary Search",
        input_type="VOICE_ONLY",
        content_style="PROBLEM_SOLVING",
        transcript_data=transcript_data
    )

    print(f"\n>>> [1. CONTENT PROCESSING]: Created {len(canonical.chunks)} Canonical Semantic Chunks with Evidence IDs.")

    # 2. Production Engine Execution
    engine = AdaptiveAssessmentEngine(provider="groq", model="qwen/qwen3.8-27b", temperature=0.2)

    start_t = time.time()
    suite = engine.generate_assessment(canonical=canonical, requested_count=20)
    dur = round(time.time() - start_t, 2)

    print(f"\n>>> [2. ROUTER DECISION]: {suite.representation_used}")
    print(f"    Rationale: {suite.routing_rationale}")
    print(f"    PDI: {suite.generation_metadata['pedagogical_delivery_index']:.3f}")
    print(f"    Capacity Estimate: {suite.defensible_capacity} | Allocated: {suite.final_question_count} questions")
    print(f"    Execution: {suite.generation_metadata.get('measured_llm_calls', 4)} LLM calls in {dur}s | Validation: {suite.validation_status}")

    print("\n" + "=" * 115)
    print("FINAL 20 TEACHER-GROUNDED MCQs (DAY 13 DAA)")
    print("=" * 115)

    for idx, q in enumerate(suite.questions):
        print(f"\nQ{idx+1} [{q.cognitive_level}]: {q.question_text}")
        print(f"  A) {q.option_a}")
        print(f"  B) {q.option_b}")
        print(f"  C) {q.option_c}")
        print(f"  D) {q.option_d}")
        print(f"  * Correct Option: {q.correct_option}")
        print(f"  * Explanation: {q.explanation}")
        print(f"  --- TEACHER TRACEABILITY RECORD ---")
        print(f"  * What Taught: {q.what_taught}")
        print(f"  * Why Assessed: {q.why_assessed}")
        print(f"  * Evidence Refs: {', '.join(q.evidence_refs)}")
        print(f"  * Misconception Target: {q.misconception_rationale}")

    print("\n" + "=" * 115)

    # Save outputs
    os.makedirs("production_engine/outputs", exist_ok=True)
    out_path = "production_engine/outputs/day13_daa_20_mcqs.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(suite.model_dump(), f, indent=2)

    print(f"Saved complete 20 MCQ suite to: {out_path}\n")


if __name__ == "__main__":
    main()
