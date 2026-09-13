"""
Canonical Shared Pydantic Schemas for Pipeline Experiment.
Defines canonical input representations, observable evidence records, 4-layer blueprints, assessment slots, MCQs, and validation metrics.
"""

from typing import List, Dict, Optional, Literal, Any
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# 1. Canonical Shared Input & Evidence Record
# ---------------------------------------------------------------------------

class TimeSpan(BaseModel):
    start: float = Field(description="Start time in seconds")
    end: float = Field(description="End time in seconds")


class InstructionalEvidenceRecord(BaseModel):
    evidence_id: str = Field(description="Unique evidence identifier, e.g. E01")
    topic_id: Optional[str] = Field(default=None, description="Associated topic identifier")
    time_spans: List[TimeSpan] = Field(default_factory=list, description="One or more timestamps where concept appeared")
    dwell_time: float = Field(default=0.0, description="Total seconds spent on this concept across all time spans")
    repetition_count: int = Field(default=0, description="Frequency of recurring key terms or concept statements")
    emphasis_markers: List[str] = Field(default_factory=list, description="Explicit verbal cues (e.g. 'Exam alert', 'Crucial')")
    worked_example: bool = Field(default=False, description="Whether a concrete worked example was walked through")
    demonstration: bool = Field(default=False, description="Whether live typing, execution, or demonstration occurred")
    student_question: bool = Field(default=False, description="Whether student interaction or question was addressed")
    teacher_correction: bool = Field(default=False, description="Whether teacher corrected a mistake or bug")
    debugging_event: bool = Field(default=False, description="Whether live debugging or error diagnosis occurred")
    code_interaction: bool = Field(default=False, description="Whether code syntax, APIs, or tensors were manipulated")
    negative_instruction: bool = Field(default=False, description="Explicit 'don't do X' warning or anti-pattern note")
    source_refs: List[str] = Field(default_factory=list, description="Slide page numbers, cell IDs, or section anchors")


class SemanticChunk(BaseModel):
    chunk_id: str = Field(description="Chunk ID, e.g. C01, C02")
    source_type: str = Field(description="Input modality type (e.g. VOICE_PLUS_PPT, CODE, NOTES)")
    time_spans: List[TimeSpan] = Field(default_factory=list)
    text: str = Field(description="Full text of the instructional chunk")
    material_refs: List[str] = Field(default_factory=list, description="Associated slide or code cell references")
    topic_candidates: List[str] = Field(default_factory=list, description="Preliminary topic keywords identified")
    evidence: InstructionalEvidenceRecord = Field(default_factory=lambda: InstructionalEvidenceRecord(evidence_id="E_TEMP"))


class CanonicalEducationalInput(BaseModel):
    input_id: str
    title: str
    input_type: Literal[
        "VOICE_ONLY", "VOICE_PLUS_PPT", "PDF", "NOTES",
        "CODE", "COLAB", "ASSIGNMENT", "PROBLEM_SOLVING"
    ]
    content_style: Literal[
        "THEORY", "CODE", "CONCEPTUAL", "PROCEDURAL",
        "DEBUGGING", "MATHEMATICAL", "PROBLEM_SOLVING"
    ]
    duration_seconds: float = Field(default=0.0)
    raw_content: str
    chunks: List[SemanticChunk] = Field(default_factory=list)
    supporting_materials_text: Optional[str] = None


# ---------------------------------------------------------------------------
# 2. Pipeline A Representation: Conventional Summary
# ---------------------------------------------------------------------------

class PedagogicalSummary(BaseModel):
    input_id: str
    title: str
    concepts_and_definitions: List[str] = Field(description="Core concepts and terms taught")
    mechanisms_and_formulas: List[str] = Field(default_factory=list, description="Mechanisms, algorithms, and formulas")
    examples_and_code_patterns: List[str] = Field(default_factory=list, description="Summary of examples or code patterns")
    factual_summary_text: str = Field(description="Synthesized conventional summary ('WHAT was presented')")


# ---------------------------------------------------------------------------
# 3. Pipeline B Representation: 4-Layer Pedagogical Blueprint
# ---------------------------------------------------------------------------

InstructionalAct = Literal[
    "INTRODUCE", "EXPLAIN", "DEMONSTRATE", "REINFORCE",
    "PRACTICE", "COMPARE", "DEBUG", "APPLY", "ANALYZE", "EVALUATE"
]

BloomsLevel = Literal[
    "REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"
]


class PedagogicalBlueprintTopic(BaseModel):
    topic_id: str
    topic: str = Field(description="Topic title")
    salience_score: float = Field(ge=0.0, le=1.0, description="Normalized multi-signal salience score")
    instructional_acts: List[InstructionalAct] = Field(default_factory=list)
    dominant_mode: str = Field(description="Dominant mode, e.g. WORKED_EXAMPLE, CODE_DEBUGGING, CONCEPTUAL_COMPARISON")
    target_bloom_level: BloomsLevel = Field(description="Target cognitive depth")
    prerequisite_concepts: List[str] = Field(default_factory=list, description="Required prerequisite concepts taught prior")
    evidence_refs: List[str] = Field(default_factory=list, description="Referenced evidence IDs supporting this topic")
    teacher_specificity: Literal["LOW", "MEDIUM", "HIGH"] = "MEDIUM"


class PedagogicalBlueprint(BaseModel):
    blueprint_id: str
    input_id: str
    topics: List[PedagogicalBlueprintTopic]


