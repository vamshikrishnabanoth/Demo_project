"""
Experiment 11: End-to-End Production Validation & Fault-Injection Schemas
Defines data structures for 15-Point Acceptance Criteria, Fault-Injection Scenarios,
Dataset Execution Results, and Acceptance Matrix Compilation.
"""

from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field


class AcceptanceCriterion(BaseModel):
    criterion_id: int
    name: str
    target_threshold: str
    measured_value: str
    status: str  # "PASS" | "FAIL"
    scientific_rationale: str


class FaultInjectionResult(BaseModel):
    scenario_id: str
    scenario_name: str
    injected_defect_type: str
    target_invariant: str
    expected_recovery_action: str
    actual_recovery_action: str
    recovery_succeeded: bool
    non_defective_fields_preserved: bool
    latency_sec: float
    details: str


class DatasetE2EResult(BaseModel):
    dataset_id: str
    title: str
    modality: str
    style: str
    target_difficulty: str
    requested_q: int
    delivered_q: int
    fulfillment_rate_pct: float
    first_pass_valid_count: int
    final_valid_count: int
    grounding_pass_rate_pct: float
    multimodal_preservation_pct: Optional[float]
    mean_bloom_score: float
    unique_facets_count: int
    traceability_rate_pct: float
    cold_latency_sec: float
    warm_latency_sec: float
    cache_speedup_factor: float
    llm_calls_cold: int
    llm_calls_warm: int
    tokens_spent_est: int
    validation_status: str


class E2EValidationMasterReport(BaseModel):
    timestamp: str
    benchmark: str = "EXPERIMENT_11_END_TO_END_PRODUCTION_VALIDATION"
    datasets_evaluated_count: int
    fault_scenarios_count: int
    dataset_results: List[DatasetE2EResult]
    fault_results: List[FaultInjectionResult]
    acceptance_checklist: List[AcceptanceCriterion]
    all_mandatory_passed: bool
    overall_production_verdict: str
