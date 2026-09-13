"""
Single-Input Experiment Runner.
Executes Pipeline A (Summary) and Pipeline B (Blueprint) sequentially on a single educational input,
saves intermediate artifacts for full traceability, computes Level 1 metrics, and applies predefined decision rules.
"""

import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json
import argparse
from typing import Dict, Any

from pipeline_experiment.shared.schemas.canonical_models import (
    CanonicalEducationalInput,
    PedagogicalSummary,
    MCQSuite
)
from pipeline_experiment.shared.extraction.material_extractor import DeterministicMaterialExtractor
from pipeline_experiment.shared.chunking.semantic_chunker import SemanticInstructionalChunker
from pipeline_experiment.pipeline_a_summary.summarizer import ConventionalSummarizer
from pipeline_experiment.pipeline_b_blueprint.concept_mapper import DecoupledConceptMapper
from pipeline_experiment.pipeline_b_blueprint.salience_profiler import MultiSignalSalienceProfiler
from pipeline_experiment.pipeline_b_blueprint.pedagogical_interpreter import PedagogicalInterpreter
from pipeline_experiment.pipeline_b_blueprint.blueprint_builder import PedagogicalBlueprintBuilder
from pipeline_experiment.pipeline_b_blueprint.assessment_planner import AssessmentPlanner
from pipeline_experiment.pipeline_b_blueprint.slot_builder import AssessmentSlotBuilder

from pipeline_experiment.generator.llm_engine import UnifiedLLMEngine
from pipeline_experiment.generator.prompt import SymmetricalPromptBuilder
from pipeline_experiment.generator.validator import SharedMCQValidator
from pipeline_experiment.pipeline_c_combined.engine import PipelineCEngine

from pipeline_experiment.evaluation.automated_metrics import AutomatedMetricsEvaluator
from pipeline_experiment.evaluation.blueprint_validator import BlueprintValidityEvaluator
from pipeline_experiment.evaluation.blind_sme import BlindSMEPackager
from pipeline_experiment.evaluation.reports import ResultsCompiler


def load_canonical_input(item_meta: Dict[str, Any], base_dir: str = "pipeline_experiment") -> CanonicalEducationalInput:
    file_rel = item_meta["file_path"]
    if os.path.exists(file_rel):
        full_path = file_rel
    else:
        full_path = os.path.join(base_dir, file_rel)

    raw_text = ""
    supporting_text = None

    if full_path.endswith(".json"):
        with open(full_path, "r", encoding="utf-8") as f:
            j_data = json.load(f)
        raw_text = j_data.get("raw_content", "")
        supporting_text = j_data.get("supporting_materials_text")
    elif full_path.endswith(".docx"):
        res = DeterministicMaterialExtractor.extract_docx(full_path)
        raw_text = res["concatenated_text"]
    elif full_path.endswith(".pptx"):
        res = DeterministicMaterialExtractor.extract_pptx(full_path)
        raw_text = res["concatenated_text"]
    elif full_path.endswith(".pdf"):
        res = DeterministicMaterialExtractor.extract_pdf(full_path)
        raw_text = res["concatenated_text"]
    elif full_path.endswith(".ipynb"):
        res = DeterministicMaterialExtractor.extract_ipynb(full_path)
        raw_text = res["concatenated_text"]
    else:
        raw_text = DeterministicMaterialExtractor.extract_text_or_code(full_path)

    # Check for supporting material
    if "supporting_material_path" in item_meta and item_meta["supporting_material_path"]:
        supp_rel = item_meta["supporting_material_path"]
        if os.path.exists(supp_rel):
            supp_path = supp_rel
        elif os.path.exists(os.path.join(base_dir, supp_rel)):
            supp_path = os.path.join(base_dir, supp_rel)
        else:
            # Fallback search by basename
            base_fname = os.path.basename(supp_rel)
            found = False
            for root, _, files in os.walk("."):
                if base_fname in files:
                    supp_path = os.path.join(root, base_fname)
                    found = True
                    break
            if not found:
                supp_path = supp_rel

        if supp_path.endswith(".pptx"):
            supp_res = DeterministicMaterialExtractor.extract_pptx(supp_path)
            supporting_text = supp_res["concatenated_text"]
        elif supp_path.endswith(".pdf"):
            supp_res = DeterministicMaterialExtractor.extract_pdf(supp_path)
            supporting_text = supp_res["concatenated_text"]
        elif supp_path.endswith(".docx"):
            supp_res = DeterministicMaterialExtractor.extract_docx(supp_path)
            supporting_text = supp_res["concatenated_text"]
            supp_res = DeterministicMaterialExtractor.extract_docx(supp_path)
            supporting_text = supp_res["concatenated_text"]

    canonical = CanonicalEducationalInput(
        input_id=item_meta["input_id"],
        title=item_meta["title"],
        input_type=item_meta["input_type"],
        content_style=item_meta["content_style"],
        duration_seconds=item_meta.get("duration_seconds", 0.0),
        raw_content=raw_text,
        supporting_materials_text=supporting_text
    )
    return SemanticInstructionalChunker.chunk_input(canonical)


