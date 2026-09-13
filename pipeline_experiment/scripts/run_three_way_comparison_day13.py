"""
Comparative Study on Day 13 DAA Lecture (77.5 mins, 9,974 words):
1. Pipeline A: Summary-Only (WHAT) -> 10 MCQs
2. Pipeline B: Blueprint-Only (WHY) -> 10 MCQs
3. Pipeline E: Updated Production Engine (Adaptive Representation + Planner + RAG + Traceability) -> 10 MCQs
"""

import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json
import time
from typing import List, Dict, Any

from pipeline_experiment.generator.llm_engine import UnifiedLLMEngine
from pipeline_experiment.shared.schemas.canonical_models import CanonicalEducationalInput
from production_engine.ingestion.content_processor import ProductionContentProcessor
from production_engine.extractors.summary_extractor import ProductionSummaryExtractor
from production_engine.extractors.blueprint_extractor import ProductionBlueprintExtractor
from production_engine.core_engine import AdaptiveAssessmentEngine
from pydantic import BaseModel, Field


class SimpleMCQ(BaseModel):
    question_id: str = "Q1"
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str
    explanation: str = ""
    cognitive_level: str = "UNDERSTAND"


class SimpleMCQListOutput(BaseModel):
    questions: List[SimpleMCQ]


def generate_pipeline_a_summary_only(
    canonical: CanonicalEducationalInput,
    llm: UnifiedLLMEngine,
    count: int = 10
) -> Dict[str, Any]:
    print("\n" + "=" * 80)
    print(">>> RUNNING PIPELINE A: SUMMARY-ONLY (WHAT WAS TAUGHT)")
    print("=" * 80)
    start_t = time.time()
    
    # Step 1: Extract Technical Summary
    print("Extracting Technical Summary...")
    summary = ProductionSummaryExtractor.extract(canonical, llm)
    
    # Step 2: Generate 10 MCQs from Summary Only
    print(f"Generating {count} MCQs conditioned purely on Technical Summary...")
    system_prompt = (
        "You are an assessment writer. Generate high-quality multiple-choice questions "
        "based strictly and solely on the provided Technical Summary of the lecture.\n"
        "Rules:\n"
        "1. Focus on technical definitions, mathematical formulas, and code patterns.\n"
        "2. Provide 4 options (A, B, C, D) with exactly one correct key (A, B, C, or D).\n"
        "3. Provide a clear explanation."
    )
    
    prompt = (
        f"LECTURE TITLE: {canonical.title}\n\n"
        f"--- TECHNICAL SUMMARY ---\n"
        f"Concepts: {json.dumps(summary.concepts_and_definitions[:8])}\n"
        f"Formulas: {json.dumps(summary.mechanisms_and_formulas[:6])}\n"
        f"Summary: {summary.factual_summary_text[:1200]}\n\n"
        f"Task: Generate multiple choice questions assessing this summary. "
        f"Output valid JSON matching RawMCQListOutput schema."
    )
    
    # Generate in 4 batches of 2-3 to strictly stay below rate limits
    questions: List[ProductionMCQ] = []
    batch_sizes = [3, 3, 2, 2]
    for b_idx, b_count in enumerate(batch_sizes):
        b_prompt = prompt + f"\n\n(Batch {b_idx+1}/4: Generate exactly {b_count} unique questions)."
        raw = llm.generate_pydantic(prompt=b_prompt, system_prompt=system_prompt, pydantic_class=SimpleMCQListOutput)
        if raw and raw.questions:
            questions.extend(raw.questions[:b_count])
            
    dur = round(time.time() - start_t, 2)
    print(f"Pipeline A completed in {dur}s ({len(questions)} questions generated).")
    
    return {
        "pipeline": "Pipeline A (Summary-Only)",
        "representation": "SUMMARY (WHAT)",
        "latency_seconds": dur,
        "questions_count": len(questions),
        "summary_data": summary.model_dump(),
        "questions": [q.model_dump() for q in questions]
    }


