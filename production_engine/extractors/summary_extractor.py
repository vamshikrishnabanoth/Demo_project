"""
Technical Summary Extractor (WHAT was taught).
Extracts factual definitions, mechanisms, algorithms, and code patterns.
"""

from typing import Dict, Any
from pipeline_experiment.generator.llm_engine import UnifiedLLMEngine
from pipeline_experiment.shared.schemas.canonical_models import CanonicalEducationalInput, PedagogicalSummary
from pipeline_experiment.pipeline_a_summary.summarizer import ConventionalSummarizer


class ProductionSummaryExtractor:
    @classmethod
    def extract(cls, canonical: CanonicalEducationalInput, llm: UnifiedLLMEngine) -> PedagogicalSummary:
        summarizer = ConventionalSummarizer(llm)
        return summarizer.generate_summary(canonical)