def run_single_experiment(
    item_meta: Dict[str, Any],
    llm: UnifiedLLMEngine,
    question_count: int = 5,
    results_root: str = "pipeline_experiment/results"
) -> Dict[str, Any]:
    input_id = item_meta["input_id"]
    trace_dir = os.path.join(results_root, "intermediate", input_id)
    os.makedirs(trace_dir, exist_ok=True)
    os.makedirs(os.path.join(trace_dir, "pipeline_a"), exist_ok=True)
    os.makedirs(os.path.join(trace_dir, "pipeline_b"), exist_ok=True)
    os.makedirs(os.path.join(trace_dir, "evaluation"), exist_ok=True)

    print(f"\n[{input_id}] Processing input: {item_meta['title']} ({item_meta['input_type']}/{item_meta['content_style']})...", flush=True)

    # 1. Canonical Shared Extraction & Chunking
    canonical_input = load_canonical_input(item_meta)
    with open(os.path.join(trace_dir, "01_canonical_chunks.json"), "w", encoding="utf-8") as f:
        json.dump([c.model_dump() for c in canonical_input.chunks], f, indent=2)

    # 2. Pipeline A: Conventional Summary Representation
    print(f"  -> Pipeline A: Extracting conventional summary...", flush=True)
    summarizer = ConventionalSummarizer(llm)
    summary = summarizer.generate_summary(canonical_input)
    with open(os.path.join(trace_dir, "pipeline_a", "02_summary.json"), "w", encoding="utf-8") as f:
        json.dump(summary.model_dump(), f, indent=2)

    # 3. Pipeline A: Symmetrical MCQ Generation
    print(f"  -> Pipeline A: Generating {question_count} MCQs...", flush=True)
    prompt_a = SymmetricalPromptBuilder.build_summary_prompt(
        summary=summary,
        question_count=question_count,
        title=canonical_input.title,
        input_type=canonical_input.input_type,
        content_style=canonical_input.content_style
    )
    suite_a_raw = llm.generate_pydantic(
        prompt=prompt_a,
        pydantic_class=MCQSuite,
        system_prompt=SymmetricalPromptBuilder.SHARED_SYSTEM_PROMPT
    )
    _, _, suite_a = SharedMCQValidator.validate_suite(suite_a_raw)
    suite_a.pipeline_type = "PIPELINE_A_SUMMARY"
    suite_a.input_id = input_id
    suite_a.input_type = canonical_input.input_type
    suite_a.content_style = canonical_input.content_style

    with open(os.path.join(trace_dir, "pipeline_a", "03_mcq_suite_a.json"), "w", encoding="utf-8") as f:
        json.dump(suite_a.model_dump(), f, indent=2)

    # 4. Pipeline B: 4-Layer Pedagogical Blueprint
    print(f"  -> Pipeline B: Extracting Decoupled Topic Hierarchy...", flush=True)
    concept_mapper = DecoupledConceptMapper(llm)
    topics = concept_mapper.extract_concept_map(canonical_input)
    with open(os.path.join(trace_dir, "pipeline_b", "02_concept_map.json"), "w", encoding="utf-8") as f:
        json.dump([t.model_dump() for t in topics], f, indent=2)

    print(f"  -> Pipeline B: Computing Multi-Signal Salience Scores...", flush=True)
    salience_profiles = MultiSignalSalienceProfiler.compute_salience_profiles(canonical_input, topics)

    print(f"  -> Pipeline B: Inferring Pedagogical Acts & Bloom Levels...", flush=True)
    interpreter = PedagogicalInterpreter(llm)
    interpretations = interpreter.interpret_topics(canonical_input, salience_profiles)

    print(f"  -> Pipeline B: Building Table of Specifications (Blueprint)...", flush=True)
    blueprint = PedagogicalBlueprintBuilder.build_blueprint(canonical_input, salience_profiles, interpretations)
    with open(os.path.join(trace_dir, "pipeline_b", "03_blueprint.json"), "w", encoding="utf-8") as f:
        json.dump(blueprint.model_dump(), f, indent=2)

    print(f"  -> Pipeline B: Allocating Assessment Plan Quotas...", flush=True)
    plan = AssessmentPlanner.create_assessment_plan(blueprint, total_questions=question_count)
    with open(os.path.join(trace_dir, "pipeline_b", "04_assessment_plan.json"), "w", encoding="utf-8") as f:
        json.dump(plan.model_dump(), f, indent=2)

    print(f"  -> Pipeline B: Instantiating Assessment Slots...", flush=True)
    slot_builder = AssessmentSlotBuilder(llm)
    slots = slot_builder.build_slots(canonical_input, blueprint, plan)
    with open(os.path.join(trace_dir, "pipeline_b", "05_assessment_slots.json"), "w", encoding="utf-8") as f:
        json.dump([s.model_dump() for s in slots], f, indent=2)

    # 5. Pipeline B: Symmetrical MCQ Generation
    print(f"  -> Pipeline B: Generating {question_count} MCQs from Slots...", flush=True)
    prompt_b = SymmetricalPromptBuilder.build_blueprint_prompt(
        slots=slots,
        question_count=question_count,
        title=canonical_input.title,
        input_type=canonical_input.input_type,
        content_style=canonical_input.content_style
    )
    suite_b_raw = llm.generate_pydantic(
        prompt=prompt_b,
        pydantic_class=MCQSuite,
        system_prompt=SymmetricalPromptBuilder.SHARED_SYSTEM_PROMPT
    )
    _, _, suite_b = SharedMCQValidator.validate_suite(suite_b_raw)
    suite_b.pipeline_type = "PIPELINE_B_BLUEPRINT"
    suite_b.input_id = input_id
    suite_b.input_type = canonical_input.input_type
    suite_b.content_style = canonical_input.content_style

    with open(os.path.join(trace_dir, "pipeline_b", "06_mcq_suite_b.json"), "w", encoding="utf-8") as f:
        json.dump(suite_b.model_dump(), f, indent=2)

    # 6. Pipeline C: Unified Dual-Model Assessment Engine (WHAT + WHY)
    print(f"  -> Pipeline C: Synthesizing Unified Assessment Plan (WHAT + WHY)...", flush=True)
    os.makedirs(os.path.join(trace_dir, "pipeline_c"), exist_ok=True)
    engine_c = PipelineCEngine(llm)
    c_results = engine_c.generate_assessment(
        canonical_input=canonical_input,
        summary=summary,
        blueprint=blueprint,
        question_count=question_count
    )
    unified_plan = c_results["unified_plan"]
    suite_c = c_results["mcq_suite"]

    with open(os.path.join(trace_dir, "pipeline_c", "04_unified_plan.json"), "w", encoding="utf-8") as f:
        json.dump(unified_plan.model_dump(), f, indent=2)

    with open(os.path.join(trace_dir, "pipeline_c", "06_mcq_suite_c.json"), "w", encoding="utf-8") as f:
        json.dump(suite_c.model_dump(), f, indent=2)

    # 7. Evaluation: 3-Way Automated Metrics & Blueprint Validity
    print(f"  -> Running 3-Way Automated Metrics Evaluation (A vs B vs C)...", flush=True)
    metrics_a = AutomatedMetricsEvaluator.evaluate_suite(canonical_input, suite_a)
    metrics_b = AutomatedMetricsEvaluator.evaluate_suite(canonical_input, suite_b)
    metrics_c = AutomatedMetricsEvaluator.evaluate_suite(canonical_input, suite_c)
    bp_validity = BlueprintValidityEvaluator.evaluate_blueprint_validity(canonical_input, blueprint)

    three_way_decision = ResultsCompiler.determine_three_way_winner(metrics_a, metrics_b, metrics_c)

    eval_payload = {
        "metrics_summary_pipeline_a": metrics_a,
        "metrics_blueprint_pipeline_b": metrics_b,
        "metrics_unified_pipeline_c": metrics_c,
        "blueprint_validity_experiment_b1": bp_validity.model_dump(),
        "decision": ResultsCompiler.determine_winner_rule(metrics_a, metrics_b),
        "three_way_decision": three_way_decision
    }
    with open(os.path.join(trace_dir, "evaluation", "07_metrics.json"), "w", encoding="utf-8") as f:
        json.dump(eval_payload, f, indent=2)

    # 8. Blind SME Evaluation Packet (3-Way Shuffled)
    blind_packet = BlindSMEPackager.create_blind_packet(suite_a, suite_b)
    with open(os.path.join(trace_dir, "evaluation", "08_blind_sme_packet.json"), "w", encoding="utf-8") as f:
        json.dump(blind_packet, f, indent=2)

    # 9. Generate Level 1 Markdown Report
    os.makedirs(os.path.join(results_root, "per_input"), exist_ok=True)
    level_1_md = ResultsCompiler.generate_level_1_markdown(
        input_id=input_id,
        title=canonical_input.title,
        input_type=canonical_input.input_type,
        content_style=canonical_input.content_style,
        metrics_a=metrics_a,
        metrics_b=metrics_b,
        suite_a=suite_a,
        suite_b=suite_b,
        blueprint_validity=bp_validity.model_dump()
    )
    with open(os.path.join(results_root, "per_input", f"{input_id}_report.md"), "w", encoding="utf-8") as f:
        f.write(level_1_md)

    print(f"  [COMPLETED] 3-Way Winner: {three_way_decision['winner']} (Q_A: {three_way_decision['q_summary_a']}, Q_B: {three_way_decision['q_blueprint_b']}, Q_C: {three_way_decision['q_unified_c']})", flush=True)

    return {
        "input_id": input_id,
        "input_type": canonical_input.input_type,
        "content_style": canonical_input.content_style,
        "metrics_a": metrics_a,
        "metrics_b": metrics_b,
        "metrics_c": metrics_c,
        "blueprint_validity": bp_validity.model_dump(),
        "decision": eval_payload["decision"],
        "three_way_decision": three_way_decision,
        "suite_a": suite_a.model_dump(),
        "suite_b": suite_b.model_dump(),
        "suite_c": suite_c.model_dump()
    }
