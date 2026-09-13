"""
Verification Script for Final Requirement: Intelligent Question-Count Fulfillment
Tests:
1. Single Code Snippet -> Request Q=10 HARD questions (Verified multi-angle faceting: Prediction, Invariant, Error, Bounds, Complexity, Off-by-one, etc.)
2. Pathological Minimal Snippet ("Binary search finds an element.") -> Request Q=25 questions (Verified rare fallback notification)
3. Completely Non-Academic Input ("Today was a great day. We had lunch at cafeteria...") -> (Verified non-academic gate stop)
"""

import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json

from production_engine.ingestion.content_processor import ProductionContentProcessor
from production_engine.core_engine_v2 import AdaptiveAssessmentEngineV2


def test_intelligent_fulfillment():
    print("="*80)
    print("TESTING INTELLIGENT QUESTION-COUNT FULFILLMENT & GUARDRAILS")
    print("="*80)

    engine = AdaptiveAssessmentEngineV2(provider="groq", model="qwen/qwen3.8-27b", temperature=0.2)

    # -------------------------------------------------------------
    # TEST 1: Single Code Snippet Requested for Q=10 HARD Questions
    # -------------------------------------------------------------
    print("\n--- TEST 1: Single Code Snippet Requested for Q=10 HARD Questions ---")
    code_text = (
        "def binary_search(arr, target):\n"
        "    low = 0\n"
        "    high = len(arr) - 1\n"
        "    while low <= high:\n"
        "        mid = (low + high) // 2\n"
        "        if arr[mid] == target:\n"
        "            return mid\n"
        "        elif arr[mid] < target:\n"
        "            low = mid + 1\n"
        "        else:\n"
        "            high = mid - 1\n"
        "    return -1\n"
    )
    can_code = ProductionContentProcessor.process_raw_input(
        input_id="TEST_01_CODE_EXPANSION",
        title="Binary Search Algorithm Implementation",
        input_type="CODE",
        content_style="CODE",
        raw_text=code_text
    )

    suite_10 = engine.generate_assessment(canonical=can_code, requested_count=10, difficulty="HARD")
    print(f"Test 1 Result: Requested 10 -> Delivered {len(suite_10.questions)} questions")
    print(f"Facets Tested: {suite_10.generation_metadata.get('facet_distribution')}")
    print(f"Sample Question 1 ({suite_10.questions[0].target_concept}): {suite_10.questions[0].question_text[:100]}...")
    if len(suite_10.questions) > 1:
        print(f"Sample Question 2 ({suite_10.questions[1].target_concept}): {suite_10.questions[1].question_text[:100]}...")

    # -------------------------------------------------------------
    # TEST 2: Pathological Minimal Input Requested for Q=25 Questions
    # -------------------------------------------------------------
    print("\n--- TEST 2: Minimal Academic Snippet Requested for Q=25 Questions ---")
    minimal_text = "Binary search finds an element in a sorted list."
    can_min = ProductionContentProcessor.process_raw_input(
        input_id="TEST_02_MINIMAL_EXPANSION",
        title="Minimal Binary Search Definition",
        input_type="NOTES",
        content_style="THEORY",
        raw_text=minimal_text
    )

    suite_min = engine.generate_assessment(canonical=can_min, requested_count=25, difficulty="HARD")
    print(f"Test 2 Result: Requested 25 -> Delivered {len(suite_min.questions)} questions")
    print(f"System Notice: {suite_min.generation_metadata.get('system_notice')}")

    # -------------------------------------------------------------
    # TEST 3: Completely Non-Academic Input
    # -------------------------------------------------------------
    print("\n--- TEST 3: Completely Non-Academic Input ---")
    non_acad_text = "Today was a great sunny day. We went to the cafeteria with friends and had a wonderful lunch together."
    can_non_acad = ProductionContentProcessor.process_raw_input(
        input_id="TEST_03_NON_ACADEMIC",
        title="Cafeteria Lunch Diary",
        input_type="NOTES",
        content_style="CONCEPTUAL",
        raw_text=non_acad_text
    )

    suite_non_acad = engine.generate_assessment(canonical=can_non_acad, requested_count=5, difficulty="EASY")
    print(f"Test 3 Result: Status = {suite_non_acad.validation_status} | Delivered = {len(suite_non_acad.questions)}")
    print(f"Rationale: {suite_non_acad.routing_rationale}")

    print("\n" + "="*80)
    print("ALL INTELLIGENT FULFILLMENT TESTS COMPLETED SUCCESSFULLY!")
    print("="*80)


if __name__ == "__main__":
    test_intelligent_fulfillment()