class AssessmentPlanAllocation(BaseModel):
    topic_id: str
    topic_name: str
    question_count: int = Field(ge=0)
    target_bloom: List[BloomsLevel] = Field(default_factory=list)


class AssessmentPlan(BaseModel):
    plan_id: str
    input_id: str
    total_questions: int
    allocations: List[AssessmentPlanAllocation]


class AssessmentSlot(BaseModel):
    slot_id: str = Field(description="Unique slot identifier, e.g. S01")
    topic_id: str
    topic_name: str
    cognitive_level: BloomsLevel
    instructional_mode: str
    assessment_goal: str = Field(description="Explicit learning target to assess")
    misconception_target: Optional[str] = Field(default=None, description="Target student misunderstanding to embed in distractors")
    evidence_refs: List[str] = Field(default_factory=list)
    question_type: str = Field(default="CONCEPTUAL_SCENARIO", description="e.g. NUMERICAL_SCENARIO, CODE_DEBUG_SCENARIO")
    target_options_count: int = 4


# ---------------------------------------------------------------------------
# 3b. Unified Assessment Target & Plan Models (Pipeline C: WHAT + WHY)
# ---------------------------------------------------------------------------

class UnifiedAssessmentTarget(BaseModel):
    target_id: str = Field(description="Unique assessment target identifier, e.g. TGT_01")
    topic_name: str = Field(description="Specific technical topic")
    what_taught_summary: str = Field(description="WHAT was taught: exact technical definitions, formulas, API syntax, or code patterns")
    why_assessed_pedagogy: str = Field(description="WHY it is worth assessing: teacher dwell time, spoken emphasis, worked example, or student bottleneck")
    target_bloom_level: BloomsLevel = Field(default="UNDERSTAND", description="Target cognitive depth inferred from pedagogical evidence")
    misconception_distractor_hints: List[str] = Field(default_factory=list, description="Common misunderstandings or false assumptions for distractors")
    allocated_question_count: int = Field(default=1, description="Number of questions allocated to this target")
    evidence_chunk_refs: List[str] = Field(default_factory=list, description="Associated canonical chunk IDs")
    source_timestamps_or_slides: List[str] = Field(default_factory=list, description="Timestamps, slide numbers, or code line references")


class UnifiedAssessmentPlan(BaseModel):
    input_id: str
    title: str
    total_requested_questions: int
    total_available_targets: int
    assessment_targets: List[UnifiedAssessmentTarget] = Field(
        description="Dynamic list of content-driven assessment targets (not fixed to 5)"
    )


# ---------------------------------------------------------------------------
# 4. MCQ Output & Evaluation Models
# ---------------------------------------------------------------------------

class MCQItem(BaseModel):
    question_id: str
    question_text: str = Field(description="Clear, unambiguous question stem")
    option_a: str = Field(description="Option A")
    option_b: str = Field(description="Option B")
    option_c: str = Field(description="Option C")
    option_d: str = Field(description="Option D")
    correct_option: Literal["A", "B", "C", "D"] = Field(description="The single correct answer key")
    explanation: str = Field(description="Detailed pedagogical justification for correct option and distractor refutations")
    target_concept: str
    cognitive_level: BloomsLevel = "UNDERSTAND"
    source_slot_or_topic: Optional[str] = None
    # End-to-end Teacher Traceability
    what_taught: Optional[str] = Field(default=None, description="Summary technical concept/formula/code assessed")
    why_assessed: Optional[str] = Field(default=None, description="Pedagogical rationale / teacher emphasis")
    evidence_refs: List[str] = Field(default_factory=list, description="Associated chunk IDs, timestamps, or slide numbers")
    misconception_rationale: Optional[str] = Field(default=None, description="Pedagogical reason for distractor choices")


class MCQSuite(BaseModel):
    pipeline_type: Literal["PIPELINE_A_SUMMARY", "PIPELINE_B_BLUEPRINT", "PIPELINE_C_COMBINED"]
    input_id: str
    input_type: str
    content_style: str
    total_questions: int
    questions: List[MCQItem]


# ---------------------------------------------------------------------------
# 5. Validation Models (Experiment B1 & B2)
# ---------------------------------------------------------------------------

class BlueprintValidityReport(BaseModel):
    input_id: str
    topics_grounded_percentage: float = Field(description="% of topics actually taught in source")
    salience_alignment_score: float = Field(description="Agreement on topic emphasis ranking (1-5)")
    instructional_act_accuracy: float = Field(description="% of acts accurately matching observable behavior")
    blooms_justification_score: float = Field(description="Score on whether Bloom level is justified by source (1-5)")
    prerequisites_grounded_percentage: float = Field(description="% of prerequisite concepts actually taught")
    overall_validity_percentage: float = Field(description="Overall SME Blueprint validity score")


class SMEMCQEvaluationRecord(BaseModel):
    evaluator_id: str
    blind_question_id: str
    lecture_relevance: int = Field(ge=1, le=5)
    technical_correctness: int = Field(ge=1, le=5)
    source_answerability: int = Field(ge=1, le=5, description="Can student answer using ONLY this material?")
    teacher_input_specificity: int = Field(ge=1, le=5)
    cognitive_alignment: int = Field(ge=1, le=5)
    assessment_usefulness: int = Field(ge=1, le=5)
    naturalness_and_clarity: int = Field(ge=1, le=5)
    difficulty_calibration: int = Field(ge=1, le=5)
    genericness_score: int = Field(ge=1, le=5, description="1=Highly Unique to this lecture, 5=Generic textbook/LLM")
    comments: Optional[str] = None
