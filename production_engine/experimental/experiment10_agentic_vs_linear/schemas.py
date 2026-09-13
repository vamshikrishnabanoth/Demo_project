"""
Schemas for Experiment 10: Agentic vs. Fixed Linear LLM Pipeline Benchmark.
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class TrialExecutionResult(BaseModel):
    trial_id: int
    pipeline_type: str  # "FIXED_LINEAR" or "AGENTIC_V2"
    dataset_id: str
    requested_count: int
    delivered_count: int
    fulfillment_rate_pct: float
    first_pass_valid_count: int
    first_pass_valid_pct: float
    final_valid_count: int
    final_valid_pct: float
    grounding_violation_rate_pct: float
    unique_facets_used: int
    concept_collision_rate_pct: float
    mean_bloom_score: float
    cross_modal_preservation_pct: Optional[float] = None
    repairs_attempted: int
    repairs_succeeded: int
    defect_recovery_rate_pct: float
    non_defective_field_preservation_pct: float
    latency_sec: float
    llm_calls_count: int
    tokens_spent_est: int
    routing_choice: Optional[str] = None


class AggregatedPipelineMetrics(BaseModel):
    pipeline_type: str
    dataset_id: str
    trials_count: int
    mean_fulfillment_rate_pct: float
    std_fulfillment_rate_pct: float
    mean_first_pass_valid_pct: float
    std_first_pass_valid_pct: float
    mean_final_valid_pct: float
    std_final_valid_pct: float
    mean_grounding_violation_rate_pct: float
    mean_unique_facets: float
    mean_concept_collision_pct: float
    mean_bloom_score: float
    std_bloom_score: float
    mean_cross_modal_preservation_pct: Optional[float] = None
    mean_defect_recovery_rate_pct: float
    mean_non_defective_field_preservation_pct: float
    mean_latency_sec: float
    std_latency_sec: float
    mean_llm_calls: float
    mean_tokens_spent: float


class DatasetComparisonResult(BaseModel):
    dataset_id: str
    title: str
    modality: str
    style: str
    fixed_linear_metrics: AggregatedPipelineMetrics
    agentic_metrics: AggregatedPipelineMetrics
    fulfillment_delta_pct: float
    bloom_score_delta: float
    collision_reduction_pct: float
    recovery_delta_pct: float
    latency_overhead_sec: float
    token_overhead_pct: float
    qualitative_summary: str
