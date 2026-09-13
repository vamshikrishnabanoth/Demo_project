"""
Pipeline B: Layer 2 Pedagogical Interpreter.
Infers pedagogical instructional acts, Bloom's cognitive levels, and prerequisite concepts from observable evidence.
"""

from typing import List, Dict
from pydantic import BaseModel, Field
from pipeline_experiment.shared.schemas.canonical_models import (
    CanonicalEducationalInput,
    PedagogicalBlueprintTopic,
    InstructionalAct,
    BloomsLevel
)
from pipeline_experiment.pipeline_b_blueprint.salience_profiler import TopicSalienceProfile


class InterpretationItem(BaseModel):
    topic_id: str
    instructional_acts: List[InstructionalAct] = Field(description="Inferred instructional acts (e.g. EXPLAIN, PRACTICE, DEBUG)")
    dominant_mode: str = Field(description="Dominant mode, e.g. WORKED_EXAMPLE, CODE_DEBUGGING, CONCEPTUAL_COMPARISON")
    target_bloom_level: BloomsLevel = Field(description="Grounded cognitive demand: REMEMBER, UNDERSTAND, APPLY, ANALYZE")
    prerequisite_concepts: List[str] = Field(default_factory=list, description="Foundational concepts taught earlier needed for this topic")
    teacher_specificity: str = Field(default="MEDIUM", description="LOW, MEDIUM, or HIGH")


class InterpretationBatch(BaseModel):
    interpretations: List[InterpretationItem] = Field(description="Pedagogical interpretations per topic")


class PedagogicalInterpreter:
    def __init__(self, llm_engine):
        self.llm = llm_engine

    def interpret_topics(
        self,
        canonical_input: CanonicalEducationalInput,
        salience_profiles: List[TopicSalienceProfile]
    ) -> List[InterpretationItem]:
        """
        Infers instructional acts and Bloom levels conditioned on observable evidence.
        """
        system_prompt = (
            "You are an educational assessment expert and psychometrician.\n"
            "Your task is to infer the pedagogical instructional acts, target Bloom's level, and prerequisite concepts for each topic\n"
            "based strictly on the observable evidence provided (dwell time, demonstrations, worked examples, debugging events, verbal cues).\n\n"
            "Allowed Instructional Acts: INTRODUCE, EXPLAIN, DEMONSTRATE, REINFORCE, PRACTICE, COMPARE, DEBUG, APPLY\n"
            "Allowed Bloom Levels: REMEMBER, UNDERSTAND, APPLY, ANALYZE, EVALUATE, CREATE"
        )

        salience_summaries = []
        for s in salience_profiles:
            salience_summaries.append(
                f"Topic: [{s.topic_id}] {s.topic_name}\n"
                f"- Salience Score: {s.salience_score:.2f} (Dwell: {s.dwell_time}s, Repetition: {s.repetition_count}, Emphasis Markers: {s.emphasis_markers_count})\n"
                f"- Evidence Flags: WorkedExample={s.has_worked_example}, Demo={s.has_demonstration}, Debug={s.has_debugging}, QnA={s.has_student_qna}"
            )

        prompt = (
            f"Title: {canonical_input.title}\n"
            f"Input Type: {canonical_input.input_type} | Content Style: {canonical_input.content_style}\n\n"
            f"--- [TOPIC SALIENCE & OBSERVABLE EVIDENCE] ---\n"
            + "\n\n".join(salience_summaries)
            + "\n\n"
            "Task: For each topic, provide the InterpretationItem:\n"
            "- instructional_acts\n"
            "- dominant_mode\n"
            "- target_bloom_level\n"
            "- prerequisite_concepts (List of foundational terms needed)\n"
            "- teacher_specificity (LOW, MEDIUM, HIGH)"
        )

        result = self.llm.generate_pydantic(
            prompt=prompt,
            pydantic_class=InterpretationBatch,
            system_prompt=system_prompt,
            temperature=0.2
        )
        return result.interpretations