def generate_pipeline_b_blueprint_only(
    canonical: CanonicalEducationalInput,
    llm: UnifiedLLMEngine,
    count: int = 10
) -> Dict[str, Any]:
    print("\n" + "=" * 80)
    print(">>> RUNNING PIPELINE B: BLUEPRINT-ONLY (WHY IT WAS TAUGHT)")
    print("=" * 80)
    start_t = time.time()
    
    # Step 1: Extract Instructional Blueprint
    print("Extracting Pedagogical Blueprint...")
    blueprint = ProductionBlueprintExtractor.extract(canonical, llm)
    
    # Step 2: Generate 10 MCQs from Blueprint Only
    print(f"Generating {count} MCQs conditioned purely on Pedagogical Blueprint...")
    system_prompt = (
        "You are an expert pedagogical item writer. Generate multiple-choice questions "
        "based strictly and solely on the provided Instructional Blueprint.\n"
        "Rules:\n"
        "1. Focus on teacher emphasis, common student mistakes, problem-solving decisions, and instructional rationale.\n"
        "2. Provide 4 options (A, B, C, D) with exactly one correct key.\n"
        "3. Provide a clear explanation."
    )
    
    bp_data = [{
        "topic": t.topic,
        "salience": t.salience_score,
        "acts": t.instructional_acts,
        "bloom": t.target_bloom_level,
        "mode": t.dominant_mode
    } for t in blueprint.topics[:8]]
    
    prompt = (
        f"LECTURE TITLE: {canonical.title}\n\n"
        f"--- INSTRUCTIONAL BLUEPRINT ---\n"
        f"{json.dumps(bp_data, indent=2)}\n\n"
        f"Task: Generate MCQs assessing student grasp of these pedagogical topics and instructional emphasis points. "
        f"Output valid JSON matching RawMCQListOutput schema."
    )
    
    # Generate in 4 batches of 2-3 to strictly stay below rate limits
    questions: List[ProductionMCQ] = []
    batch_sizes = [3, 3, 2, 2]
    for b_idx, b_count in enumerate(batch_sizes):
        b_prompt = prompt + f"\n\n(Batch {b_idx+1}/4: Generate exactly {b_count} unique questions covering different topics)."
        raw = llm.generate_pydantic(prompt=b_prompt, system_prompt=system_prompt, pydantic_class=SimpleMCQListOutput)
        if raw and raw.questions:
            questions.extend(raw.questions[:b_count])
            
    dur = round(time.time() - start_t, 2)
    print(f"Pipeline B completed in {dur}s ({len(questions)} questions generated).")
    
    return {
        "pipeline": "Pipeline B (Blueprint-Only)",
        "representation": "BLUEPRINT (WHY)",
        "latency_seconds": dur,
        "questions_count": len(questions),
        "blueprint_data": blueprint.model_dump(),
        "questions": [q.model_dump() for q in questions]
    }


def generate_pipeline_e_production_engine(
    canonical: CanonicalEducationalInput,
    engine: AdaptiveAssessmentEngine,
    count: int = 10
) -> Dict[str, Any]:
    print("\n" + "=" * 80)
    print(">>> RUNNING PIPELINE E: UPDATED PRODUCTION ENGINE (ARCHITECTURE E)")
    print("=" * 80)
    start_t = time.time()
    
    suite = engine.generate_assessment(canonical=canonical, requested_count=count)
    dur = round(time.time() - start_t, 2)
    print(f"Pipeline E completed in {dur}s ({len(suite.questions)} questions generated).")
    
    return {
        "pipeline": "Pipeline E (Production Engine)",
        "representation": suite.representation_used,
        "routing_rationale": suite.routing_rationale,
        "latency_seconds": dur,
        "questions_count": len(suite.questions),
        "validation_status": suite.validation_status,
        "generation_metadata": suite.generation_metadata,
        "questions": [q.model_dump() for q in suite.questions]
    }


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

    llm = UnifiedLLMEngine(provider="groq", model="qwen/qwen3.8-27b", temperature=0.2)
    engine = AdaptiveAssessmentEngine(provider="groq", model="qwen/qwen3.8-27b", temperature=0.2)

    # 1. Run Pipeline A (Summary-Only)
    res_a = generate_pipeline_a_summary_only(canonical, llm, count=10)

    # 2. Run Pipeline B (Blueprint-Only)
    res_b = generate_pipeline_b_blueprint_only(canonical, llm, count=10)

    # 3. Run Pipeline E (Production Engine)
    res_e = generate_pipeline_e_production_engine(canonical, engine, count=10)

    results = {
        "input_id": canonical.input_id,
        "title": canonical.title,
        "audio_duration_seconds": transcript_data.get("duration_seconds", 4647.33),
        "total_words": len(canonical.raw_content.split()),
        "pipeline_a": res_a,
        "pipeline_b": res_b,
        "pipeline_e": res_e
    }

    out_file = "production_engine/outputs/day13_comparative_study.json"
    os.makedirs("production_engine/outputs", exist_ok=True)
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print(f"\nSaved complete 3-way comparative dataset to: {out_file}")


if __name__ == "__main__":
    main()
