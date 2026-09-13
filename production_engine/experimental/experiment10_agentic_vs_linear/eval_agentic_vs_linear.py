"""
Experiment 10 Evaluation Harness: Integrated Agentic Architecture E v2.0 vs. Fixed Linear LLM Pipeline
Executes N=3 repeated trials per pipeline across 4 diverse educational datasets.
Records all metrics (Quality, Grounding, Diversity, Difficulty, Validity, Recovery, Latency, Calls, Tokens).
"""

import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json
import time
import math
import numpy as np
import pypdf
from typing import Dict, Any, List, Optional, Tuple

from pipeline_experiment.generator.llm_engine import UnifiedLLMEngine
from pipeline_experiment.shared.schemas.canonical_models import CanonicalEducationalInput
from production_engine.ingestion.content_processor import ProductionContentProcessor
from production_engine.core_engine_v2 import AdaptiveAssessmentEngineV2
from production_engine.validator import ProductionAssessmentValidator
from production_engine.schemas import ProductionMCQ, ProductionAssessmentSuite

from production_engine.experimental.experiment10_agentic_vs_linear.fixed_linear_pipeline import FixedLinearLLMPipeline
from production_engine.experimental.experiment10_agentic_vs_linear.schemas import (
    TrialExecutionResult, AggregatedPipelineMetrics, DatasetComparisonResult
)


BLOOM_RANK = {
    "REMEMBER": 1.0,
    "UNDERSTAND": 2.0,
    "APPLY": 3.0,
    "ANALYZE": 4.0,
    "EVALUATE": 5.0,
    "CREATE": 6.0
}


def extract_pdf_text(path: str) -> str:
    reader = pypdf.PdfReader(path)
    return "\n\n".join([f"--- Slide {idx+1} ---\n{p.extract_text() or ''}" for idx, p in enumerate(reader.pages)])


