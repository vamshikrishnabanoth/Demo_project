"""
Speech-to-Text Benchmark Metrics Package
"""

from metrics.normalizer import normalize_text, tokenize_words
from metrics.wer import compute_wer_cer
from metrics.tech_terms import compute_tech_term_accuracy, load_glossary
from metrics.error_metrics import compute_omission_and_hallucination, detect_repetition_loops
from metrics.timestamp_metrics import compute_timestamp_accuracy
from metrics.cost_speed import calculate_speed_and_cost

__all__ = [
    "normalize_text",
    "tokenize_words",
    "compute_wer_cer",
    "compute_tech_term_accuracy",
    "load_glossary",
    "compute_omission_and_hallucination",
    "detect_repetition_loops",
    "compute_timestamp_accuracy",
    "calculate_speed_and_cost",
]
