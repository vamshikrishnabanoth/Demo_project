"""
Cohort-based 3-Way Comparative Experiment Runner.
Executes experiments by modality cohort:
- COHORT 1: ONLY MATERIAL (Static Documents: Theory, Code, Procedural, Problem Solving)
- COHORT 2: ONLY VOICE (Live Spoken Classroom Lectures)
- COHORT 3: VOICE + PPT / CODE (Multimodal Classroom Lectures)
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


COHORTS = {
    "material": [
        "input_01_daa_unit2",
        "input_02_cnn_object_detection",
        "input_03_ds_lab_programs",
        "input_04_se_lab_git_github",
        "input_05_assignment_mongodb_crud",
        "input_06_mongodb_commands_reference"
    ],
    "voice": [
        "input_07_deepa_madam_lecture",
        "input_08_tapadia_sir_lecture",
        "input_09_wt_web_technologies",
        "input_13_wt_event_bubbling",
        "input_14_wt_dom_validation",
        "input_15_python_problem_solving"
    ],
    "multimodal": [
        "input_10_binary_trees_audio_ppt",
        "input_11_ashamam_vae_colab",
        "input_12_tapadia_buy_and_sell_stock"
    ]
}


def run_cohort(
    cohort_name: str = "material",
    provider: str = "groq",
    model: str = "qwen/qwen3.8-27b",
    question_count: int = 5,
    results_root: str = "pipeline_experiment/results"
):
    print("=" * 115)
    print(f"STARTING 3-WAY BENCHMARK FOR COHORT: [{cohort_name.upper()}]")
    print(f"LLM: {provider} ({model}) | Temperature: 0.2 | Questions/Input: {question_count}")
    print("=" * 115)

    llm = UnifiedLLMEngine(provider=provider, model=model, temperature=0.2)

    metadata_path = "pipeline_experiment/data/metadata.json"
    with open(metadata_path, "r", encoding="utf-8") as f:
        all_inputs = json.load(f)

    target_ids = COHORTS.get(cohort_name.lower())
    if not target_ids:
        if cohort_name.lower() == "all":
            target_ids = [m["input_id"] for m in all_inputs]
        else:
            raise ValueError(f"Unknown cohort: {cohort_name}. Choose from 'material', 'voice', 'multimodal', 'all'.")

    filtered_inputs = [m for m in all_inputs if m["input_id"] in target_ids]

    cohort_results = []

    for idx, item_meta in enumerate(filtered_inputs):
        input_id = item_meta["input_id"]
        print(f"\n>>> [{idx+1}/{len(filtered_inputs)}] Cohort [{cohort_name.upper()}]: Benchmarking {input_id} ...", flush=True)

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

        cohort_results.append({
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
            "grounding_c": mc.get("source_grounding_percentage")
        })

    # Save Cohort Results JSON
    os.makedirs(os.path.join(results_root, "cohorts"), exist_ok=True)
    out_json = os.path.join(results_root, "cohorts", f"cohort_{cohort_name}_results.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(cohort_results, f, indent=2)

    # Print Formatted Table
    print("\n" + "=" * 135)
    print(f"COHORT [{cohort_name.upper()}] 3-WAY COMPARATIVE RESULTS (A: Summary vs. B: Blueprint vs. C: Unified Engine)")
    print("=" * 135)
    header = "{:<32} | {:<5} | {:<5} | {:<5} | {:<7} | {:<7} | {:<20} | {:<12} | {:<18}".format(
        "Input ID", "Q_A", "Q_B", "Q_C", "Δ(C-A)", "Δ(C-B)", "Winner", "Bloom (A/B/C)", "Grounding (A/B/C)"
    )
    print(header)
    print("=" * 135)

    for r in cohort_results:
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


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--cohort", default="material", choices=["material", "voice", "multimodal", "all"])
    parser.add_argument("--provider", default="groq")
    parser.add_argument("--model", default="qwen/qwen3.8-27b")
    parser.add_argument("--questions", type=int, default=5)
    args = parser.parse_args()

    run_cohort(
        cohort_name=args.cohort,
        provider=args.provider,
        model=args.model,
        question_count=args.questions
    )
