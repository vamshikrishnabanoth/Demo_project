"""
Production Engine CLI: Interactive Command Line Tool for Teachers (Architecture E v2.0).
Usage:
  python production_engine/cli.py --input_id input_01_daa_unit2 --questions 5 --difficulty HARD
  python production_engine/cli.py --input_id input_10_binary_trees_audio_ppt --questions 10 --difficulty MIXED
  python production_engine/cli.py --transcript_file pipeline_experiment/data/transcripts/deepa_madam_transcript.json --questions 10 --difficulty EASY
"""

import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json
import argparse

from production_engine.core_engine_v2 import AdaptiveAssessmentEngineV2
from production_engine.ingestion.content_processor import ProductionContentProcessor
from pipeline_experiment.scripts.run_single import load_canonical_input


def main():
    parser = argparse.ArgumentParser(description="Adaptive Representation Assessment Engine CLI (Architecture E v2.0)")
    parser.add_argument("--input_id", default="input_01_daa_unit2", help="Input ID to process from metadata")
    parser.add_argument("--transcript_file", default=None, help="Path to raw transcript JSON file (e.g. deepa_madam_transcript.json)")
    parser.add_argument("--questions", type=int, default=5, help="Requested question count (e.g. 5, 10, 20)")
    parser.add_argument("--difficulty", default="MIXED", choices=["EASY", "MEDIUM", "HARD", "MIXED"], help="Target difficulty level")
    parser.add_argument("--provider", default="groq", help="LLM Provider (groq, openai, local)")
    parser.add_argument("--model", default="qwen/qwen3.8-27b", help="LLM Model ID")
    args = parser.parse_args()

    transcript_data = None

    if args.transcript_file and os.path.exists(args.transcript_file):
        with open(args.transcript_file, "r", encoding="utf-8") as f:
            transcript_data = json.load(f)
        basename = os.path.basename(args.transcript_file).replace(".json", "")
        canonical = ProductionContentProcessor.process_raw_input(
            input_id=basename,
            title=f"Classroom Lecture: {basename}",
            input_type="VOICE_ONLY",
            content_style="PROBLEM_SOLVING",
            transcript_data=transcript_data
        )
        title = canonical.title
    else:
        # Load from metadata
        metadata_files = [
            "pipeline_experiment/data/metadata.json",
            "pipeline_experiment/data/unseen_metadata.json"
        ]
        target_meta = None
        for mf in metadata_files:
            if os.path.exists(mf):
                with open(mf, "r", encoding="utf-8") as f:
                    items = json.load(f)
                    for it in items:
                        if it["input_id"] == args.input_id:
                            target_meta = it
                            break
            if target_meta:
                break

        if not target_meta:
            print(f"Error: input_id '{args.input_id}' not found in metadata.")
            return

        canonical = load_canonical_input(target_meta)
        title = target_meta['title']

    print("=" * 115)
    print("ADAPTIVE REPRESENTATION ASSESSMENT ENGINE (ARCHITECTURE E v2.0)")
    print(f"Target: [{title}]")
    print(f"Requested Questions: {args.questions} | Difficulty: {args.difficulty} | LLM: {args.provider} ({args.model})")
    print("=" * 115)

    engine = AdaptiveAssessmentEngineV2(provider=args.provider, model=args.model, temperature=0.2)
    suite = engine.generate_assessment(
        canonical=canonical,
        transcript_data=transcript_data,
        requested_count=args.questions,
        difficulty=args.difficulty
    )

    print(f"\n>>> [1. ROUTER DECISION]: {suite.representation_used}")
    print(f"    Rationale: {suite.routing_rationale}")
    print(f"    Pedagogical Delivery Index (PDI): {suite.generation_metadata.get('pedagogical_delivery_index', 0.0):.3f}")
    print(f"    Capacity Estimate: {suite.defensible_capacity} questions | Generated: {suite.final_question_count} questions")
    
    facets = suite.generation_metadata.get("facet_distribution", {})
    if facets:
        print(f"    12-Facet Plan Distribution: {facets}")
    
    calls = suite.generation_metadata.get("measured_llm_calls", 0)
    print(f"    Execution: {calls} LLM calls in {suite.generation_metadata['total_latency_seconds']}s | Validation: {suite.validation_status}")

    print("\n" + "=" * 115)
    print("FINAL TEACHER-GROUNDED ASSESSMENT SUITE")
    print("=" * 115)

    for idx, q in enumerate(suite.questions):
        print(f"\nQ{idx+1} [{q.difficulty_level} - Bloom: {q.cognitive_level}]: {q.question_text}")
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

    # Save to disk
    os.makedirs("production_engine/outputs", exist_ok=True)
    out_file = f"production_engine/outputs/{canonical.input_id}_{args.difficulty.lower()}_assessment.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(suite.model_dump(), f, indent=2)
    print(f"Saved assessment suite to: {out_file}\n")


if __name__ == "__main__":
    main()
