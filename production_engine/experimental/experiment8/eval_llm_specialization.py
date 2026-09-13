"""
Experiment 8: LLM Task Specialization & Model Selection Benchmark (Repeated Trials N=3).
Evaluates:
- openai/gpt-oss-20b (20B Efficiency Candidate)
- qwen/qwen3.6-27b   (27B Baseline Candidate)
- openai/gpt-oss-120b (120B High-Capability Candidate)

Across 3 non-generation tasks with N=3 repeated trials:
- Task 1: Pedagogical Representation Extraction (Summary / Blueprint)
- Task 2: Adaptive Assessment Planning (12 Cognitive Facets)
- Task 3: Closed-Loop Critic & Surgical Patch Repair (Diagnosis & In-Place Patching)
"""

import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json
import time
import math
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

from pipeline_experiment.generator.llm_engine import UnifiedLLMEngine
from pipeline_experiment.shared.schemas.canonical_models import (
    CanonicalEducationalInput, PedagogicalSummary, PedagogicalBlueprint
)
from production_engine.ingestion.content_processor import ProductionContentProcessor
from production_engine.extractors.summary_extractor import ProductionSummaryExtractor
from production_engine.extractors.blueprint_extractor import ProductionBlueprintExtractor
from production_engine.experimental.planning_agent.adaptive_planning_agent import AdaptivePlanningAgent
from production_engine.experimental.hierarchical_rag.hierarchical_chunker import HierarchicalChunker
from production_engine.experimental.critic_repair.critic_agent import ClosedLoopCriticAgent
from production_engine.schemas import ProductionMCQ


def setup_directories():
    dirs = [
        "production_engine/experimental/experiment8/benchmark_inputs",
        "production_engine/experimental/experiment8/raw_outputs/gpt_oss_20b",
        "production_engine/experimental/experiment8/raw_outputs/qwen_27b",
        "production_engine/experimental/experiment8/raw_outputs/gpt_oss_120b",
        "production_engine/outputs"
    ]
    for d in dirs:
        os.makedirs(d, exist_ok=True)


def get_model_dir_name(model_id: str) -> str:
    if "20b" in model_id.lower():
        return "gpt_oss_20b"
    elif "120b" in model_id.lower():
        return "gpt_oss_120b"
    else:
        return "qwen_27b"


def compute_mean_std(values: List[float]) -> Dict[str, float]:
    if not values:
        return {"mean": 0.0, "std": 0.0}
    n = len(values)
    mean = sum(values) / n
    if n <= 1:
        return {"mean": round(mean, 2), "std": 0.0}
    variance = sum((x - mean) ** 2 for x in values) / (n - 1)
    std = math.sqrt(variance)
    return {"mean": round(mean, 2), "std": round(std, 2)}