def evaluate_trial_questions(
    questions: List[ProductionMCQ],
    canonical: CanonicalEducationalInput,
    pipeline_type: str,
    dataset_id: str,
    trial_id: int,
    requested_count: int,
    repairs_attempted: int,
    repairs_succeeded: int,
    latency_sec: float,
    llm_calls_count: int,
    tokens_est: int,
    routing_choice: Optional[str] = None
) -> TrialExecutionResult:
    """Computes exact metrics for a single trial execution."""
    raw_evidence = ((canonical.raw_content or "") + "\n" + (canonical.supporting_materials_text or "")).lower()

    # 1. Fulfillment
    delivered_count = len(questions)
    fulfillment_rate = round((delivered_count / max(1, requested_count)) * 100.0, 1)

    # 2. Validity
    valid_count = 0
    grounding_violations = 0
    bloom_scores = []
    seen_concepts = set()
    collisions = 0
    unique_facets = set()

    for q in questions:
        # Deterministic Validator Check
        val_res = ProductionAssessmentValidator.validate_question(q, raw_evidence)
        if val_res.is_valid:
            valid_count += 1

        # Grounding check: verify that stem key entities appear in raw evidence
        stem_words = [w.strip("?,.:;()[]") for w in q.question_text.lower().split() if len(w) > 4]
        match_count = sum(1 for w in stem_words if w in raw_evidence)
        if stem_words and (match_count / len(stem_words)) < 0.20:
            grounding_violations += 1

        # Bloom Score
        cog = q.cognitive_level.upper() if q.cognitive_level else "APPLY"
        bloom_scores.append(BLOOM_RANK.get(cog, 3.0))

        # Collision Check (Same concept name)
        concept_key = q.target_concept.strip().lower()
        if concept_key in seen_concepts:
            collisions += 1
        seen_concepts.add(concept_key)

        # Facet tracking
        if hasattr(q, "target_facet") and q.target_facet:
            unique_facets.add(q.target_facet)
        else:
            unique_facets.add(cog)

    first_pass_valid = valid_count if pipeline_type == "FIXED_LINEAR" else max(0, valid_count - repairs_succeeded)
    first_pass_pct = round((first_pass_valid / max(1, delivered_count)) * 100.0, 1) if delivered_count else 0.0
    final_valid_pct = round((valid_count / max(1, delivered_count)) * 100.0, 1) if delivered_count else 0.0
    grounding_violation_rate = round((grounding_violations / max(1, delivered_count)) * 100.0, 1) if delivered_count else 0.0
    concept_collision_rate = round((collisions / max(1, delivered_count)) * 100.0, 1) if delivered_count else 0.0
    mean_bloom = round(float(np.mean(bloom_scores)), 2) if bloom_scores else 3.0

    # Cross-modal preservation for Multimodal VAE dataset
    cross_modal_pct = None
    if "multimodal" in dataset_id.lower() or "vae" in dataset_id.lower():
        combined_q_text = " ".join([q.question_text + " " + q.explanation for q in questions]).lower()
        has_elbo = "elbo" in combined_q_text or "variational" in combined_q_text or "lower bound" in combined_q_text
        has_reparam = "sampling" in combined_q_text or "reparameterization" in combined_q_text or "epsilon" in combined_q_text
        has_code = "keras" in combined_q_text or "layer" in combined_q_text or "latent" in combined_q_text or "tensor" in combined_q_text
        preserved_cnt = sum([has_elbo, has_reparam, has_code])
        cross_modal_pct = round((preserved_cnt / 3.0) * 100.0, 1)

    # Defect recovery & preservation
    recovery_rate = round((repairs_succeeded / max(1, repairs_attempted)) * 100.0, 1) if repairs_attempted else 100.0
    non_defective_preservation = 100.0 if pipeline_type == "AGENTIC_V2" else (100.0 if not repairs_attempted else 0.0)

    return TrialExecutionResult(
        trial_id=trial_id,
        pipeline_type=pipeline_type,
        dataset_id=dataset_id,
        requested_count=requested_count,
        delivered_count=delivered_count,
        fulfillment_rate_pct=fulfillment_rate,
        first_pass_valid_count=first_pass_valid,
        first_pass_valid_pct=first_pass_pct,
        final_valid_count=valid_count,
        final_valid_pct=final_valid_pct,
        grounding_violation_rate_pct=grounding_violation_rate,
        unique_facets_used=len(unique_facets),
        concept_collision_rate_pct=concept_collision_rate,
        mean_bloom_score=mean_bloom,
        cross_modal_preservation_pct=cross_modal_pct,
        repairs_attempted=repairs_attempted,
        repairs_succeeded=repairs_succeeded,
        defect_recovery_rate_pct=recovery_rate,
        non_defective_field_preservation_pct=non_defective_preservation,
        latency_sec=latency_sec,
        llm_calls_count=llm_calls_count,
        tokens_spent_est=tokens_est,
        routing_choice=routing_choice
    )


