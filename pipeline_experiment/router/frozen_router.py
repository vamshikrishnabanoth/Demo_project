"""
Frozen Feature-Based Pedagogical Router (Pipeline D).
Computes the Pedagogical Delivery Index (PDI) from 6 observable upfront features:
- has_audio
- has_ppt
- code_density
- text_length_words
- pedagogical_marker_density
- dialogue_interaction_density

FROZEN PROTOCOL: Calibrated on Development Set (15 Datasets) with threshold tau = 0.60.
NEVER modified on Unseen Validation Data.
"""

from typing import Dict, Any, Literal
from pydantic import BaseModel, Field

from pipeline_experiment.router.feature_extractor import UpfrontInputFeatures, UpfrontFeatureExtractor
from pipeline_experiment.shared.schemas.canonical_models import CanonicalEducationalInput


class RouterDecision(BaseModel):
    input_id: str
    selected_pipeline: Literal["PIPELINE_A_SUMMARY", "PIPELINE_B_BLUEPRINT"]
    pedagogical_delivery_index: float
    threshold: float = 0.60
    decision_rationale: str
    features: UpfrontInputFeatures


class FrozenPedagogicalRouter:
    """Deterministic frozen heuristic router for educational inputs."""

    FROZEN_THRESHOLD: float = 0.60

    @classmethod
    def route(cls, canonical: CanonicalEducationalInput) -> RouterDecision:
        feats = UpfrontFeatureExtractor.extract(canonical)
        return cls.route_from_features(feats)

    @classmethod
    def route_from_features(cls, feats: UpfrontInputFeatures) -> RouterDecision:
        # Normalized feature components
        audio_signal = 1.0 if feats.has_audio else 0.0
        ppt_signal = 1.0 if feats.has_ppt else 0.0
        dialogue_signal = min(1.0, feats.dialogue_interaction_density / 1.5)
        ped_marker_signal = min(1.0, feats.pedagogical_marker_density / 1.0)
        static_code_penalty = (feats.code_density * (1.0 - audio_signal))

        # Frozen PDI Formulation
        pdi = round(
            (0.50 * audio_signal) +
            (0.30 * ppt_signal) +
            (0.15 * dialogue_signal) +
            (0.05 * ped_marker_signal) -
            (0.30 * static_code_penalty),
            3
        )

        if pdi >= cls.FROZEN_THRESHOLD:
            choice = "PIPELINE_B_BLUEPRINT"
            rationale = f"PDI ({pdi:.3f}) >= {cls.FROZEN_THRESHOLD:.2f}: Strong pedagogical delivery signals (audio={feats.has_audio}, ppt={feats.has_ppt}, dialogue={feats.dialogue_interaction_density:.2f}/1k words). Routed to Instructional Blueprint."
        else:
            choice = "PIPELINE_A_SUMMARY"
            rationale = f"PDI ({pdi:.3f}) < {cls.FROZEN_THRESHOLD:.2f}: Material is predominantly static/technical with low interactive pedagogical signals (audio={feats.has_audio}, code_density={feats.code_density:.2f}). Routed to Technical Summary."

        return RouterDecision(
            input_id=feats.input_id,
            selected_pipeline=choice,
            pedagogical_delivery_index=pdi,
            threshold=cls.FROZEN_THRESHOLD,
            decision_rationale=rationale,
            features=feats
        )
