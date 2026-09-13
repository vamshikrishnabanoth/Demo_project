"""
Unified WHAT + WHY Synthesizer.
Extracts both Summary and Blueprint and returns them for combined planning.
"""

from typing import Tuple, Dict, Any
from pipeline_experiment.generator.llm_engine import UnifiedLLMEngine
from pipeline_experiment.shared.schemas.canonical_models import CanonicalEducationalInput, PedagogicalSummary, PedagogicalBlueprint
from production_engine.extractors.summary_extractor import ProductionSummaryExtractor
from production_engine.extractors.blueprint_extractor import ProductionBlueprintExtractor


class ProductionUnifiedSynthesizer:
    @classmethod
    def extract_both(
        cls,
        canonical: CanonicalEducationalInput,
        llm: UnifiedLLMEngine
    ) -> Tuple[PedagogicalSummary, PedagogicalBlueprint]:
        summary = ProductionSummaryExtractor.extract(canonical, llm)
        blueprint = ProductionBlueprintExtractor.extract(canonical, llm)
        return summary, blueprint
