"""
Pipeline B: Layer 2 Multi-Signal Topic Salience Profiler.
Implements the frozen normalized multi-signal salience formula with fixed pre-defined weights:
S(topic) = w1*dwell_norm + w2*repetition_norm + w3*emphasis_norm + w4*worked_ex + w5*demo + w6*debug + w7*qna
"""

from typing import List, Dict, Any
from pipeline_experiment.shared.schemas.canonical_models import CanonicalEducationalInput
from pipeline_experiment.pipeline_b_blueprint.concept_mapper import TopicNode


class TopicSalienceProfile:
    def __init__(
        self,
        topic_id: str,
        topic_name: str,
        salience_score: float,
        dwell_time: float,
        repetition_count: int,
        emphasis_markers_count: int,
        has_worked_example: bool,
        has_demonstration: bool,
        has_debugging: bool,
        has_student_qna: bool,
        evidence_refs: List[str]
    ):
        self.topic_id = topic_id
        self.topic_name = topic_name
        self.salience_score = salience_score
        self.dwell_time = dwell_time
        self.repetition_count = repetition_count
        self.emphasis_markers_count = emphasis_markers_count
        self.has_worked_example = has_worked_example
        self.has_demonstration = has_demonstration
        self.has_debugging = has_debugging
        self.has_student_qna = has_student_qna
        self.evidence_refs = evidence_refs


class MultiSignalSalienceProfiler:
    # Frozen Predefined Weights (Sum = 1.00)
    W_DWELL = 0.30
    W_REPETITION = 0.15
    W_EMPHASIS = 0.15
    W_WORKED_EX = 0.10
    W_DEMO = 0.10
    W_DEBUG = 0.10
    W_QNA = 0.10

    @classmethod
    def compute_salience_profiles(
        cls,
        canonical_input: CanonicalEducationalInput,
        topics: List[TopicNode]
    ) -> List[TopicSalienceProfile]:
        """
        Computes normalized composite salience scores for all topics.
        """
        chunk_map = {c.chunk_id: c for c in canonical_input.chunks}
        total_duration = max(1.0, sum(c.evidence.dwell_time for c in canonical_input.chunks))

        # First pass: collect raw values
        raw_stats = []
        for t in topics:
            associated = [chunk_map[cid] for cid in t.associated_chunk_ids if cid in chunk_map]
            if not associated and canonical_input.chunks:
                associated = canonical_input.chunks[:1]

            t_dwell = sum(c.evidence.dwell_time for c in associated)
            t_rep = sum(c.evidence.repetition_count for c in associated)
            t_emp = sum(len(c.evidence.emphasis_markers) for c in associated)
            t_ex = any(c.evidence.worked_example for c in associated)
            t_demo = any(c.evidence.demonstration for c in associated)
            t_debug = any(c.evidence.debugging_event or c.evidence.teacher_correction for c in associated)
            t_qna = any(c.evidence.student_question for c in associated)
            ev_refs = [c.evidence.evidence_id for c in associated]

            raw_stats.append({
                "topic": t,
                "dwell": t_dwell,
                "rep": t_rep,
                "emp": t_emp,
                "ex": 1.0 if t_ex else 0.0,
                "demo": 1.0 if t_demo else 0.0,
                "debug": 1.0 if t_debug else 0.0,
                "qna": 1.0 if t_qna else 0.0,
                "refs": ev_refs
            })

        if not raw_stats:
            # Fallback if no topics found
            return [
                TopicSalienceProfile(
                    topic_id="T01",
                    topic_name="Overview",
                    salience_score=0.5,
                    dwell_time=60.0,
                    repetition_count=1,
                    emphasis_markers_count=1,
                    has_worked_example=False,
                    has_demonstration=False,
                    has_debugging=False,
                    has_student_qna=False,
                    evidence_refs=["E_C01"]
                )
            ]

        max_dwell = max([r["dwell"] for r in raw_stats], default=1.0) or 1.0
        max_rep = max([r["rep"] for r in raw_stats], default=1.0) or 1.0
        max_emp = max([r["emp"] for r in raw_stats], default=1.0) or 1.0

        profiles: List[TopicSalienceProfile] = []
        for r in raw_stats:
            dwell_norm = r["dwell"] / max_dwell
            rep_norm = r["rep"] / max_rep
            emp_norm = r["emp"] / max_emp

            score = (
                cls.W_DWELL * dwell_norm
                + cls.W_REPETITION * rep_norm
                + cls.W_EMPHASIS * emp_norm
                + cls.W_WORKED_EX * r["ex"]
                + cls.W_DEMO * r["demo"]
                + cls.W_DEBUG * r["debug"]
                + cls.W_QNA * r["qna"]
            )

            norm_score = round(min(1.0, max(0.05, score)), 3)

            profiles.append(TopicSalienceProfile(
                topic_id=r["topic"].topic_id,
                topic_name=r["topic"].topic_name,
                salience_score=norm_score,
                dwell_time=round(r["dwell"], 1),
                repetition_count=r["rep"],
                emphasis_markers_count=r["emp"],
                has_worked_example=bool(r["ex"]),
                has_demonstration=bool(r["demo"]),
                has_debugging=bool(r["debug"]),
                has_student_qna=bool(r["qna"]),
                evidence_refs=r["refs"]
            ))

        return profiles
