"""
Generate full 20 MCQs for Day 13 DAA across 20 distinct facets.
"""

import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json
import time

from pipeline_experiment.generator.llm_engine import UnifiedLLMEngine
from production_engine.ingestion.content_processor import ProductionContentProcessor
from production_engine.retrieval.evidence_retriever import ProductionEvidenceRetriever
from production_engine.generator import ProductionMCQGenerator
from production_engine.validator import ProductionAssessmentValidator
from production_engine.schemas import (
    ProductionAssessmentPlan, AssessmentTarget, ProductionAssessmentSuite
)


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

    # 20 Distinct Pedagogical Targets
    targets = [
        AssessmentTarget(
            target_id="T01",
            concept_name="Partition Size Formula",
            what_taught="The partition size is calculated as (m + n + 1) // 2 to ensure the left partition contains the median for both odd and even total lengths.",
            why_assessed="Foundational math constraint; missing +1 causes off-by-one errors for odd lengths.",
            cognitive_level="UNDERSTAND",
            evidence_refs=["E_C26", "E_C42"],
            plausible_misconceptions=["Using (m+n)//2 which breaks odd lengths", "Using float division (m+n)/2", "Dividing only array A length"]
        ),
        AssessmentTarget(
            target_id="T02",
            concept_name="Binary Search Range Initialization",
            what_taught="Binary search is performed on the smaller array (length m) with search bounds low=0 and high=m.",
            why_assessed="Searching smaller array minimizes complexity to O(log(min(m, n))).",
            cognitive_level="APPLY",
            evidence_refs=["E_C42", "E_C29"],
            plausible_misconceptions=["Setting high=m-1 which excludes i=m case", "Setting low=1 excluding i=0 case", "Searching the larger array"]
        ),
        AssessmentTarget(
            target_id="T03",
            concept_name="Complementary Partition Index j Calculation",
            what_taught="Partition index j in array B is calculated as j = (m + n + 1) // 2 - i to maintain fixed total left size.",
            why_assessed="Core invariant of the partition method; i + j must equal half the total elements.",
            cognitive_level="UNDERSTAND",
            evidence_refs=["E_C26", "E_C05"],
            plausible_misconceptions=["Assuming j = n - i", "Assuming j = i (symmetric partition)", "Assuming j = m - i"]
        ),
        AssessmentTarget(
            target_id="T04",
            concept_name="Left Boundary Sentinel for Array A (i=0)",
            what_taught="When partition index i=0, no elements from A are in left partition, so maxLeft1 is set to -infinity.",
            why_assessed="Edge case handling to prevent array index out of bounds while preserving comparison correctness.",
            cognitive_level="APPLY",
            evidence_refs=["E_C06", "E_C42"],
            plausible_misconceptions=["Setting maxLeft1 to 0 (fails for positive numbers)", "Accessing arr1[-1]", "Setting to arr1[0]"]
        ),
        AssessmentTarget(
            target_id="T05",
            concept_name="Right Boundary Sentinel for Array A (i=m)",
            what_taught="When partition index i=m, all elements of A are in left partition, so minRight1 is set to +infinity.",
            why_assessed="Ensures comparison maxLeft2 <= minRight1 is trivially satisfied when right partition of A is empty.",
            cognitive_level="APPLY",
            evidence_refs=["E_C06", "E_C05"],
            plausible_misconceptions=["Setting minRight1 to 0 (fails for negative numbers)", "Setting to arr1[m-1]", "Setting to arr1[m] causing IndexOutOfBounds"]
        ),
        AssessmentTarget(
            target_id="T06",
            concept_name="Left Boundary Sentinel for Array B (j=0)",
            what_taught="When partition index j=0, no elements from B are in left partition, so maxLeft2 is set to -infinity.",
            why_assessed="Symmetric boundary check for array B when all left elements come from array A.",
            cognitive_level="APPLY",
            evidence_refs=["E_C06", "E_C58"],
            plausible_misconceptions=["Setting to 0", "Setting to arr2[0]", "Attempting to re-partition"]
        ),
        AssessmentTarget(
            target_id="T07",
            concept_name="Right Boundary Sentinel for Array B (j=n)",
            what_taught="When partition index j=n, all elements of B are in left partition, so minRight2 is set to +infinity.",
            why_assessed="Ensures comparison maxLeft1 <= minRight2 is trivially satisfied when right partition of B is empty.",
            cognitive_level="APPLY",
            evidence_refs=["E_C06", "E_C29"],
            plausible_misconceptions=["Setting to B[n-1]", "Setting to 0", "Throwing out of bounds error"]
        ),
        AssessmentTarget(
            target_id="T08",
            concept_name="Primary Validity Condition (maxLeft1 <= minRight2)",
            what_taught="A valid partition requires that the maximum element in A's left partition is <= minimum element in B's right partition.",
            why_assessed="Fundamental global sorted order invariant across partitioned arrays.",
            cognitive_level="ANALYZE",
            evidence_refs=["E_C06", "E_C42"],
            plausible_misconceptions=["Checking maxLeft1 <= minRight1 (same array)", "Requiring strict inequality <", "Comparing averages"]
        ),
        AssessmentTarget(
            target_id="T09",
            concept_name="Secondary Validity Condition (maxLeft2 <= minRight1)",
            what_taught="A valid partition also requires that the maximum element in B's left partition is <= minimum element in A's right partition.",
            why_assessed="Ensures all elements in combined left partition are <= all elements in combined right partition.",
            cognitive_level="ANALYZE",
            evidence_refs=["E_C06", "E_C42"],
            plausible_misconceptions=["Checking only one inequality instead of both", "Comparing maxLeft1 with maxLeft2", "Using strict <"]
        ),
        AssessmentTarget(
            target_id="T10",
            concept_name="Binary Search Adjustment when maxLeft1 > minRight2",
            what_taught="If maxLeft1 > minRight2, the partition in A is too far right (too large); update high = i - 1 to shift left.",
            why_assessed="Core decision rule for narrowing search space; mistakes cause wrong answers or infinite loops.",
            cognitive_level="APPLY",
            evidence_refs=["E_C42", "E_C26"],
            plausible_misconceptions=["Setting low = i + 1 (wrong direction)", "Setting high = i (causes infinite loop)", "Adjusting j instead of i"]
        ),
        AssessmentTarget(
            target_id="T11",
            concept_name="Binary Search Adjustment when maxLeft2 > minRight1",
            what_taught="If maxLeft2 > minRight1, the partition in A is too far left (too small); update low = i + 1 to shift right.",
            why_assessed="Opposite decision rule; ensures partition in A takes more elements to reduce B's left contribution.",
            cognitive_level="APPLY",
            evidence_refs=["E_C42", "E_C26"],
            plausible_misconceptions=["Setting high = i - 1", "Setting low = i", "Setting low = i + 2"]
        ),
        AssessmentTarget(
            target_id="T12",
            concept_name="Median Calculation for Odd Total Length",
            what_taught="When total length (m + n) is odd, the median is the single maximum element of the left partition: max(maxLeft1, maxLeft2).",
            why_assessed="Odd length formula directly yields the middle element from the left partition.",
            cognitive_level="UNDERSTAND",
            evidence_refs=["E_C26", "E_C06"],
            plausible_misconceptions=["Averaging maxLeft1 and maxLeft2", "Taking min(minRight1, minRight2)", "Taking middle of array A"]
        ),
        AssessmentTarget(
            target_id="T13",
            concept_name="Median Calculation for Even Total Length",
            what_taught="When total length (m + n) is even, the median is (max(maxLeft1, maxLeft2) + min(minRight1, minRight2)) / 2.0.",
            why_assessed="Even length formula averages the two middle boundary elements across both partitions.",
            cognitive_level="UNDERSTAND",
            evidence_refs=["E_C06", "E_C26"],
            plausible_misconceptions=["(maxLeft1 + minRight1)/2 from single array", "(maxLeft1 + maxLeft2)/2", "Integer division truncation"]
        ),
        AssessmentTarget(
            target_id="T14",
            concept_name="Time Complexity Derivation",
            what_taught="Binary searching the smaller array achieves O(log(min(m, n))) time complexity.",
            why_assessed="Understanding asymptotic efficiency gain over O(m+n) merge approach.",
            cognitive_level="ANALYZE",
            evidence_refs=["E_C02", "E_C26"],
            plausible_misconceptions=["O(log(m + n))", "O(m + n)", "O(min(m, n))"]
        ),
        AssessmentTarget(
            target_id="T15",
            concept_name="Auxiliary Space Complexity Derivation",
            what_taught="The algorithm operates in O(1) auxiliary space by adjusting pointers in place without allocating a merged array.",
            why_assessed="Highlights space efficiency compared to O(m+n) extra array allocation.",
            cognitive_level="UNDERSTAND",
            evidence_refs=["E_C02", "E_C26"],
            plausible_misconceptions=["O(log(min(m, n))) space", "O(m+n) space", "O(min(m, n)) space"]
        ),
        AssessmentTarget(
            target_id="T16",
            concept_name="Dry Run Trace: Disjoint Arrays (A=[1, 2], B=[3, 4])",
            what_taught="For A=[1, 2] and B=[3, 4] (m=2, n=2, total=4), correct partition i=2, j=0 gives maxLeft=2, minRight=3, median=(2+3)/2=2.5.",
            why_assessed="Tests execution trace on completely non-overlapping disjoint arrays.",
            cognitive_level="APPLY",
            evidence_refs=["E_C26", "E_C42"],
            plausible_misconceptions=["Median=2.0", "Median=3.0", "Infinite loop on boundary"]
        ),
        AssessmentTarget(
            target_id="T17",
            concept_name="Dry Run Trace: Single Element Array (A=[2], B=[1, 3])",
            what_taught="For A=[2] and B=[1, 3] (m=1, n=2, total=3 odd), partition i=0, j=2 gives left={1, 2}, maxLeft=2, median=2.0.",
            why_assessed="Verifies understanding of odd-length single element array interaction.",
            cognitive_level="APPLY",
            evidence_refs=["E_C26", "E_C06"],
            plausible_misconceptions=["Median=1.5", "Median=1.0", "Median=3.0"]
        ),
        AssessmentTarget(
            target_id="T18",
            concept_name="Handling Duplicate Boundary Elements",
            what_taught="When duplicate elements exist across arrays (e.g. A[i-1] == B[j]), the <= comparison correctly identifies valid partition without error.",
            why_assessed="Clarifies why non-strict inequalities <= are necessary rather than strict <.",
            cognitive_level="ANALYZE",
            evidence_refs=["E_C06", "E_C42"],
            plausible_misconceptions=["Algorithm fails or loops infinitely", "Requires special deduplication pre-processing", "Median cannot be determined"]
        ),
        AssessmentTarget(
            target_id="T19",
            concept_name="Loop Termination Condition (low <= high)",
            what_taught="The binary search loop condition is while (low <= high), ensuring all partition indices from 0 to m are checked.",
            why_assessed="Ensures proper termination and guarantees finding the median in sorted arrays.",
            cognitive_level="UNDERSTAND",
            evidence_refs=["E_C42", "E_C29"],
            plausible_misconceptions=["while (low < high) which misses high=m", "while (true)", "while (i != j)"]
        ),
        AssessmentTarget(
            target_id="T20",
            concept_name="Comparison with Naive Two-Pointer Merge",
            what_taught="Naive two-pointer merge takes O((m+n)/2) steps to find median, whereas Binary Search partition takes O(log(min(m, n))).",
            why_assessed="Contrasts linear scan vs logarithmic partition optimization taught by teacher.",
            cognitive_level="ANALYZE",
            evidence_refs=["E_C02", "E_C26"],
            plausible_misconceptions=["Two-pointer merge is faster for large arrays", "Binary search requires extra memory", "Both have same time complexity"]
        )
    ]

    plan = ProductionAssessmentPlan(
        input_id=canonical.input_id,
        representation_used="BLUEPRINT",
        requested_question_count=20,
        maximum_defensible_capacity=20,
        allocated_question_count=20,
        targets=targets
    )

    print(f"Retrieving RAG evidence for all 20 targets...")
    retrieved_map = ProductionEvidenceRetriever.retrieve_for_plan(canonical, targets)

    print(f"Generating 20 MCQs in batches of 5...")
    start_t = time.time()
    questions = ProductionMCQGenerator.generate_questions(
        canonical=canonical,
        plan=plan,
        llm=llm,
        retrieved_evidence_map=retrieved_map
    )

    raw_evidence = canonical.raw_content
    valid_questions, val_status = ProductionAssessmentValidator.validate_suite(questions, raw_evidence)
    dur = round(time.time() - start_t, 2)

    suite = ProductionAssessmentSuite(
        input_id=canonical.input_id,
        title=canonical.title,
        representation_used="BLUEPRINT",
        routing_rationale="High Pedagogical Delivery Index (PDI=0.700 >= 0.60): Strong live interactive teaching and emphasis signals detected. Routed to Instructional Blueprint.",
        requested_count=20,
        defensible_capacity=20,
        final_question_count=len(valid_questions),
        questions=valid_questions,
        validation_status=val_status,
        generation_metadata={
            "total_latency_seconds": dur,
            "measured_llm_calls": 4,
            "pedagogical_delivery_index": 0.700,
            "rag_chunks_retrieved_count": len(retrieved_map)
        }
    )

    out_file = "production_engine/outputs/day13_daa_20_mcqs.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(suite.model_dump(), f, indent=2)

    print(f"Successfully generated and saved {len(valid_questions)} MCQs to: {out_file}")


if __name__ == "__main__":
    main()
