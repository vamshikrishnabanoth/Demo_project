"""
Schemas for Experiment 5: Dynamic Evidence Representation Selection Ablation.
"""

from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field
from production_engine.schemas import ProductionMCQ, InputFeatures, RepresentationType


class RepresentationAblationMetrics(BaseModel):
    representation_type: RepresentationType
    router_selected: bool
    generated_question_count: int
    requested_question_count: int
    fulfillment_percentage: float
    mean_bloom_score: float
    traceability_percentage: float
    cross_modal_coverage_percentage: float
    redundancy_percentage: float
    validator_pass_rate_percentage: float
    repairs_performed_count: int
    total_tokens_consumed: int
    latency_seconds: float
    sample_question: Optional[ProductionMCQ] = None


class DatasetAblationResult(BaseModel):
    dataset_id: str
    title: str
    modality: str
    input_features: InputFeatures
    pedagogical_delivery_index: float
    automated_router_choice: RepresentationType
    router_decision_rationale: str
    why_representation_fits_content: str
    is_counterexample: bool = False
    counterexample_note: Optional[str] = None
    summary_metrics: RepresentationAblationMetrics
    blueprint_metrics: RepresentationAblationMetrics
    unified_metrics: RepresentationAblationMetrics
    winning_representation: RepresentationType
    unified_material_advantage_analysis: Optional[str] = None
