"""
Production Acceptance Test Suite for Architecture E.
Executes and validates the 5 key production acceptance cases:
  Case 1: Static PDF -> Technical Summary representation
  Case 2: Voice Lecture -> Instructional Blueprint representation
  Case 3: Voice + PPT -> Unified representation
  Case 4: Capacity Guard -> Refusal to pad (Requested 10 on small content -> outputs <= 3)
  Case 5: Selectivity Guard -> Large lecture + few requested -> selects top targets
"""

import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json
import time
from typing import Dict, Any, List

from production_engine.core_engine import AdaptiveAssessmentEngine
from pipeline_experiment.scripts.run_single import load_canonical_input


def load_metadata_map() -> Dict[str, Any]:
    meta_map = {}
    for mf in ["pipeline_experiment/data/metadata.json", "pipeline_experiment/data/unseen_metadata.json"]:
        if os.path.exists(mf):
            with open(mf, "r", encoding="utf-8") as f:
                for item in json.load(f):
                    meta_map[item["input_id"]] = item
    return meta_map


def run_acceptance_suite():
    print("=" * 115)
    print("EXECUTING PRODUCTION ACCEPTANCE SUITE (5 CASES)")
    print("=" * 115)

    meta_map = load_metadata_map()
    engine = AdaptiveAssessmentEngine(provider="groq", model="qwen/qwen3.8-27b", temperature=0.2)

    test_cases = [
        {
            "case_id": "CASE_1_STATIC_PDF",
            "name": "Static PDF Course Material",
            "input_id": "input_01_daa_unit2",
            "requested_questions": 3,
            "expected_representation": "SUMMARY",
            "capacity_test": False
        },
        {
            "case_id": "CASE_2_VOICE_LECTURE",
            "name": "Live Spoken Voice Lecture",
            "input_id": "input_07_deepa_madam_lecture",
            "requested_questions": 3,
            "expected_representation": "BLUEPRINT",
            "capacity_test": False
        },
        {
            "case_id": "CASE_3_VOICE_PLUS_PPT",
            "name": "Multimodal Voice + Slide Deck",
            "input_id": "input_10_binary_trees_audio_ppt",
            "requested_questions": 3,
            "expected_representation": "UNIFIED",
            "capacity_test": False
        },
        {
            "case_id": "CASE_4_CAPACITY_GUARD",
            "name": "Small Content + High Requested Count (Anti-Padding Test)",
            "input_id": "input_13_wt_event_bubbling",
            "requested_questions": 10,
            "expected_representation": "SUMMARY",
            "capacity_test": True,
            "max_allowed_allocated": 3
        },
        {
            "case_id": "CASE_5_SELECTIVITY_GUARD",
            "name": "Large Lecture + Few Requested (Selectivity Test)",
            "input_id": "input_10_binary_trees_audio_ppt",
            "requested_questions": 2,
            "expected_representation": "UNIFIED",
            "capacity_test": False,
            "exact_expected_allocated": 2
        }
    ]

    results = []

    for tc in test_cases:
        print(f"\n>>> Running [{tc['case_id']}]: {tc['name']} ...")
        meta = meta_map[tc["input_id"]]
        canonical = load_canonical_input(meta)

        suite = engine.generate_assessment(canonical=canonical, requested_count=tc["requested_questions"])

        # Verifications
        rep_passed = (suite.representation_used == tc["expected_representation"])
        
        # Capacity guard check
        if tc.get("capacity_test"):
            cap_passed = (suite.final_question_count <= tc["max_allowed_allocated"])
            cap_msg = f"Requested: {tc['requested_questions']}, Defensible Capacity: {suite.defensible_capacity}, Final Allocated: {suite.final_question_count} (Passed <= {tc['max_allowed_allocated']})"
        elif "exact_expected_allocated" in tc:
            cap_passed = (suite.final_question_count == tc["exact_expected_allocated"])
            cap_msg = f"Requested: {tc['requested_questions']}, Final Allocated: {suite.final_question_count} (Exact match: {tc['exact_expected_allocated']})"
        else:
            cap_passed = (suite.final_question_count == tc["requested_questions"])
            cap_msg = f"Requested: {tc['requested_questions']}, Allocated: {suite.final_question_count}"

        # Traceability audit
        traceability_passed = all(
            bool(q.what_taught and q.why_assessed and q.evidence_refs and q.misconception_rationale)
            for q in suite.questions
        )

        overall_case_passed = rep_passed and cap_passed and traceability_passed and (suite.validation_status == "PASSED")

        status_str = "[PASSED]" if overall_case_passed else "[FAILED]"
        print(f"  {status_str} Representation: {suite.representation_used} (Expected: {tc['expected_representation']})")
        print(f"  {status_str} Capacity/Allocation: {cap_msg}")
        print(f"  {status_str} Traceability Audit: {'100% Present' if traceability_passed else 'Missing metadata'}")
        print(f"  {status_str} Validation Status: {suite.validation_status} | Latency: {suite.generation_metadata['total_latency_seconds']}s | LLM calls: {suite.generation_metadata['measured_llm_calls']}")

        results.append({
            "case_id": tc["case_id"],
            "name": tc["name"],
            "representation_used": suite.representation_used,
            "expected_representation": tc["expected_representation"],
            "rep_passed": rep_passed,
            "requested_count": tc["requested_questions"],
            "defensible_capacity": suite.defensible_capacity,
            "final_question_count": suite.final_question_count,
            "cap_passed": cap_passed,
            "traceability_passed": traceability_passed,
            "validation_status": suite.validation_status,
            "latency_seconds": suite.generation_metadata["total_latency_seconds"],
            "measured_llm_calls": suite.generation_metadata["measured_llm_calls"],
            "case_passed": overall_case_passed
        })

    print("\n" + "=" * 115)
    print("PRODUCTION ACCEPTANCE TEST SUITE SUMMARY")
    print("=" * 115)
    passed_count = sum(1 for r in results if r["case_passed"])
    print(f"Total Cases: {len(results)} | Passed: {passed_count} / {len(results)} ({passed_count/len(results)*100:.1f}%)")
    for r in results:
        mark = "[PASS]" if r["case_passed"] else "[FAIL]"
        print(f"  {mark} {r['case_id']:<26} | Rep: {r['representation_used']:<9} | Cap: {r['final_question_count']}/{r['requested_count']} | LLM Calls: {r['measured_llm_calls']} | Latency: {r['latency_seconds']}s")
    print("=" * 115)

    os.makedirs("production_engine/outputs", exist_ok=True)
    with open("production_engine/outputs/acceptance_suite_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)


if __name__ == "__main__":
    run_acceptance_suite()
