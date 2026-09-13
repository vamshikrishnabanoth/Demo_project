"""
Master Benchmark: Frozen Feature Router (Pipeline D) vs. Unified (Pipeline C) vs. Summary (A) vs. Blueprint (B) vs. Oracle.
Evaluates on:
1. Development Corpus (15 Datasets)
2. Unseen Validation Corpus (6 Real Classroom Lectures)
"""

import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json
import time
import argparse
from typing import Dict, Any, List

from pipeline_experiment.generator.llm_engine import UnifiedLLMEngine
from pipeline_experiment.router.feature_extractor import UpfrontFeatureExtractor
from pipeline_experiment.router.frozen_router import FrozenPedagogicalRouter
from pipeline_experiment.scripts.run_single import run_single_experiment, load_canonical_input


def evaluate_development_corpus():
    print("=" * 135)
    print("PHASE 1: EVALUATING FROZEN ROUTER D ON 15 DEVELOPMENT DATASETS")
    print("=" * 135)

    metadata_path = "pipeline_experiment/data/metadata.json"
    with open(metadata_path, "r", encoding="utf-8") as f:
        dev_inputs = json.load(f)

    dev_results = []
    base_results = "pipeline_experiment/results/intermediate"

    for item in dev_inputs:
        m_id = item["input_id"]
        canonical = load_canonical_input(item)
        decision = FrozenPedagogicalRouter.route(canonical)

        metric_file = os.path.join(base_results, m_id, "evaluation", "07_metrics.json")
        q_a, q_b, q_c = 0.0, 0.0, 0.0
        if os.path.exists(metric_file):
            with open(metric_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                dec3 = data["three_way_decision"]
                q_a = dec3["q_summary_a"]
                q_b = dec3["q_blueprint_b"]
                q_c = dec3["q_unified_c"]

        oracle_q = max(q_a, q_b)
        chosen_branch = decision.selected_pipeline
        q_d = q_a if chosen_branch == "PIPELINE_A_SUMMARY" else q_b

        oracle_winner = "SUMMARY" if q_a >= q_b else "BLUEPRINT"
        router_picked = "SUMMARY" if chosen_branch == "PIPELINE_A_SUMMARY" else "BLUEPRINT"
        router_correct = (router_picked == oracle_winner)
        oracle_gap = round(oracle_q - q_d, 3)
        delta_c_minus_d = round(q_c - q_d, 3)
        delta_c_minus_oracle = round(q_c - oracle_q, 3)

        dev_results.append({
            "input_id": m_id,
            "title": item["title"],
            "input_type": item["input_type"],
            "pdi": decision.pedagogical_delivery_index,
            "router_picked": router_picked,
            "oracle_winner": oracle_winner,
            "router_correct": router_correct,
            "q_a": q_a,
            "q_b": q_b,
            "q_c": q_c,
            "q_d": q_d,
            "oracle_q": oracle_q,
            "oracle_gap": oracle_gap,
            "delta_c_minus_d": delta_c_minus_d,
            "delta_c_minus_oracle": delta_c_minus_oracle
        })

    return dev_results


def evaluate_unseen_validation_corpus(llm: UnifiedLLMEngine, question_count: int = 5):
    print("\n" + "=" * 135)
    print("PHASE 2: EVALUATING 6 UNSEEN REAL CLASSROOM LECTURES (FROZEN ROUTER D)")
    print("=" * 135)

    metadata_path = "pipeline_experiment/data/unseen_metadata.json"
    with open(metadata_path, "r", encoding="utf-8") as f:
        unseen_inputs = json.load(f)

    unseen_results = []
    results_root = "pipeline_experiment/results"

    for idx, item in enumerate(unseen_inputs):
        input_id = item["input_id"]
        print(f"\n>>> [{idx+1}/{len(unseen_inputs)}] Unseen Validation: Benchmarking {input_id} ...", flush=True)

        canonical = load_canonical_input(item)
        decision = FrozenPedagogicalRouter.route(canonical)
        print(f"  [Frozen Router D] PDI: {decision.pedagogical_delivery_index:.3f} (tau=0.60) -> Choice: {decision.selected_pipeline}")

        # Run 3-way benchmark (A, B, C)
        res = run_single_experiment(
            item_meta=item,
            llm=llm,
            question_count=question_count,
            results_root=results_root
        )

        dec3 = res["three_way_decision"]
        q_a = dec3["q_summary_a"]
        q_b = dec3["q_blueprint_b"]
        q_c = dec3["q_unified_c"]

        oracle_q = max(q_a, q_b)
        chosen_branch = decision.selected_pipeline
        q_d = q_a if chosen_branch == "PIPELINE_A_SUMMARY" else q_b

        oracle_winner = "SUMMARY" if q_a >= q_b else "BLUEPRINT"
        router_picked = "SUMMARY" if chosen_branch == "PIPELINE_A_SUMMARY" else "BLUEPRINT"
        router_correct = (router_picked == oracle_winner)
        oracle_gap = round(oracle_q - q_d, 3)
        delta_c_minus_d = round(q_c - q_d, 3)
        delta_c_minus_oracle = round(q_c - oracle_q, 3)

        unseen_results.append({
            "input_id": input_id,
            "title": item["title"],
            "input_type": item["input_type"],
            "pdi": decision.pedagogical_delivery_index,
            "router_picked": router_picked,
            "oracle_winner": oracle_winner,
            "router_correct": router_correct,
            "q_a": q_a,
            "q_b": q_b,
            "q_c": q_c,
            "q_d": q_d,
            "oracle_q": oracle_q,
            "oracle_gap": oracle_gap,
            "delta_c_minus_d": delta_c_minus_d,
            "delta_c_minus_oracle": delta_c_minus_oracle
        })

    return unseen_results


def print_comparison_table(results: List[Dict[str, Any]], title: str):
    print("\n" + "=" * 145)
    print(title)
    print("=" * 145)
    header = "{:<32} | {:<5} | {:<10} | {:<10} | {:<5} | {:<5} | {:<5} | {:<5} | {:<6} | {:<7} | {:<7}".format(
        "Input ID", "PDI", "Router(D)", "Oracle(AB)", "Q_A", "Q_B", "Q_C", "Q_D", "Oracle", "d(C-D)", "d(C-Or)"
    )
    print(header)
    print("=" * 145)

    correct_count = 0
    total_oracle_gap = 0.0
    total_delta_c_d = 0.0
    total_delta_c_or = 0.0

    for r in results:
        if r["router_correct"]:
            correct_count += 1
        total_oracle_gap += r["oracle_gap"]
        total_delta_c_d += r["delta_c_minus_d"]
        total_delta_c_or += r["delta_c_minus_oracle"]

        match_str = "[OK]" if r["router_correct"] else "[MISS]"
        router_display = f"{r['router_picked']} {match_str}"

        print("{:<32} | {:<5.3f} | {:<10} | {:<10} | {:<5.3f} | {:<5.3f} | {:<5.3f} | {:<5.3f} | {:<6.3f} | {:<+7.3f} | {:<+7.3f}".format(
            r["input_id"][:32],
            r["pdi"],
            router_display[:10],
            r["oracle_winner"][:10],
            r["q_a"], r["q_b"], r["q_c"], r["q_d"], r["oracle_q"],
            r["delta_c_minus_d"],
            r["delta_c_minus_oracle"]
        ))

    n = max(1, len(results))
    accuracy = (correct_count / n) * 100.0
    avg_gap = total_oracle_gap / n
    avg_c_d = total_delta_c_d / n
    avg_c_or = total_delta_c_or / n

    print("=" * 145)
    print(f"SUMMARY STATISTICS (N = {n}):")
    print(f"  • Router Predictive Accuracy : {correct_count}/{n} ({accuracy:.1f}%)")
    print(f"  • Average Oracle Gap (Penalty): {avg_gap:+.3f}")
    print(f"  • Average Unified Gain over Router (Q_C - Q_D) : {avg_c_d:+.3f}")
    print(f"  • Average Unified Gain over Oracle (Q_C - Oracle): {avg_c_or:+.3f}")
    print("=" * 145)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--eval_dev_only", action="store_true")
    parser.add_argument("--provider", default="groq")
    parser.add_argument("--model", default="qwen/qwen3.8-27b")
    args = parser.parse_args()

    # 1. Dev corpus evaluation
    dev_res = evaluate_development_corpus()
    print_comparison_table(dev_res, "DEVELOPMENT CORPUS (15 DATASETS): SUMMARY vs. BLUEPRINT vs. UNIFIED vs. ROUTER D")

    # 2. Unseen validation corpus evaluation (if not dev-only)
    if not args.eval_dev_only:
        llm_engine = UnifiedLLMEngine(provider=args.provider, model=args.model, temperature=0.2)
        unseen_res = evaluate_unseen_validation_corpus(llm_engine, question_count=5)
        print_comparison_table(unseen_res, "UNSEEN VALIDATION CORPUS (6 REAL LECTURES): SUMMARY vs. BLUEPRINT vs. UNIFIED vs. ROUTER D")

        # Save Combined Analysis JSON
        os.makedirs("pipeline_experiment/results/overall", exist_ok=True)
        final_payload = {
            "development_corpus": dev_res,
            "unseen_validation_corpus": unseen_res
        }
        with open("pipeline_experiment/results/overall/master_router_vs_unified_experiment.json", "w", encoding="utf-8") as f:
            json.dump(final_payload, f, indent=2)
        print("\nSaved complete experiment record to pipeline_experiment/results/overall/master_router_vs_unified_experiment.json")
