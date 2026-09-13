"""
Pipeline B: Layer 1 Evidence Aggregator & Decoupled Concept Mapper.
Extracts the topic hierarchy independently and aggregates observable classroom evidence records.
"""

from typing import List, Dict, Any
from pydantic import BaseModel, Field
from pipeline_experiment.shared.schemas.canonical_models import (
    CanonicalEducationalInput,
    InstructionalEvidenceRecord
)


class TopicNode(BaseModel):
    topic_id: str
    topic_name: str
    subtopics: List[str] = Field(default_factory=list)
    associated_chunk_ids: List[str] = Field(default_factory=list)


class TopicExtractionBatch(BaseModel):
    topics: List[TopicNode] = Field(description="Distinct topics extracted independently of importance")


class DecoupledConceptMapper:
    def __init__(self, llm_engine):
        self.llm = llm_engine

    def extract_concept_map(self, canonical_input: CanonicalEducationalInput) -> List[TopicNode]:
        """
        Extracts the topic hierarchy from the chunks without scoring salience.
        """
        system_prompt = (
            "You are an expert curriculum structure analyst.\n"
            "Your task is to identify the distinct technical topics and subtopics present in the material.\n"
            "Do NOT rank or judge their importance yet; simply extract the clear conceptual taxonomy."
        )

        chunk_excerpts = []
        for c in canonical_input.chunks:
            chunk_excerpts.append(f"[{c.chunk_id}] {c.text[:250]}...")
        chunk_text_joined = "\n".join(chunk_excerpts[:25])

        topic_target = "8 to 15" if len(canonical_input.chunks) > 15 else "4 to 8"

        prompt = (
            f"Title: {canonical_input.title}\n"
            f"Type: {canonical_input.input_type} | Style: {canonical_input.content_style}\n\n"
            f"--- [CONTENT CHUNKS] ---\n"
            + chunk_text_joined
            + "\n\n"
            f"Task: Extract {topic_target} distinct technical topics and sub-facets (including algorithmic steps, edge cases, formulas, pointer logic, and worked examples).\n"
            "Provide for each topic:\n"
            "- topic_id (e.g. 'TOP_01')\n"
            "- topic_name\n"
            "- subtopics (List of sub-concepts)\n"
            "- associated_chunk_ids (List of chunk IDs covering this topic)"
        )

        result = self.llm.generate_pydantic(
            prompt=prompt,
            pydantic_class=TopicExtractionBatch,
            system_prompt=system_prompt,
            temperature=0.2
        )
        return result.topics