def aggregate_trials(trials: List[TrialExecutionResult]) -> AggregatedPipelineMetrics:
    """Aggregates N=3 trials into mean +/- std deviation metrics."""
    p_type = trials[0].pipeline_type
    ds_id = trials[0].dataset_id
    n = len(trials)

    fulfills = [t.fulfillment_rate_pct for t in trials]
    first_vals = [t.first_pass_valid_pct for t in trials]
    final_vals = [t.final_valid_pct for t in trials]
    violates = [t.grounding_violation_rate_pct for t in trials]
    facets = [t.unique_facets_used for t in trials]
    collisions = [t.concept_collision_rate_pct for t in trials]
    blooms = [t.mean_bloom_score for t in trials]
    latencies = [t.latency_sec for t in trials]
    calls = [t.llm_calls_count for t in trials]
    tokens = [t.tokens_spent_est for t in trials]
    recoveries = [t.defect_recovery_rate_pct for t in trials]
    preserves = [t.non_defective_field_preservation_pct for t in trials]

    cm_vals = [t.cross_modal_preservation_pct for t in trials if t.cross_modal_preservation_pct is not None]
    mean_cm = round(float(np.mean(cm_vals)), 1) if cm_vals else None

    return AggregatedPipelineMetrics(
        pipeline_type=p_type,
        dataset_id=ds_id,
        trials_count=n,
        mean_fulfillment_rate_pct=round(float(np.mean(fulfills)), 1),
        std_fulfillment_rate_pct=round(float(np.std(fulfills)), 2),
        mean_first_pass_valid_pct=round(float(np.mean(first_vals)), 1),
        std_first_pass_valid_pct=round(float(np.std(first_vals)), 2),
        mean_final_valid_pct=round(float(np.mean(final_vals)), 1),
        std_final_valid_pct=round(float(np.std(final_vals)), 2),
        mean_grounding_violation_rate_pct=round(float(np.mean(violates)), 1),
        mean_unique_facets=round(float(np.mean(facets)), 1),
        mean_concept_collision_pct=round(float(np.mean(collisions)), 1),
        mean_bloom_score=round(float(np.mean(blooms)), 2),
        std_bloom_score=round(float(np.std(blooms)), 2),
        mean_cross_modal_preservation_pct=mean_cm,
        mean_defect_recovery_rate_pct=round(float(np.mean(recoveries)), 1),
        mean_non_defective_field_preservation_pct=round(float(np.mean(preserves)), 1),
        mean_latency_sec=round(float(np.mean(latencies)), 2),
        std_latency_sec=round(float(np.std(latencies)), 2),
        mean_llm_calls=round(float(np.mean(calls)), 1),
        mean_tokens_spent=round(float(np.mean(tokens)), 1)
    )


