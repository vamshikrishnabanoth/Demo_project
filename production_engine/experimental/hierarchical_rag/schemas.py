"""
Hierarchical RAG Schemas: Dual-Level Parent-Child Evidence Representations.
"""

from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field
from pipeline_experiment.shared.schemas.canonical_models import TimeSpan, InstructionalEvidenceRecord


class ChildChunk(BaseModel):
    child_id: str                      # e.g. "C_01_01"
    evidence_id: str                   # e.g. "E_CHILD_01"
    parent_id: str                     # e.g. "P_01"
    source_type: Literal["TRANSCRIPT", "SLIDE", "CODE", "NOTES"]
    time_span: Optional[TimeSpan] = None
    text: str                          # 60-90 words micro-chunk
    word_count: int
    keywords: List[str] = Field(default_factory=list)


class ParentChunk(BaseModel):
    parent_id: str                     # e.g. "P_01"
    evidence_id: str                   # e.g. "E_PARENT_01"
    title: str                         # Section / topic heading
    source_type: Literal["TRANSCRIPT", "SLIDE", "CODE", "NOTES"]
    time_span: Optional[TimeSpan] = None
    full_text: str                     # 400-600 words macro-chunk
    word_count: int
    child_ids: List[str] = Field(default_factory=list)


class HierarchicalEvidenceStore(BaseModel):
    input_id: str
    title: str
    parents: List[ParentChunk] = Field(default_factory=list)
    children: List[ChildChunk] = Field(default_factory=list)
    parent_map: Dict[str, ParentChunk] = Field(default_factory=dict)
    child_map: Dict[str, ChildChunk] = Field(default_factory=dict)


class HierarchicalRetrievedEvidence(BaseModel):
    target_id: str
    concept_name: str
    matched_child_ids: List[str]
    parent_context_ids: List[str]
    citation_spans_text: str
    retrieved_content: str
    relevance_score: float
    parent_context_length_words: int
    child_evidence_length_words: int
