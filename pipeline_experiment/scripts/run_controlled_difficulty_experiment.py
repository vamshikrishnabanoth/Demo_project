"""
Controlled Difficulty Calibration Experiment on Unseen AI Autoencoders Lecture
Runs Architecture E on the exact same Autoencoder lecture across 3 difficulty tiers:
- 10 EASY (Recall / Basic Understanding -> Direct recognition / definitions)
- 10 MEDIUM (Understand / Apply -> Procedural execution / code configurations)
- 10 HARD (Apply / Analyze / Evaluate -> Architectural trade-offs / failure modes / comparative synthesis)
"""

import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json
import time
import math
from typing import List, Dict, Any

from pipeline_experiment.generator.llm_engine import UnifiedLLMEngine
from pipeline_experiment.shared.schemas.canonical_models import CanonicalEducationalInput
from production_engine.ingestion.content_processor import ProductionContentProcessor
from production_engine.core_engine import AdaptiveAssessmentEngine
from production_engine.schemas import ProductionMCQ, ProductionAssessmentSuite


def evaluate_tier_metrics(
    suite: ProductionAssessmentSuite,
    canonical: CanonicalEducationalInput
) -> Dict[str, Any]:
    questions = suite.questions
    total_q = len(questions)
    if total_q == 0:
        return {}

    # 1. Cognitive Distribution
    bloom_counts = {"REMEMBER": 0, "UNDERSTAND": 0, "APPLY": 0, "ANALYZE": 0, "EVALUATE": 0}
    for q in questions:
        lvl = q.cognitive_level.upper()
        bloom_counts[lvl] = bloom_counts.get(lvl, 0) + 1

    # Shannon Entropy normalized to 0-100%
    entropy = 0.0
    for count in bloom_counts.values():
        if count > 0:
            p = count / total_q
            entropy -= p * math.log2(p)
    cognitive_diversity = round((entropy / math.log2(5)) * 100, 1)

    # 2. Traceability Rate
    traceable_count = sum(1 for q in questions if q.evidence_refs and len(q.evidence_refs) > 0)
    traceability_rate = round((traceable_count / total_q) * 100, 1)

    # 3. Misconception Distractor Rate
    misconception_count = sum(1 for q in questions if q.misconception_rationale and len(q.misconception_rationale) > 10)
    misconception_rate = round((misconception_count / total_q) * 100, 1)

    # 4. Teacher Intent Alignment
    teacher_intent_alignment = round((sum(1 for q in questions if q.what_taught and q.why_assessed) / total_q) * 100, 1)

    # 5. Redundancy Rate
    stems = [q.question_text.lower()[:45] for q in questions]
    unique_stems = len(set(stems))
    redundancy_rate = round(((total_q - unique_stems) / total_q) * 100, 1)

    # 6. Overall Quality Score
    grounding_score = 90.0 if traceable_count > 0 else 75.0
    overall_quality = round(
        (0.25 * grounding_score) +
        (0.20 * cognitive_diversity) +
        (0.20 * traceability_rate) +
        (0.20 * teacher_intent_alignment) +
        (0.15 * (100.0 - redundancy_rate)),
        1
    )

    return {
        "difficulty_tier": suite.requested_difficulty,
        "questions_generated": total_q,
        "latency_seconds": suite.generation_metadata.get("total_latency_seconds", 0.0),
        "llm_calls": suite.generation_metadata.get("measured_llm_calls", 4),
        "cognitive_distribution": bloom_counts,
        "cognitive_diversity_score": cognitive_diversity,
        "traceability_rate": traceability_rate,
        "misconception_distractor_rate": misconception_rate,
        "teacher_intent_alignment": teacher_intent_alignment,
        "redundancy_rate": redundancy_rate,
        "overall_quality_score": overall_quality
    }


def main():
    transcript_file = "pipeline_experiment/data/transcripts/ai_20_8_26_unseen_transcript.json"
    if not os.path.exists(transcript_file):
        print(f"Error: Transcript file not found at {transcript_file}")
        return

    with open(transcript_file, "r", encoding="utf-8") as f:
        transcript_data = json.load(f)

    canonical = ProductionContentProcessor.process_raw_input(
        input_id="input_23_ai_autoencoders_unseen",
        title="Artificial Intelligence & Deep Learning: Autoencoders Lab - Fully Connected vs Convolutional Autoencoders on Fashion-MNIST",
        input_type="VOICE_ONLY",
        content_style="PROBLEM_SOLVING",
        transcript_data=transcript_data
    )

    engine = AdaptiveAssessmentEngine(provider="groq", model="qwen/qwen3.8-27b", temperature=0.2)

    # 1. Run EASY Tier (10 MCQs)
    print("\n=======================================================")
    print("--- Running Difficulty Tier: EASY (10 MCQs) ---")
    print("=======================================================")
    suite_easy = engine.generate_assessment(canonical=canonical, requested_count=10, difficulty="EASY")
    metrics_easy = evaluate_tier_metrics(suite_easy, canonical)
    print(f"EASY Tier finished: {len(suite_easy.questions)} questions generated in {suite_easy.generation_metadata.get('total_latency_seconds')}s")

    # 2. Run MEDIUM Tier (10 MCQs)
    print("\n=======================================================")
    print("--- Running Difficulty Tier: MEDIUM (10 MCQs) ---")
    print("=======================================================")
    suite_medium = engine.generate_assessment(canonical=canonical, requested_count=10, difficulty="MEDIUM")
    metrics_medium = evaluate_tier_metrics(suite_medium, canonical)
    print(f"MEDIUM Tier finished: {len(suite_medium.questions)} questions generated in {suite_medium.generation_metadata.get('total_latency_seconds')}s")

    # 3. Run HARD Tier (10 MCQs)
    print("\n=======================================================")
    print("--- Running Difficulty Tier: HARD (10 MCQs) ---")
    print("=======================================================")
    suite_hard = engine.generate_assessment(canonical=canonical, requested_count=10, difficulty="HARD")
    metrics_hard = evaluate_tier_metrics(suite_hard, canonical)
    print(f"HARD Tier finished: {len(suite_hard.questions)} questions generated in {suite_hard.generation_metadata.get('total_latency_seconds')}s")

    # Compile comprehensive results
    results = {
        "benchmark": "Controlled Difficulty Calibration Experiment (Architecture E)",
        "lecture": canonical.title,
        "audio_file": transcript_data.get("audio_file"),
        "duration_seconds": transcript_data.get("duration_seconds"),
        "total_words": len(canonical.raw_content.split()),
        "easy_tier": {
            "metrics": metrics_easy,
            "questions": [q.model_dump() for q in suite_easy.questions]
        },
        "medium_tier": {
            "metrics": metrics_medium,
            "questions": [q.model_dump() for q in suite_medium.questions]
        },
        "hard_tier": {
            "metrics": metrics_hard,
            "questions": [q.model_dump() for q in suite_hard.questions]
        }
    }

    out_file = "production_engine/outputs/controlled_difficulty_results.json"
    os.makedirs("production_engine/outputs", exist_ok=True)
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print(f"\nSuccessfully saved controlled difficulty calibration results to: {out_file}")


if __name__ == "__main__":
    main()
