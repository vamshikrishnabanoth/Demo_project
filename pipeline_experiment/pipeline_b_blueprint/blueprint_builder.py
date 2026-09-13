"""
Pipeline B: Layer 2 Blueprint Builder.
Synthesizes topic salience and pedagogical interpretations into a structured PedagogicalBlueprint.
"""

from typing import List, Dict
from pipeline_experiment.shared.schemas.canonical_models import (
    CanonicalEducationalInput,
    PedagogicalBlueprint,
    PedagogicalBlueprintTopic
)
from pipeline_experiment.pipeline_b_blueprint.salience_profiler import TopicSalienceProfile
from pipeline_experiment.pipeline_b_blueprint.pedagogical_interpreter import InterpretationItem


class PedagogicalBlueprintBuilder:
    @staticmethod
    def build_blueprint(
        canonical_input: CanonicalEducationalInput,
        salience_profiles: List[TopicSalienceProfile],
        interpretations: List[InterpretationItem]
    ) -> PedagogicalBlueprint:
        """
        Combines salience scores and pedagogical interpretations into the canonical Blueprint.
        """
        interp_map = {i.topic_id: i for i in interpretations}
        blueprint_topics: List[PedagogicalBlueprintTopic] = []

        for s in salience_profiles:
            interp = interp_map.get(s.topic_id, interpretations[0] if interpretations else None)
            acts = interp.instructional_acts if interp else ["EXPLAIN"]
            mode = interp.dominant_mode if interp else "CONCEPTUAL_EXPLANATION"
            bloom = interp.target_bloom_level if interp else "UNDERSTAND"
            prereqs = interp.prerequisite_concepts if interp else []
            spec = interp.teacher_specificity if interp else "MEDIUM"

            blueprint_topics.append(PedagogicalBlueprintTopic(
                topic_id=s.topic_id,
                topic=s.topic_name,
                salience_score=s.salience_score,
                instructional_acts=acts,
                dominant_mode=mode,
                target_bloom_level=bloom,
                prerequisite_concepts=prereqs,
                evidence_refs=s.evidence_refs,
                teacher_specificity=spec if spec in ["LOW", "MEDIUM", "HIGH"] else "MEDIUM"
            ))

        return PedagogicalBlueprint(
            blueprint_id=f"BP_{canonical_input.input_id}",
            input_id=canonical_input.input_id,
            topics=blueprint_topics
        )
