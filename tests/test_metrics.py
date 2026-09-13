"""
Unit Tests for Speech-to-Text Evaluation Metrics
"""

import unittest
from pathlib import Path
from metrics import (
    normalize_text,
    compute_wer_cer,
    compute_tech_term_accuracy,
    load_glossary,
    compute_omission_and_hallucination,
    detect_repetition_loops,
    compute_timestamp_accuracy,
    calculate_speed_and_cost,
)


class TestSTTMetrics(unittest.TestCase):

    def test_text_normalization(self):
        raw = "We can't use C++ without Big-O analysis!"
        norm = normalize_text(raw)
        self.assertEqual(norm, "we cannot use cpp without big-o analysis")

    def test_wer_computation(self):
        ref = "dijkstra algorithm uses a priority queue or min-heap"
        hyp_perfect = "Dijkstra algorithm uses a priority queue or min-heap"
        hyp_sub = "dijkstra algorithm uses a binary queue or min-heap"
        
        res_perfect = compute_wer_cer(ref, hyp_perfect)
        self.assertEqual(res_perfect["wer"], 0.0)
        self.assertEqual(res_perfect["hits"], 8)
        
        res_sub = compute_wer_cer(ref, hyp_sub)
        self.assertEqual(res_sub["substitutions"], 1)
        self.assertGreater(res_sub["wer"], 0.0)

    def test_tech_term_accuracy(self):
        glossary = ["dijkstra", "priority queue", "min-heap", "adjacency matrix", "time complexity"]
        ref = "Dijkstra with priority queue has better time complexity than adjacency matrix."
        hyp_good = "Dijkstra with priority queue has better time complexity than adjacency matrix."
        hyp_miss = "The algorithm with regular list has better speed than matrix table."
        
        res_good = compute_tech_term_accuracy(ref, hyp_good, glossary)
        self.assertEqual(res_good["tech_term_accuracy_percentage"], 100.0)
        self.assertEqual(res_good["correct_count"], 4)
        
        res_miss = compute_tech_term_accuracy(ref, hyp_miss, glossary)
        self.assertEqual(res_miss["correct_count"], 0)
        self.assertEqual(res_miss["tech_term_accuracy_percentage"], 0.0)

    def test_omission_and_hallucination(self):
        ref = "the quick brown fox jumps over the lazy dog"
        # Dropped 3 words ("the lazy dog") -> omission
        hyp_omission = "the quick brown fox jumps over"
        # Added phantom words -> hallucination
        hyp_hallucination = "the quick brown fox jumps over the lazy dog and runs to the park"
        
        res_om = compute_omission_and_hallucination(ref, hyp_omission)
        self.assertGreater(res_om["omission_rate"], 0.0)
        self.assertEqual(res_om["hallucination_rate"], 0.0)
        
        res_hal = compute_omission_and_hallucination(ref, hyp_hallucination)
        self.assertEqual(res_hal["omission_rate"], 0.0)
        self.assertGreater(res_hal["hallucination_rate"], 0.0)

    def test_repetition_loops(self):
        hyp_loop = "thank you for watching thank you for watching thank you for watching"
        loops = detect_repetition_loops(hyp_loop)
        self.assertEqual(len(loops), 1)
        self.assertEqual(loops[0]["repetitions"], 3)

    def test_timestamp_accuracy(self):
        gt = {
            "text": "sample lecture text",
            "segments": [
                {"start": 0.0, "end": 4.2, "text": "sample lecture"},
                {"start": 4.2, "end": 8.7, "text": "text"}
            ]
        }
        
        hyp_segments_aligned = [
            {"start": 0.1, "end": 4.25, "text": "sample lecture"},
            {"start": 4.22, "end": 8.68, "text": "text"}
        ]
        
        ts_eval = compute_timestamp_accuracy(gt, hyp_segments_aligned)
        self.assertTrue(ts_eval["has_timestamps"])
        self.assertLess(ts_eval["mean_boundary_error_sec"], 0.2)
        self.assertGreater(ts_eval["timestamp_accuracy_score"], 0.8)

    def test_speed_and_cost(self):
        # 60s audio processed in 6s -> RTF = 0.1 (10x real-time)
        res = calculate_speed_and_cost("whisper-api", latency_sec=6.0, audio_duration_sec=60.0)
        self.assertEqual(res["rtf"], 0.1)
        self.assertEqual(res["speed_multiplier"], "10.0x real-time")
        self.assertEqual(res["cost_per_hour_usd"], 0.36)


if __name__ == "__main__":
    unittest.main()
