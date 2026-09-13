"""
Variance & Stability Analysis Script.
Runs Summary and Blueprint generation k=3 times under identical conditions (T=0.2)
on 3 representative inputs to measure variance of Q and verify if observed Delta Q > noise.
"""

import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json
import numpy as np
from pipeline_experiment.generator.llm_engine import UnifiedLLMEngine
from pipeline_experiment.scripts.run_single import run_single_experiment


def run_variance_experiment(reps: int = 3):
    llm = UnifiedLLMEngine(provider="groq", model="openai/gpt-oss-120b", temperature=0.2)

    with open("pipeline_experiment/data/metadata.json", "r", encoding="utf-8") as f:
        all_meta = json.load(f)
    meta_map = {m["input_id"]: m for m in all_meta}

    test_inputs = [
        "input_08_tapadia_sir_lecture",
        "input_03_ds_lab_programs",
        "input_01_daa_unit2"
    ]

    variance_results = {}

    for inp_id in test_inputs:
        item_meta = meta_map[inp_id]
        print(f"\n=======================================================")
        print(f"RUNNING {reps}-RUN REPEATABILITY TEST FOR: {inp_id}")
        print(f"=======================================================", flush=True)

        qa_scores = []
        qb_scores = []
        deltas = []

        for r in range(reps):
            print(f"\n--- Repetition {r+1}/{reps} for {inp_id} ---", flush=True)
            res = run_single_experiment(
                item_meta=item_meta,
                llm=llm,
                question_count=5,
                results_root=f"pipeline_experiment/results/variance_tests/run_{r+1}"
            )
            q_a = res["decision"]["composite_score_summary"]
            q_b = res["decision"]["composite_score_blueprint"]
            d = res["decision"]["quality_delta"]

            qa_scores.append(q_a)
            qb_scores.append(q_b)
            deltas.append(d)

        variance_results[inp_id] = {
            "qa_runs": qa_scores,
            "qb_runs": qb_scores,
            "delta_runs": deltas,
            "mean_qa": round(float(np.mean(qa_scores)), 4),
            "std_qa": round(float(np.std(qa_scores)), 4),
            "mean_qb": round(float(np.mean(qb_scores)), 4),
            "std_qb": round(float(np.std(qb_scores)), 4),
            "mean_delta": round(float(np.mean(deltas)), 4),
            "std_delta": round(float(np.std(deltas)), 4),
            "is_signal_significant": bool(abs(np.mean(deltas)) > 2 * (np.std(deltas) or 0.001))
        }

    os.makedirs("pipeline_experiment/results/variance_tests", exist_ok=True)
    with open("pipeline_experiment/results/variance_tests/variance_summary.json", "w", encoding="utf-8") as f:
        json.dump(variance_results, f, indent=2)

    print("\n" + "="*85)
    print("VARIANCE & STABILITY ANALYSIS COMPLETE")
    print("="*85)
    for inp_id, v in variance_results.items():
        print(f"{inp_id}:")
        print(f"  Q_A: {v['mean_qa']} ± {v['std_qa']} (runs: {v['qa_runs']})")
        print(f"  Q_B: {v['mean_qb']} ± {v['std_qb']} (runs: {v['qb_runs']})")
        print(f"  Delta: {v['mean_delta']} ± {v['std_delta']} (runs: {v['delta_runs']})")
        print(f"  Signal-to-Noise Ratio (Delta > 2*std): {v['is_signal_significant']}")
    print("="*85)


if __name__ == "__main__":
    run_variance_experiment(reps=3)