def run_experiment_8():
    print("="*80)
    print("EXPERIMENT 8: LLM TASK SPECIALIZATION & MODEL SELECTION BENCHMARK (N=3 TRIALS)")
    print("="*80)
    setup_directories()

    NUM_TRIALS = 3

    candidate_models = [
        {"id": "openai/gpt-oss-20b", "label": "GPT-OSS 20B (Efficiency Candidate)", "class": "20B"},
        {"id": "qwen/qwen3.6-27b",   "label": "Qwen 3.6 27B (Baseline Candidate)", "class": "27B"},
        {"id": "openai/gpt-oss-120b", "label": "GPT-OSS 120B (High-Capability Candidate)", "class": "120B"}
    ]

    # Benchmark Datasets
    # 1. DAA Median Algorithmic Lecture (Voice-Only)
    daa_transcript = {
        "text": "Finding the median of two sorted arrays in O(log(min(m,n))) time requires binary searching the smaller array. If A[i-1] > B[j], partition i is too far right, so decrease i. We maintain left_max <= right_min invariant.",
        "segments": [
            {"id": 1, "start": 0.0, "end": 15.0, "text": "Finding the median of two sorted arrays in O(log(min(m,n))) time requires binary searching the smaller array."},
            {"id": 2, "start": 15.0, "end": 35.0, "text": "If A[i-1] > B[j], partition i is too far right, so decrease i. We maintain left_max <= right_min invariant."}
        ]
    }
    can_daa = ProductionContentProcessor.process_raw_input(
        input_id="DAA_BENCH",
        title="DAA Median of Two Sorted Arrays",
        input_type="VOICE_ONLY",
        content_style="PROBLEM_SOLVING",
        transcript_data=daa_transcript
    )

    # 2. VAE Classroom Lecture (Voice + Slides Multimodal)
    vae_transcript = {
        "text": "Variational Autoencoders optimize ELBO consisting of reconstruction loss and KL divergence. We apply the reparameterization trick z = mu + sigma * epsilon to differentiate through sampling.",
        "segments": [
            {"id": 1, "start": 0.0, "end": 20.0, "text": "Variational Autoencoders optimize ELBO consisting of reconstruction loss and KL divergence."},
            {"id": 2, "start": 20.0, "end": 40.0, "text": "We apply the reparameterization trick z = mu + sigma * epsilon to differentiate through sampling."}
        ]
    }
    vae_slides = "--- Slide 1 ---\nVAE ELBO Formulation: L(theta, phi; x) = E[log p(x|z)] - D_KL(q(z|x) || p(z))\nReparameterization: z = mu + tf.exp(0.5 * log_var) * eps"
    can_vae = ProductionContentProcessor.process_raw_input(
        input_id="VAE_BENCH",
        title="Variational Autoencoder Formulation",
        input_type="VOICE_PLUS_PPT",
        content_style="PROBLEM_SOLVING",
        transcript_data=vae_transcript,
        supporting_text=vae_slides
    )

    # 3. Task 3 Defective Questions Suite (3 Real Defect Types)
    defective_mcqs = [
        {
            "id": "DEF_01_DUP_OPTION",
            "defect_field": "option_c",
            "desc": "Duplicate option text between option_b and option_c",
            "evidence": "In binary search, time complexity is O(log n) because the search space halves every iteration.",
            "issues": ["Option C is identical to Option B: 'O(log n)'."],
            "mcq": ProductionMCQ(
                question_id="Q_DEF_01",
                question_text="What is the asymptotic time complexity of standard Binary Search on a sorted array of size n?",
                option_a="O(n)",
                option_b="O(log n)",
                option_c="O(log n)", # duplicate
                option_d="O(1)",
                correct_option="B",
                explanation="Binary search halves the search space each step, giving O(log n).",
                target_concept="Binary Search Complexity",
                cognitive_level="REMEMBER",
                difficulty_level="EASY",
                what_taught="Binary search is O(log n)",
                why_assessed="Assess basic complexity",
                evidence_refs=["E01"],
                misconception_rationale="O(n) represents linear search."
            )
        },
        {
            "id": "DEF_02_KEY_MISMATCH",
            "defect_field": "correct_option",
            "desc": "Correct option key mismatch (claims correct is A but explanation says C is correct)",
            "evidence": "The reparameterization trick represents z as mu + sigma * eps where eps ~ N(0, I).",
            "issues": ["Key mismatch: correct_option is 'A' ('z = mu * eps'), but explanation states Option C ('z = mu + sigma * eps') is the correct formula."],
            "mcq": ProductionMCQ(
                question_id="Q_DEF_02",
                question_text="In a Variational Autoencoder, how is the latent vector z sampled using the reparameterization trick?",
                option_a="z = mu * eps",
                option_b="z = mu - log_var",
                option_c="z = mu + sigma * eps",
                option_d="z = sigma / eps",
                correct_option="A", # Mismatched key!
                explanation="Option C (z = mu + sigma * eps) is the correct formulation enabling backpropagation.",
                target_concept="Reparameterization Trick",
                cognitive_level="APPLY",
                difficulty_level="MEDIUM",
                what_taught="Reparameterization is z = mu + sigma * eps",
                why_assessed="Assess sampling formulation",
                evidence_refs=["E02"],
                misconception_rationale="Students often forget the addition of mu."
            )
        },
        {
            "id": "DEF_03_WRONG_EXPLANATION",
            "defect_field": "explanation",
            "desc": "Explanation is empty/generic without mathematical rationale",
            "evidence": "When A[i-1] > B[j], partition i in array A is too large, meaning we must shift the binary search left by decreasing i.",
            "issues": ["Explanation is trivial: 'This is correct because the teacher said so.' Must provide mathematical rationale based on partition indices."],
            "mcq": ProductionMCQ(
                question_id="Q_DEF_03",
                question_text="During median finding in two sorted arrays, what action must be taken if the invariant condition A[i-1] > B[j] is encountered?",
                option_a="Increase partition index i to search right",
                option_b="Decrease partition index i to search left",
                option_c="Terminate and return A[i]",
                option_d="Swap array A and array B entirely",
                correct_option="B",
                explanation="This is correct because the teacher said so.", # Defective explanation
                target_concept="Partition Invariant Correction",
                cognitive_level="ANALYZE",
                difficulty_level="HARD",
                what_taught="If A[i-1] > B[j], decrease i",
                why_assessed="Assess invariant recovery",
                evidence_refs=["E03"],
                misconception_rationale="Increasing i would exacerbate the imbalance."
            )
        }
    ]

    all_benchmark_results: List[Dict[str, Any]] = []

    for model_info in candidate_models:
        m_id = model_info["id"]
        m_label = model_info["label"]
        m_dir = get_model_dir_name(m_id)
        print(f"\n" + "="*80)
        print(f"BENCHMARKING MODEL: {m_label} ({m_id}) — N={NUM_TRIALS} REPEATED TRIALS")
        print("="*80)

        llm = UnifiedLLMEngine(provider="groq", model=m_id, temperature=0.2)

        # =========================================================
        # TASK 1: Pedagogical Representation Extraction (N=3 Trials)
        # =========================================================
        print("\n--- [TASK 1] Pedagogical Representation Extraction (N=3 Trials) ---")
        t1_latencies: List[float] = []
        t1_schema_successes = 0
        t1_total_attempts = 0
        t1_grounding_violations_count = 0
        t1_multimodal_preserved_count = 0
        raw_t1_trials = []

        for trial_idx in range(NUM_TRIALS):
            t1_start = time.time()
            trial_compliant = 0
            trial_gv = 0
            trial_multi = 0
            raw_trial_out = {}

            # DAA Blueprint
            t1_total_attempts += 1
            try:
                bp_daa = ProductionBlueprintExtractor.extract(can_daa, llm)
                raw_trial_out["daa_blueprint"] = bp_daa.model_dump()
                t1_schema_successes += 1
                trial_compliant += 1
                grounded = all(any(k in t.topic.lower() for k in ["median", "array", "binary", "partition", "log", "search"]) for t in bp_daa.topics)
                if not grounded:
                    t1_grounding_violations_count += 1
                    trial_gv += 1
            except Exception as e:
                raw_trial_out["daa_blueprint_error"] = str(e)

            # VAE Summary (Multimodal with slides)
            t1_total_attempts += 1
            try:
                sum_vae = ProductionSummaryExtractor.extract(can_vae, llm)
                raw_trial_out["vae_summary"] = sum_vae.model_dump()
                t1_schema_successes += 1
                trial_compliant += 1
                formulas = " ".join(sum_vae.mechanisms_and_formulas).lower()
                if any(k in formulas for k in ["elbo", "kl", "reparameterization", "mu", "sigma", "eps"]):
                    t1_multimodal_preserved_count += 1
                    trial_multi += 1
            except Exception as e:
                raw_trial_out["vae_summary_error"] = str(e)

            trial_lat = round(time.time() - t1_start, 2)
            t1_latencies.append(trial_lat)
            raw_t1_trials.append(raw_trial_out)
            print(f"  Trial {trial_idx+1}/{NUM_TRIALS}: Latency={trial_lat}s | Compliant={trial_compliant}/2 | Multi-Preserved={trial_multi}/1")

        t1_stats = compute_mean_std(t1_latencies)
        t1_schema_pct = (t1_schema_successes / t1_total_attempts) * 100.0
        t1_gv_pct = (t1_grounding_violations_count / max(1, t1_schema_successes)) * 100.0
        t1_multi_pct = (t1_multimodal_preserved_count / NUM_TRIALS) * 100.0
        t1_stage1_pass = (t1_schema_pct >= 95.0 and t1_gv_pct == 0.0 and t1_multi_pct == 100.0)

        with open(f"production_engine/experimental/experiment8/raw_outputs/{m_dir}/task1_representation.json", "w", encoding="utf-8") as f:
            json.dump({"model_id": m_id, "trials": raw_t1_trials}, f, indent=2)

        print(f"  Task 1 Summary: Schema={t1_schema_successes}/{t1_total_attempts} ({t1_schema_pct:.1f}%) | Multi-Preserved={t1_multimodal_preserved_count}/{NUM_TRIALS} ({t1_multi_pct:.1f}%) | Latency={t1_stats['mean']} ± {t1_stats['std']}s | Gate: {'[PASS]' if t1_stage1_pass else '[FAIL]'}")

        # =========================================================
        # TASK 2: Evidence-Aware Adaptive Assessment Planning (N=3 Trials)
        # =========================================================
        print("\n--- [TASK 2] Evidence-Aware Adaptive Assessment Planning (N=3 Trials) ---")
        t2_latencies: List[float] = []
        t2_schema_successes = 0
        t2_total_targets = 0
        t2_grounding_violations_count = 0
        t2_facets_allocated_counts: List[int] = []
        raw_t2_trials = []

        hier_store_daa = HierarchicalChunker.build_store(can_daa)

        for trial_idx in range(NUM_TRIALS):
            t2_start = time.time()
            raw_plan_out = {}
            try:
                plan_daa = AdaptivePlanningAgent.plan_assessment(
                    canonical=can_daa,
                    hier_store=hier_store_daa,
                    alignment_graph={},
                    requested_count=10,
                    requested_difficulty="HARD",
                    llm=llm
                )
                raw_plan_out["plan"] = plan_daa.model_dump()
                if len(plan_daa.targets) == 10:
                    t2_schema_successes += 1
                t2_total_targets += len(plan_daa.targets)

                for t in plan_daa.targets:
                    c_name = t.concept_name.lower()
                    if not any(k in c_name for k in ["median", "array", "binary", "partition", "invariant", "search", "log", "complexity", "index", "order"]):
                        t2_grounding_violations_count += 1

                t2_facets_allocated_counts.append(len(plan_daa.facet_distribution))
            except Exception as e:
                raw_plan_out["plan_error"] = str(e)
                t2_facets_allocated_counts.append(0)

            trial_lat = round(time.time() - t2_start, 2)
            t2_latencies.append(trial_lat)
            raw_t2_trials.append(raw_plan_out)
            print(f"  Trial {trial_idx+1}/{NUM_TRIALS}: Latency={trial_lat}s | Targets={len(plan_daa.targets) if 'plan_daa' in locals() else 0}/10 | Facets={t2_facets_allocated_counts[-1]}/12")

        t2_stats = compute_mean_std(t2_latencies)
        t2_schema_pct = (t2_schema_successes / NUM_TRIALS) * 100.0
        t2_gv_pct = (t2_grounding_violations_count / max(1, t2_total_targets)) * 100.0
        avg_facets = round(sum(t2_facets_allocated_counts) / len(t2_facets_allocated_counts), 1)
        t2_stage1_pass = (t2_schema_pct >= 95.0 and t2_gv_pct == 0.0 and avg_facets >= 4.0)

        with open(f"production_engine/experimental/experiment8/raw_outputs/{m_dir}/task2_planning.json", "w", encoding="utf-8") as f:
            json.dump({"model_id": m_id, "trials": raw_t2_trials}, f, indent=2)

        print(f"  Task 2 Summary: Schema={t2_schema_successes}/{NUM_TRIALS} ({t2_schema_pct:.1f}%) | Grounding Violations={t2_gv_pct:.1f}% | Avg Facets={avg_facets}/12 | Latency={t2_stats['mean']} ± {t2_stats['std']}s | Gate: {'[PASS]' if t2_stage1_pass else '[FAIL]'}")

        # =========================================================
        # TASK 3: Closed-Loop Critic & Surgical Patch Repair (N=3 Trials)
        # =========================================================
        print("\n--- [TASK 3] Closed-Loop Critic & Surgical Patch Repair (N=3 Trials) ---")
        t3_latencies: List[float] = []
        t3_recovered_count = 0
        t3_total_repair_attempts = 0
        t3_total_non_defective_fields = 0
        t3_preserved_non_defective_fields = 0
        raw_t3_trials = []

        all_fields = ["question_text", "option_a", "option_b", "option_c", "option_d", "correct_option", "explanation"]

        for trial_idx in range(NUM_TRIALS):
            t3_start = time.time()
            raw_critic_trial = {}

            for def_case in defective_mcqs:
                c_id = def_case["id"]
                d_field = def_case["defect_field"]
                mcq_orig = def_case["mcq"]

                non_def_fields = [f for f in all_fields if f != d_field]
                t3_total_non_defective_fields += len(non_def_fields)
                t3_total_repair_attempts += 1

                try:
                    crit_res = ClosedLoopCriticAgent.diagnose_and_repair(
                        mcq=mcq_orig,
                        validator_issues=def_case["issues"],
                        evidence_text=def_case["evidence"],
                        llm=llm,
                        max_attempts=2
                    )
                    raw_critic_trial[c_id] = {
                        "repair_strategy": crit_res.repair_strategy,
                        "patch_applied": crit_res.patch_applied.model_dump() if crit_res.patch_applied else None,
                        "final_passed": crit_res.final_validation_passed,
                        "repaired_mcq": crit_res.repaired_mcq.model_dump() if crit_res.repaired_mcq else None,
                        "attempts": crit_res.attempts_taken
                    }

                    if crit_res.final_validation_passed and crit_res.repaired_mcq:
                        t3_recovered_count += 1
                        # Strict 100% byte/value equivalence check on non-defective fields
                        for f in non_def_fields:
                            orig_val = getattr(mcq_orig, f)
                            new_val = getattr(crit_res.repaired_mcq, f)
                            if orig_val == new_val:
                                t3_preserved_non_defective_fields += 1
                except Exception as e:
                    raw_critic_trial[f"{c_id}_error"] = str(e)

            trial_lat = round(time.time() - t3_start, 2)
            t3_latencies.append(trial_lat)
            raw_t3_trials.append(raw_critic_trial)
            print(f"  Trial {trial_idx+1}/{NUM_TRIALS}: Latency={trial_lat}s | Recovered={t3_recovered_count}/{t3_total_repair_attempts}")

        t3_stats = compute_mean_std(t3_latencies)
        t3_recovery_pct = (t3_recovered_count / t3_total_repair_attempts) * 100.0
        t3_preservation_pct = (t3_preserved_non_defective_fields / max(1, t3_total_non_defective_fields)) * 100.0
        t3_stage1_pass = (t3_recovery_pct >= 90.0 and t3_preservation_pct == 100.0)

        with open(f"production_engine/experimental/experiment8/raw_outputs/{m_dir}/task3_critic.json", "w", encoding="utf-8") as f:
            json.dump({"model_id": m_id, "trials": raw_t3_trials}, f, indent=2)

        print(f"  Task 3 Summary: Recovery={t3_recovered_count}/{t3_total_repair_attempts} ({t3_recovery_pct:.1f}%) | Non-Defective Preservation={t3_preserved_non_defective_fields}/{t3_total_non_defective_fields} ({t3_preservation_pct:.1f}%) | Latency={t3_stats['mean']} ± {t3_stats['std']}s | Gate: {'[PASS]' if t3_stage1_pass else '[FAIL]'}")

        all_benchmark_results.append({
            "model_id": m_id,
            "model_label": m_label,
            "parameter_class": model_info["class"],
            "task1_representation": {
                "schema_compliance": f"{t1_schema_successes}/{t1_total_attempts} ({t1_schema_pct:.1f}%)",
                "multimodal_preservation": f"{t1_multimodal_preserved_count}/{NUM_TRIALS} ({t1_multi_pct:.1f}%)",
                "grounding_violation_rate": f"{t1_gv_pct:.1f}%",
                "latency_mean_sec": t1_stats["mean"],
                "latency_std_sec": t1_stats["std"],
                "latency_formatted": f"{t1_stats['mean']} ± {t1_stats['std']} s",
                "stage1_gate_passed": t1_stage1_pass
            },
            "task2_planning": {
                "schema_compliance": f"{t2_schema_successes}/{NUM_TRIALS} ({t2_schema_pct:.1f}%)",
                "grounding_violation_rate": f"{t2_gv_pct:.1f}%",
                "avg_facets_allocated": avg_facets,
                "latency_mean_sec": t2_stats["mean"],
                "latency_std_sec": t2_stats["std"],
                "latency_formatted": f"{t2_stats['mean']} ± {t2_stats['std']} s",
                "stage1_gate_passed": t2_stage1_pass
            },
            "task3_critic": {
                "defect_recovery": f"{t3_recovered_count}/{t3_total_repair_attempts} ({t3_recovery_pct:.1f}%)",
                "non_defective_field_preservation": f"{t3_preserved_non_defective_fields}/{t3_total_non_defective_fields} ({t3_preservation_pct:.1f}%)",
                "latency_mean_sec": t3_stats["mean"],
                "latency_std_sec": t3_stats["std"],
                "latency_formatted": f"{t3_stats['mean']} ± {t3_stats['std']} s",
                "stage1_gate_passed": t3_stage1_pass
            }
        })

    # Save summary benchmark JSON
    summary_file = "production_engine/outputs/experiment8_llm_benchmark_results.json"
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump({
            "experiment": "Experiment 8: LLM Task Specialization & Model Selection Benchmark",
            "benchmark_date": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "num_repeated_trials": NUM_TRIALS,
            "provider": "Groq Cloud API",
            "models_evaluated": all_benchmark_results
        }, f, indent=2)

    print("\n" + "="*80)
    print(f"EXPERIMENT 8 BENCHMARK COMPLETE! Results saved to: {summary_file}")
    print("="*80)


if __name__ == "__main__":
    run_experiment_8()
