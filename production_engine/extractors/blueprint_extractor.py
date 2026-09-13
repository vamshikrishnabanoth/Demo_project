"""
Instructional Blueprint Extractor (WHY it was taught).
Extracts pedagogical acts, Bloom cognitive levels, dwell time, and teacher emphasis.
"""

from typing import Dict, Any
from pipeline_experiment.generator.llm_engine import UnifiedLLMEngine
from pipeline_experiment.shared.schemas.canonical_models import CanonicalEducationalInput, PedagogicalBlueprint
from pipeline_experiment.pipeline_b_blueprint.concept_mapper import DecoupledConceptMapper
from pipeline_experiment.pipeline_b_blueprint.salience_profiler import MultiSignalSalienceProfiler
from pipeline_experiment.pipeline_b_blueprint.pedagogical_interpreter import PedagogicalInterpreter
from pipeline_experiment.pipeline_b_blueprint.blueprint_builder import PedagogicalBlueprintBuilder


class ProductionBlueprintExtractor:
    @classmethod
    def extract(cls, canonical: CanonicalEducationalInput, llm: UnifiedLLMEngine) -> PedagogicalBlueprint:
        mapper = DecoupledConceptMapper(llm)
        topics = mapper.extract_concept_map(canonical)

        profiles = MultiSignalSalienceProfiler.compute_salience_profiles(canonical, topics)

        interpreter = PedagogicalInterpreter(llm)
        interpretations = interpreter.interpret_topics(canonical, profiles)

        blueprint = PedagogicalBlueprintBuilder.build_blueprint(canonical, profiles, interpretations)
        return blueprint
