import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json

from production_engine.ingestion.content_processor import ProductionContentProcessor
from production_engine.core_engine import AdaptiveAssessmentEngine

def main():
    transcript_file = "pipeline_experiment/data/transcripts/day13_daa_median_transcript.json"
    with open(transcript_file, "r", encoding="utf-8") as f:
        transcript_data = json.load(f)

    canonical = ProductionContentProcessor.process_raw_input(
        input_id="input_22_day13_daa_median",
        title="Design & Analysis of Algorithms: Day 13 - Median of Two Sorted Arrays using Binary Search",
        input_type="VOICE_ONLY",
        content_style="PROBLEM_SOLVING",
        transcript_data=transcript_data
    )

    engine = AdaptiveAssessmentEngine(provider="groq", model="qwen/qwen3.8-27b", temperature=0.2)
    suite = engine.generate_assessment(canonical=canonical, requested_count=5)

    print(f"Generated {len(suite.questions)} questions.")
    for idx, q in enumerate(suite.questions, 1):
        print(f"\n--- Question {idx} ({q.cognitive_level}) ---")
        print(f"Stem: {q.question_text}")
        print(f"What Taught: {q.what_taught}")
        print(f"Why Assessed: {q.why_assessed}")
        print(f"Evidence: {q.evidence_refs}")

if __name__ == "__main__":
    main()
