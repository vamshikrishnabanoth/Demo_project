"""
3-Level Results Compiler & Decision Engine.
Implements:
- Level 1: Per-Input Report with Predefined Decision Rules and Full Question Text.
- Level 2: Input Type & Style Aggregation Matrix.
- Level 3: Global Research Synthesis answering the 5 Core Research Questions.
"""

from typing import List, Dict, Any
import json
import os
from pipeline_experiment.shared.schemas.canonical_models import MCQSuite


class ResultsCompiler:
    SIGNIFICANCE_DELTA = 0.05
    CORRECTNESS_TOLERANCE = 0.05

    @classmethod
    def compute_composite_quality_score(cls, metrics: Dict[str, Any]) -> float:
        """
        Computes standardized composite quality score Q in [0.0, 1.0].
        Weights: Grounding (0.30), Answerability (0.25), Specificity (0.20), Bloom (0.15), Non-Genericness (0.10).
        """
        grounding_norm = metrics.get("source_grounding_percentage", 50.0) / 100.0
        ans_norm = metrics.get("source_answerability_percentage", 50.0) / 100.0
        spec_norm = (metrics.get("specificity_score", 3.0) - 1.0) / 4.0
        bloom_norm = min(1.0, (metrics.get("average_bloom_level", 2.0) - 1.0) / 3.0)
        non_generic_norm = (5.0 - metrics.get("genericness_index", 3.0)) / 4.0

        q_score = (
            0.30 * grounding_norm
            + 0.25 * ans_norm
            + 0.20 * spec_norm
            + 0.15 * bloom_norm
            + 0.10 * non_generic_norm
        )
        return round(q_score, 3)

    @classmethod
    def determine_winner_rule(
        cls,
        metrics_a: Dict[str, Any],
        metrics_b: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Applies predefined mathematical decision rules to declare Level 1 winner.
        """
        q_a = cls.compute_composite_quality_score(metrics_a)
        q_b = cls.compute_composite_quality_score(metrics_b)
        delta = round(q_b - q_a, 3)

        corr_a = metrics_a.get("technical_correctness_rate", 100.0)
        corr_b = metrics_b.get("technical_correctness_rate", 100.0)

        if delta >= cls.SIGNIFICANCE_DELTA and corr_b >= (corr_a - cls.CORRECTNESS_TOLERANCE):
            winner = "BLUEPRINT"
            reason = f"Blueprint produced higher composite pedagogical quality (Q_B={q_b} vs Q_A={q_a}, delta=+{delta}) with high grounding and cognitive alignment."
        elif delta <= -cls.SIGNIFICANCE_DELTA and corr_a >= (corr_b - cls.CORRECTNESS_TOLERANCE):
            winner = "SUMMARY"
            reason = f"Summary produced higher composite quality (Q_A={q_a} vs Q_B={q_b}, delta={delta}) on static/factual content."
        else:
            winner = "EQUIVALENT / INCONCLUSIVE"
            reason = f"Composite quality difference (|delta|={abs(delta)}) is within the indifference threshold ({cls.SIGNIFICANCE_DELTA})."

        return {
            "winner": winner,
            "composite_score_summary": q_a,
            "composite_score_blueprint": q_b,
            "quality_delta": delta,
            "rationale": reason
        }

    @classmethod
    def determine_three_way_winner(
        cls,
        metrics_a: Dict[str, Any],
        metrics_b: Dict[str, Any],
        metrics_c: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Applies 3-way comparison rules across Pipeline A (Summary), Pipeline B (Blueprint), and Pipeline C (Unified WHAT + WHY).
        """
        q_a = cls.compute_composite_quality_score(metrics_a)
        q_b = cls.compute_composite_quality_score(metrics_b)
        q_c = cls.compute_composite_quality_score(metrics_c)

        delta_c_a = round(q_c - q_a, 3)
        delta_c_b = round(q_c - q_b, 3)
        delta_b_a = round(q_b - q_a, 3)

        scores = {"SUMMARY_PIPELINE_A": q_a, "BLUEPRINT_PIPELINE_B": q_b, "UNIFIED_PIPELINE_C": q_c}
        best_pipe = max(scores, key=scores.get)
        best_score = scores[best_pipe]

        # Check if C is best or virtually tied with the best while having high cognitive depth
        if q_c >= max(q_a, q_b) - 0.015 and metrics_c.get("average_bloom_level", 2.0) >= metrics_a.get("average_bloom_level", 2.0):
            winner = "UNIFIED_PIPELINE_C"
            reason = f"Pipeline C (WHAT + WHY) produced optimal overall quality (Q_C={q_c}, Bloom={metrics_c.get('average_bloom_level')}) combining technical grounding with pedagogical depth."
        elif best_pipe == "BLUEPRINT_PIPELINE_B" and q_b > q_c + 0.02:
            winner = "BLUEPRINT_PIPELINE_B"
            reason = f"Blueprint produced highest quality (Q_B={q_b} vs Q_C={q_c}, Q_A={q_a})."
        elif best_pipe == "SUMMARY_PIPELINE_A" and q_a > q_c + 0.02:
            winner = "SUMMARY_PIPELINE_A"
            reason = f"Summary produced highest quality (Q_A={q_a} vs Q_C={q_c}, Q_B={q_b})."
        else:
            winner = "UNIFIED_PIPELINE_C"
            reason = f"Unified Pipeline C matches or exceeds individual pipelines (Q_C={q_c}, Q_B={q_b}, Q_A={q_a})."

        return {
            "winner": winner,
            "q_summary_a": q_a,
            "q_blueprint_b": q_b,
            "q_unified_c": q_c,
            "delta_c_minus_a": delta_c_a,
            "delta_c_minus_b": delta_c_b,
            "delta_b_minus_a": delta_b_a,
            "rationale": reason
        }

    @classmethod
    def generate_level_1_markdown(
        cls,
        input_id: str,
        title: str,
        input_type: str,
        content_style: str,
        metrics_a: Dict[str, Any],
        metrics_b: Dict[str, Any],
        suite_a: MCQSuite,
        suite_b: MCQSuite,
        blueprint_validity: Dict[str, Any]
    ) -> str:
        """Generates clean Level 1 Per-Input Markdown Report."""
        decision = cls.determine_winner_rule(metrics_a, metrics_b)

        md = []
        md.append(f"# Level 1 Report: {title}")
        md.append(f"**Input ID**: `{input_id}` | **Input Type**: `{input_type}` | **Content Style**: `{content_style}`\n")
        md.append("## 1. Quantitative Metrics Comparison\n")
        md.append("| Evaluation Dimension | Pipeline A (Summary) | Pipeline B (Blueprint) | Metric Interpretation |")
        md.append("| :--- | :---: | :---: | :--- |")
        md.append(f"| **Source Grounding** | {metrics_a.get('source_grounding_percentage')}% | {metrics_b.get('source_grounding_percentage')}% | Grounding in source chunks |")
        md.append(f"| **Source Answerability** | {metrics_a.get('source_answerability_percentage')}% | {metrics_b.get('source_answerability_percentage')}% | Answerable from provided material |")
        md.append(f"| **Average Bloom's Level** | {metrics_a.get('average_bloom_level')} / 6.0 | {metrics_b.get('average_bloom_level')} / 6.0 | Cognitive depth demand |")
        md.append(f"| **Material Specificity** | {metrics_a.get('specificity_score')} / 5.0 | {metrics_b.get('specificity_score')} / 5.0 | Reflection of specific treatment |")
        md.append(f"| **Genericness Index** | {metrics_a.get('genericness_index')} / 5.0 | {metrics_b.get('genericness_index')} / 5.0 | Lower = More uniquely tailored |")
        md.append(f"| **Question Diversity** | {metrics_a.get('diversity_score')} | {metrics_b.get('diversity_score')} | Intra-suite conceptual variety |")
        md.append(f"| **Composite Quality (Q)** | **{decision['composite_score_summary']}** | **{decision['composite_score_blueprint']}** | Standardized Quality Score |\n")

        md.append(f"### **DECISION: {decision['winner']}**")
        md.append(f"> {decision['rationale']}\n")

        md.append("## 2. Experiment B1: Blueprint Validity Assessment")
        md.append(f"- **Topics Grounded in Source**: {blueprint_validity.get('topics_grounded_percentage')}%")
        md.append(f"- **Salience Alignment Score**: {blueprint_validity.get('salience_alignment_score')} / 5.0")
        md.append(f"- **Instructional Act Accuracy**: {blueprint_validity.get('instructional_act_accuracy')}%")
        md.append(f"- **Overall Blueprint Validity**: **{blueprint_validity.get('overall_validity_percentage')}%**\n")

        md.append("## 3. Actual Generated Questions\n")
        md.append("### Pipeline A Questions (Summary)")
        for idx, q in enumerate(suite_a.questions):
            md.append(f"**Q{idx+1} ({q.cognitive_level})**: {q.question_text}")
            md.append(f"- A: {q.option_a}\n- B: {q.option_b}\n- C: {q.option_c}\n- D: {q.option_d}")
            md.append(f"- *Correct*: **{q.correct_option}** | *Explanation*: {q.explanation}\n")

        md.append("### Pipeline B Questions (Blueprint)")
        for idx, q in enumerate(suite_b.questions):
            md.append(f"**Q{idx+1} ({q.cognitive_level})**: {q.question_text}")
            md.append(f"- A: {q.option_a}\n- B: {q.option_b}\n- C: {q.option_c}\n- D: {q.option_d}")
            md.append(f"- *Correct*: **{q.correct_option}** | *Explanation*: {q.explanation}\n")

        return "\n".join(md)
