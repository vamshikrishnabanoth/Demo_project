"""
Ground-Truth Instructional Intent Schema & Blueprint Alignment Evaluator.
Isolates Blueprint inference accuracy from downstream MCQ generation by benchmarking the
system's inferred Blueprint directly against human-annotated instructional evidence.
"""

from typing import List, Dict, Any, Set
from pydantic import BaseModel, Field
from pipeline_experiment.shared.schemas.canonical_models import PedagogicalBlueprint


class GroundTruthInstructionalIntent(BaseModel):
    topic: str
    teacher_emphasis: List[str] = Field(default_factory=list, description="Concepts with high dwell time or explicit verbal emphasis")
    worked_examples: List[str] = Field(default_factory=list, description="Explicit numerical or code calculations worked by instructor")
    student_questions: List[str] = Field(default_factory=list, description="Specific student questions or confusion points addressed")
    important_concepts: List[str] = Field(default_factory=list, description="Core high-priority concepts")
    observed_cognitive_activity: List[str] = Field(default_factory=list, description="explain, derive, apply, debug, etc.")


class GroundTruthBlueprintComparator:
    @classmethod
    def compare_blueprint_to_intent(
        cls,
        ground_truth: GroundTruthInstructionalIntent,
        inferred_blueprint: PedagogicalBlueprint
    ) -> Dict[str, Any]:
        """
        Calculates Blueprint Alignment F1 against human-annotated ground-truth intent.
        """
        blueprint_topics = [t.topic.lower() for t in inferred_blueprint.topics]
        bp_topic_words = set(" ".join(blueprint_topics).split())

        # 1. Concept / Topic Recall & Precision
        gt_concepts = [c.lower() for c in ground_truth.important_concepts + ground_truth.teacher_emphasis]
        matched_concepts = 0
        for c in gt_concepts:
            c_words = set(c.split())
            if c_words.intersection(bp_topic_words):
                matched_concepts += 1
        concept_recall = round(matched_concepts / max(1, len(gt_concepts)), 3) if gt_concepts else 1.0

        # 2. Cognitive Activity Alignment
        gt_acts = set([a.upper() for a in ground_truth.observed_cognitive_activity])
        inferred_acts = set()
        for t in inferred_blueprint.topics:
            inferred_acts.update([a.upper() for a in t.instructional_acts])
            inferred_acts.add(t.target_bloom_level.upper())

        act_overlap = gt_acts.intersection(inferred_acts)
        cognitive_alignment = round(len(act_overlap) / max(1, len(gt_acts)), 3) if gt_acts else 1.0

        # 3. Worked Example & Debugging Capture
        gt_examples = ground_truth.worked_examples
        inferred_modes = [t.dominant_mode for t in inferred_blueprint.topics]
        captured_examples = any("WORKED" in m.upper() or "DERIVATION" in m.upper() or "DEBUG" in m.upper() for m in inferred_modes)
        example_capture_score = 1.0 if (not gt_examples or captured_examples) else 0.5

        # 4. Composite Blueprint Fidelity Score (0.0 to 1.0)
        blueprint_fidelity = round(
            (0.40 * concept_recall)
            + (0.35 * cognitive_alignment)
            + (0.25 * example_capture_score),
            3
        )

        return {
            "concept_recall_percentage": round(concept_recall * 100, 1),
            "cognitive_alignment_percentage": round(cognitive_alignment * 100, 1),
            "worked_example_captured": captured_examples,
            "blueprint_fidelity_score": blueprint_fidelity
        }
