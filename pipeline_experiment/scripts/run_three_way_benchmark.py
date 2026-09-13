"""
Master 3-Way Comparative Experiment Runner.
Executes Arm A (Summary Only), Arm B (Blueprint Only), and Arm C (Unified Engine: WHAT + WHY)
across all 11 real educational datasets under identical frozen configurations.
"""

import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json
import argparse
from typing import Dict, Any, List

from pipeline_experiment.generator.llm_engine import UnifiedLLMEngine
from pipeline_experiment.scripts.run_single import run_single_experiment
from pipeline_experiment.evaluation.reports import ResultsCompiler


def run_three_way_benchmark(
    provider: str = "groq",
    model: str = "openai/gpt-oss-120b",
    question_count: int = 5,
    results_root: str = "pipeline_experiment/results"
):
    print("=" * 105)
    print(f"STARTING 3-WAY COMPARATIVE BENCHMARK: SUMMARY (A) vs. BLUEPRINT (B) vs. UNIFIED ENGINE (C)")
    print(f"LLM: {provider} ({model}) | Temperature: 0.2 | Questions/Input: {question_count}")
    print("=" * 105)

    llm = UnifiedLLMEngine(provider=provider, model=model, temperature=0.2)

    metadata_path = "pipeline_experiment/data/metadata.json"
    with open(metadata_path, "r", encoding="utf-8") as f:
        all_inputs = json.load(f)

    benchmark_summary = []

    for idx, item_meta in enumerate(all_inputs):
        input_id = item_meta["input_id"]
        print(f"\n>>> [{idx+1}/{len(all_inputs)}] Benchmarking {input_id} ...", flush=True)

        res = run_single_experiment(
            item_meta=item_meta,
            llm=llm,
            question_count=question_count,
            results_root=results_root
        )

        dec3 = res["three_way_decision"]
        ma = res["metrics_a"]
        mb = res["metrics_b"]
        mc = res["metrics_c"]

        benchmark_summary.append({
            "input_id": input_id,
            "title": item_meta["title"],
            "input_type": item_meta["input_type"],
            "content_style": item_meta["content_style"],
            "q_summary_a": dec3["q_summary_a"],
            "q_blueprint_b": dec3["q_blueprint_b"],
            "q_unified_c": dec3["q_unified_c"],
            "delta_c_minus_a": dec3["delta_c_minus_a"],
            "delta_c_minus_b": dec3["delta_c_minus_b"],
            "winner": dec3["winner"],
            "bloom_a": ma.get("average_bloom_level"),
            "bloom_b": mb.get("average_bloom_level"),
            "bloom_c": mc.get("average_bloom_level"),
            "grounding_a": ma.get("source_grounding_percentage"),
            "grounding_b": mb.get("source_grounding_percentage"),
            "grounding_c": mc.get("source_grounding_percentage"),
            "specificity_a": ma.get("specificity_score"),
            "specificity_b": mb.get("specificity_score"),
            "specificity_c": mc.get("specificity_score")
        })

    # Save 3-way benchmark JSON
    os.makedirs(os.path.join(results_root, "overall"), exist_ok=True)
    out_json = os.path.join(results_root, "overall", "three_way_benchmark_results.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(benchmark_summary, f, indent=2)

    # Print Master Summary Table
    print("\n" + "=" * 135)
    print("MASTER 3-WAY COMPARATIVE EVALUATION MATRIX (WHAT vs. WHY vs. UNIFIED WHAT+WHY)")
    print("=" * 135)
    header = "{:<32} | {:<5} | {:<5} | {:<5} | {:<7} | {:<7} | {:<20} | {:<12} | {:<18}".format(
        "Input ID", "Q_A", "Q_B", "Q_C", "Δ(C-A)", "Δ(C-B)", "Winner", "Bloom (A/B/C)", "Grounding (A/B/C)"
    )
    print(header)
    print("=" * 135)

    for r in benchmark_summary:
        row = "{:<32} | {:<5.3f} | {:<5.3f} | {:<5.3f} | {:<+7.3f} | {:<+7.3f} | {:<20} | {:<3}/{:<3}/{:<4} | {:<4}%/{:<4}%/{:<4}%".format(
            r["input_id"][:32],
            r["q_summary_a"], r["q_blueprint_b"], r["q_unified_c"],
            r["delta_c_minus_a"], r["delta_c_minus_b"],
            r["winner"],
            r["bloom_a"], r["bloom_b"], r["bloom_c"],
            r["grounding_a"], r["grounding_b"], r["grounding_c"]
        )
        print(row)

    print("=" * 135)
    print(f"\n3-Way Benchmark results saved to: {out_json}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--provider", default="groq")
    parser.add_argument("--model", default="openai/gpt-oss-120b")
    parser.add_argument("--questions", type=int, default=5)
    args = parser.parse_args()

    run_three_way_benchmark(
        provider=args.provider,
        model=args.model,
        question_count=args.questions
    )
