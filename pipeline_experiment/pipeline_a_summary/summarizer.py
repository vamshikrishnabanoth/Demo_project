"""
Pipeline A: Conventional Summary Generator.
Synthesizes canonical semantic chunks into a structured summary answering 'WHAT content was presented'.
Explicitly does not encode dwell time, repetition, verbal emphasis, debugging, or question allocation.
"""

from typing import Optional
from pipeline_experiment.shared.schemas.canonical_models import (
    CanonicalEducationalInput,
    PedagogicalSummary
)


class ConventionalSummarizer:
    def __init__(self, llm_engine):
        self.llm = llm_engine

    def generate_summary(self, canonical_input: CanonicalEducationalInput) -> PedagogicalSummary:
        """
        Extracts factual and conceptual summary of the material.
        """
        system_prompt = (
            "You are an expert educational content summarizer.\n"
            "Your task is to summarize WHAT content was presented in the provided educational material.\n"
            "Focus on concepts, definitions, mechanisms, algorithms, formulas, code patterns, and factual claims.\n"
            "Do NOT include meta-pedagogical commentary such as dwell time, teacher repetition, or test allocation."
        )

        supporting_context = ""
        if canonical_input.supporting_materials_text:
            supporting_context = f"\n\n--- [SUPPORTING MATERIAL] ---\n{canonical_input.supporting_materials_text[:2000]}"

        chunk_lines = []
        for c in canonical_input.chunks:
            excerpt = c.text[:350] + ("..." if len(c.text) > 350 else "")
            chunk_lines.append(f"[{c.chunk_id}] {excerpt}")
        chunks_text = "\n\n".join(chunk_lines[:10])

        prompt = (
            f"Title: {canonical_input.title}\n"
            f"Input Type: {canonical_input.input_type} | Content Style: {canonical_input.content_style}\n\n"
            f"--- [SOURCE CONTENT CHUNKS] ---\n{chunks_text}\n"
            f"{supporting_context}\n\n"
            "Task: Generate a structured PedagogicalSummary containing:\n"
            "- concepts_and_definitions (List of 4-6 main terms/concepts)\n"
            "- mechanisms_and_formulas (List of 2-4 mathematical equations or mechanisms)\n"
            "- examples_and_code_patterns (List of 2-4 worked examples or code syntax shown)\n"
            "- factual_summary_text (Comprehensive 2-3 paragraph synthesized summary)"
        )

        return self.llm.generate_pydantic(
            prompt=prompt,
            pydantic_class=PedagogicalSummary,
            system_prompt=system_prompt,
            temperature=0.2
        )
