"""
Cross-Input Similarity & Topic Overlap Engine.
Measures inter-suite similarity across different educational inputs to detect generic topic collapse.
"""

from typing import List, Dict, Any
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from pipeline_experiment.shared.schemas.canonical_models import MCQSuite


class CrossInputSimilarityAnalyzer:
    @staticmethod
    def compute_suite_similarity(suite_1: MCQSuite, suite_2: MCQSuite) -> float:
        """
        Computes cosine similarity between two question suites.
        High similarity between distinct inputs indicates generic topic collapse.
        """
        text_1 = " ".join([f"{q.question_text} {q.option_a} {q.option_b} {q.option_c} {q.option_d}" for q in suite_1.questions])
        text_2 = " ".join([f"{q.question_text} {q.option_a} {q.option_b} {q.option_c} {q.option_d}" for q in suite_2.questions])

        if not text_1.strip() or not text_2.strip():
            return 0.0

        try:
            vec = TfidfVectorizer(stop_words="english")
            tfidf = vec.fit_transform([text_1, text_2])
            sim = cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0]
            return round(float(sim), 4)
        except Exception:
            return 0.0
