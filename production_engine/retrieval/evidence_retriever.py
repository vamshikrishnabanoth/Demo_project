"""
Evidence Retrieval Layer (RAG): Indexes canonical chunks and retrieves relevant evidence
for targeted assessment generation.
"""

import math
import re
from typing import List, Dict, Any, Tuple
from pydantic import BaseModel, Field

from pipeline_experiment.shared.schemas.canonical_models import CanonicalEducationalInput, SemanticChunk
from production_engine.schemas import AssessmentTarget


class RetrievedEvidence(BaseModel):
    target_id: str
    concept_name: str
    primary_chunk_id: str
    evidence_ids: List[str]
    time_spans_text: str
    retrieved_content: str
    relevance_score: float


class ProductionEvidenceRetriever:
    """Retrieves target-specific evidence chunks using keyword salience and semantic overlap."""

    @classmethod
    def tokenize(cls, text: str) -> List[str]:
        return [w.lower() for w in re.findall(r"\b\w{3,}\b", text)]

    @classmethod
    def retrieve_for_target(
        cls,
        canonical: CanonicalEducationalInput,
        target: AssessmentTarget,
        top_k: int = 3
    ) -> RetrievedEvidence:
        query_text = f"{target.concept_name} {target.what_taught} {' '.join(target.plausible_misconceptions)}"
        q_tokens = cls.tokenize(query_text)
        q_set = set(q_tokens)

        scored_chunks: List[Tuple[float, SemanticChunk]] = []

        for chunk in canonical.chunks:
            c_tokens = cls.tokenize(chunk.text)
            if not c_tokens:
                continue

            # Token overlap & density
            overlap = sum(1 for t in c_tokens if t in q_set)
            jaccard = overlap / max(1, len(set(c_tokens).union(q_set)))
            
            # Boost if exact concept name appears
            boost = 1.5 if target.concept_name.lower() in chunk.text.lower() else 1.0
            score = round(jaccard * boost, 4)

            scored_chunks.append((score, chunk))

        # Sort by relevance score descending
        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        top_chunks = [c for _, c in scored_chunks[:top_k]]

        if not top_chunks and canonical.chunks:
            top_chunks = canonical.chunks[:1]

        evidence_ids = [c.evidence.evidence_id for c in top_chunks if c.evidence]
        
        # Build timestamp / location string
        time_locs = []
        for c in top_chunks:
            if c.time_spans:
                s, e = c.time_spans[0].start, c.time_spans[0].end
                time_locs.append(f"[{c.chunk_id}: {int(s//60)}m{int(s%60):02d}s - {int(e//60)}m{int(e%60):02d}s]")
            elif c.material_refs:
                time_locs.append(f"[{c.chunk_id}: {', '.join(c.material_refs)}]")
            else:
                time_locs.append(f"[{c.chunk_id}]")

        retrieved_text = "\n\n".join([f"--- [EVIDENCE {c.chunk_id}] ---\n{c.text[:500]}" for c in top_chunks])

        return RetrievedEvidence(
            target_id=target.target_id,
            concept_name=target.concept_name,
            primary_chunk_id=top_chunks[0].chunk_id if top_chunks else "C01",
            evidence_ids=evidence_ids or ["E_C01"],
            time_spans_text=", ".join(time_locs),
            retrieved_content=retrieved_text,
            relevance_score=scored_chunks[0][0] if scored_chunks else 0.5
        )

    @classmethod
    def retrieve_for_plan(
        cls,
        canonical: CanonicalEducationalInput,
        targets: Any
    ) -> Dict[str, RetrievedEvidence]:
        if hasattr(targets, "targets"):
            target_list = targets.targets
        elif isinstance(targets, list):
            target_list = targets
        else:
            target_list = []
        return {t.target_id: cls.retrieve_for_target(canonical, t) for t in target_list}
