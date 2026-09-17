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
        if canonical_input.chunks:
            for c in canonical_input.chunks:
                chunk_excerpts.append(f"[{c.chunk_id}] {c.text[:250]}...")
        elif canonical_input.raw_content:
            words = canonical_input.raw_content.split()
            step = 250
            for i in range(0, min(len(words), 250 * 25), step):
                chunk_text = " ".join(words[i:i+step])
                chunk_excerpts.append(f"[C_{i//step+1:02d}] {chunk_text[:250]}...")
        chunk_text_joined = "\n".join(chunk_excerpts[:25])

        topic_target = "6 to 10"

        prompt = (
            f"Title: {canonical_input.title}\n"
            f"Type: {canonical_input.input_type} | Style: {canonical_input.content_style}\n\n"
            f"--- [CONTENT CHUNKS] ---\n"
            + chunk_text_joined
            + "\n\n"
            f"Task: Extract {topic_target} distinct technical curricular topics and sub-facets taught in this material.\n"
            "CRITICAL REQUIREMENT: Focus ONLY on technical concepts, algorithms, tools, commands, mechanisms, and formulas.\n"
            "DO NOT include generic meta-topics such as 'Overview', 'Introduction', 'Course Logistics', 'Agenda', or 'Summary'.\n"
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

        META_STOPLIST = {"overview", "introduction", "intro", "agenda", "summary", "lecture plan", "study plan", "study tips", "course logistics", "wrap up", "conclusion"}
        filtered_topics = [
            t for t in result.topics
            if t.topic_name.strip().lower() not in META_STOPLIST and not any(t.topic_name.strip().lower().startswith(m) for m in ["overview", "intro"])
        ]
        return filtered_topics if filtered_topics else result.topics
