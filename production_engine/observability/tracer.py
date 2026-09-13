"""
Observability and Structured Request Tracing for Architecture E v2.0.
Emits comprehensive, inspectable JSON execution telemetry per generation request.
"""

import time
import json
import os
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class RequestTrace(BaseModel):
    request_id: str
    timestamp: str
    input_id: str
    selected_representation: str
    pedagogical_delivery_index: float
    cache_telemetry: Dict[str, str] = Field(default_factory=dict)
    selected_facets: List[str] = Field(default_factory=list)
    initial_generated_count: int = 0
    first_pass_validated_count: int = 0
    critic_repairs_count: int = 0
    final_delivered_count: int = 0
    total_latency_ms: float = 0.0
    status: str = "COMPLETED"
    repair_actions: List[Dict[str, Any]] = Field(default_factory=list)
    planning_notes: str = ""


class PipelineTracer:
    """Thread-local / instance telemetry recorder."""

    TRACE_LOG_DIR = "production_engine/observability/traces"

    def __init__(self, request_id: str, input_id: str):
        self.request_id = request_id
        self.input_id = input_id
        self.start_time = time.time()
        self.selected_representation = "UNKNOWN"
        self.pdi = 0.0
        self.cache_telemetry: Dict[str, str] = {}
        self.selected_facets: List[str] = []
        self.initial_generated_count = 0
        self.first_pass_validated_count = 0
        self.critic_repairs_count = 0
        self.final_delivered_count = 0
        self.repair_actions: List[Dict[str, Any]] = []
        self.planning_notes = ""
        self.status = "IN_PROGRESS"

    def record_routing(self, rep_type: str, pdi: float):
        self.selected_representation = rep_type
        self.pdi = round(pdi, 3)

    def record_cache_hit(self, tier: str):
        self.cache_telemetry[tier] = "HIT"

    def record_cache_miss(self, tier: str):
        self.cache_telemetry[tier] = "MISS"

    def record_planning(self, facets: List[str], notes: str = ""):
        self.selected_facets = facets
        self.planning_notes = notes

    def record_generation(self, generated_count: int):
        self.initial_generated_count = generated_count

    def record_validation(self, passed_count: int):
        self.first_pass_validated_count = passed_count

    def record_repair(self, target_id: str, defect_field: Optional[str], action: str, success: bool):
        self.critic_repairs_count += 1
        self.repair_actions.append({
            "target_id": target_id,
            "defect_field": defect_field,
            "action": action,
            "success": success
        })

    def finalize(self, delivered_count: int, status: str = "COMPLETED") -> RequestTrace:
        total_lat = round((time.time() - self.start_time) * 1000, 2)
        self.final_delivered_count = delivered_count
        self.status = status

        trace = RequestTrace(
            request_id=self.request_id,
            timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            input_id=self.input_id,
            selected_representation=self.selected_representation,
            pedagogical_delivery_index=self.pdi,
            cache_telemetry=self.cache_telemetry,
            selected_facets=self.selected_facets,
            initial_generated_count=self.initial_generated_count,
            first_pass_validated_count=self.first_pass_validated_count,
            critic_repairs_count=self.critic_repairs_count,
            final_delivered_count=self.final_delivered_count,
            total_latency_ms=total_lat,
            status=self.status,
            repair_actions=self.repair_actions,
            planning_notes=self.planning_notes
        )

        os.makedirs(self.TRACE_LOG_DIR, exist_ok=True)
        trace_path = os.path.join(self.TRACE_LOG_DIR, f"{self.request_id}.json")
        with open(trace_path, "w", encoding="utf-8") as f:
            f.write(trace.model_dump_json(indent=2))

        return trace