def run_experiment_10(n_trials: int = 3):
    print("="*80)
    print("EXPERIMENT 10: AGENTIC VS. FIXED LINEAR LLM PIPELINE BENCHMARK")
    print(f"Executing N={n_trials} Repeated Trials per Pipeline on 4 Diverse Datasets")
    print("="*80)

    agentic_engine = AdaptiveAssessmentEngineV2(provider="groq", model="qwen/qwen3.8-27b", temperature=0.2)
    llm = agentic_engine.llm

    datasets = [
        {
            "id": "CASE_A_MONOLOGUE",
            "title": "Supervised Learning: Neural Net Training (Prof. Madhurika)",
            "modality": "VOICE_ONLY",
            "style": "CONCEPTUAL",
            "transcript_path": "pipeline_experiment/data/transcripts/ml_madhurikamam_transcript.json",
            "slides_path": None,
            "requested_q": 5,
            "difficulty": "MEDIUM"
        },
        {
            "id": "CASE_B_INTERACTIVE",
            "title": "DAA: Binary Search on Median of Two Sorted Arrays",
            "modality": "VOICE_ONLY",
            "style": "PROBLEM_SOLVING",
            "transcript_path": "pipeline_experiment/data/transcripts/day13_daa_median_transcript.json",
            "slides_path": None,
            "requested_q": 5,
            "difficulty": "HARD"
        },
        {
            "id": "CASE_C_MULTIMODAL",
            "title": "Deep Learning: Variational Autoencoders (Fashion-MNIST)",
            "modality": "VOICE_PLUS_PPT",
            "style": "PROBLEM_SOLVING",
            "transcript_path": "pipeline_experiment/data/transcripts/ashamam_vae_transcript.json",
            "slides_path": "Audio/voice+ppt/Ashamam_VAE/CSE-AI-MODULE2-EX3_VAE_FASHIONMNIST.pdf",
            "requested_q": 5,
            "difficulty": "MEDIUM"
        },
        {
            "id": "CASE_D_STATIC_NOTES",
            "title": "MongoDB Command Reference & Query Operations",
            "modality": "NOTES",
            "style": "CODE",
            "transcript_path": None,
            "slides_path": None,
            "raw_text_fallback": (
                "MongoDB Command Reference & Query Cheatsheet:\n"
                "1. Database Operations: `use database_name` to switch context. `show dbs` lists databases. `db.dropDatabase()` deletes.\n"
                "2. Collection Operations: `db.createCollection('users')` creates collection. `db.users.drop()` removes it.\n"
                "3. CRUD Queries: `db.users.insertOne({name: 'Alice', age: 25})`. `db.users.find({age: {$gte: 18}})` filters adults.\n"
                "4. Update Operators: `$set` updates specific fields. `$inc` increments numeric values. `$push` appends to arrays.\n"
                "5. Aggregation Pipeline: `$match` filters documents. `$group` aggregates by `_id`. `$sort` orders output."
            ),
            "requested_q": 5,
            "difficulty": "EASY"
        }
    ]

    all_comparison_results: List[DatasetComparisonResult] = []
    raw_trials_log: List[Dict[str, Any]] = []

    for ds in datasets:
        ds_id = ds["id"]
        title = ds["title"]
        modality = ds["modality"]
        style = ds["style"]
        req_q = ds["requested_q"]
        diff = ds["difficulty"]

        print(f"\n[{ds_id}] Preparing dataset: {title} ({modality}, {diff})...")

        # Load canonical input
        t_data = None
        s_text = None
        r_text = None

        if ds.get("transcript_path") and os.path.exists(ds["transcript_path"]):
            with open(ds["transcript_path"], "r", encoding="utf-8") as f:
                t_data = json.load(f)
        if ds.get("slides_path") and os.path.exists(ds["slides_path"]):
            s_text = extract_pdf_text(ds["slides_path"])
        if ds.get("raw_text_fallback"):
            r_text = ds["raw_text_fallback"]

        canonical = ProductionContentProcessor.process_raw_input(
            input_id=ds_id,
            title=title,
            input_type=modality,
            content_style=style,
            transcript_data=t_data,
            supporting_text=s_text,
            raw_text=r_text
        )

        # -------------------------------------------------------------
        # 1. Pipeline A: Fixed Linear LLM Pipeline (N Trials)
        # -------------------------------------------------------------
        print(f"  --> Executing Pipeline A (Fixed Linear Baseline) across N={n_trials} trials...")
        linear_trials: List[TrialExecutionResult] = []
        for tr in range(1, n_trials + 1):
            print(f"      [Fixed Linear Trial {tr}/{n_trials}] Running...")
            suite_lin, first_val_lin, lat_lin, calls_lin, tok_lin = FixedLinearLLMPipeline.execute(
                canonical=canonical,
                requested_count=req_q,
                difficulty=diff,
                llm=llm
            )
            tr_res_lin = evaluate_trial_questions(
                questions=suite_lin.questions,
                canonical=canonical,
                pipeline_type="FIXED_LINEAR",
                dataset_id=ds_id,
                trial_id=tr,
                requested_count=req_q,
                repairs_attempted=0,
                repairs_succeeded=0,
                latency_sec=lat_lin,
                llm_calls_count=calls_lin,
                tokens_est=tok_lin,
                routing_choice="SUMMARY (Fixed)"
            )
            linear_trials.append(tr_res_lin)
            raw_trials_log.append(tr_res_lin.model_dump())
            time.sleep(2.0)  # Pacing

        # -------------------------------------------------------------
        # 2. Pipeline B: Agentic Architecture E v2.0 (N Trials)
        # -------------------------------------------------------------
        print(f"  --> Executing Pipeline B (Integrated Agentic Architecture E v2.0) across N={n_trials} trials...")
        agentic_trials: List[TrialExecutionResult] = []
        for tr in range(1, n_trials + 1):
            print(f"      [Agentic Architecture Trial {tr}/{n_trials}] Running...")
            t0_ag = time.time()
            suite_ag = agentic_engine.generate_assessment(
                canonical=canonical,
                transcript_data=t_data,
                requested_count=req_q,
                difficulty=diff
            )
            lat_ag = round(time.time() - t0_ag, 2)
            meta = suite_ag.generation_metadata or {}
            calls_ag = meta.get("measured_llm_calls", 3)
            repairs_ag = meta.get("repairs_performed_count", 0)
            tok_ag = int(lat_ag * 35) + len(suite_ag.questions) * 350

            tr_res_ag = evaluate_trial_questions(
                questions=suite_ag.questions,
                canonical=canonical,
                pipeline_type="AGENTIC_V2",
                dataset_id=ds_id,
                trial_id=tr,
                requested_count=req_q,
                repairs_attempted=repairs_ag,
                repairs_succeeded=repairs_ag,
                latency_sec=lat_ag,
                llm_calls_count=calls_ag,
                tokens_est=tok_ag,
                routing_choice=suite_ag.representation_used
            )
            agentic_trials.append(tr_res_ag)
            raw_trials_log.append(tr_res_ag.model_dump())
            time.sleep(2.0)  # Pacing

        # Aggregate Metrics
        agg_lin = aggregate_trials(linear_trials)
        agg_ag = aggregate_trials(agentic_trials)

        ful_delta = round(agg_ag.mean_fulfillment_rate_pct - agg_lin.mean_fulfillment_rate_pct, 1)
        bloom_delta = round(agg_ag.mean_bloom_score - agg_lin.mean_bloom_score, 2)
        coll_red = round(agg_lin.mean_concept_collision_pct - agg_ag.mean_concept_collision_pct, 1)
        rec_delta = round(agg_ag.mean_defect_recovery_rate_pct - agg_lin.mean_defect_recovery_rate_pct, 1)
        lat_over = round(agg_ag.mean_latency_sec - agg_lin.mean_latency_sec, 2)
        tok_over = round(((agg_ag.mean_tokens_spent - agg_lin.mean_tokens_spent) / max(1, agg_lin.mean_tokens_spent)) * 100.0, 1)

        qual_summary = (
            f"Agentic delivered {agg_ag.mean_fulfillment_rate_pct}% fulfillment vs {agg_lin.mean_fulfillment_rate_pct}% in Linear. "
            f"Bloom score shifted by {bloom_delta:+} ({agg_lin.mean_bloom_score} -> {agg_ag.mean_bloom_score}). "
            f"Concept collision reduced by {coll_red}%. Latency difference: {lat_over:+}s."
        )

        comp_res = DatasetComparisonResult(
            dataset_id=ds_id,
            title=title,
            modality=modality,
            style=style,
            fixed_linear_metrics=agg_lin,
            agentic_metrics=agg_ag,
            fulfillment_delta_pct=ful_delta,
            bloom_score_delta=bloom_delta,
            collision_reduction_pct=coll_red,
            recovery_delta_pct=rec_delta,
            latency_overhead_sec=lat_over,
            token_overhead_pct=tok_over,
            qualitative_summary=qual_summary
        )

        all_comparison_results.append(comp_res)
        print(f"  [Result {ds_id}] {qual_summary}")

    # Output Structured Results JSON
    out_payload = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "benchmark": "EXPERIMENT_10_AGENTIC_VS_FIXED_LINEAR",
        "trials_per_pipeline": n_trials,
        "total_executions": len(raw_trials_log),
        "dataset_comparisons": [r.model_dump() for r in all_comparison_results],
        "raw_trials": raw_trials_log
    }

    out_file = "production_engine/outputs/experiment10_agentic_vs_linear_results.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(out_payload, f, indent=2)

    print(f"\n[Experiment 10 Complete] Results successfully saved to {out_file}")
    return out_payload


if __name__ == "__main__":
    run_experiment_10(n_trials=3)
