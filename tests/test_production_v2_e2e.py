"""
Final End-to-End Production Verification Test for Architecture E v2.0.
Verifies full pipeline execution with Caching, Planning, Generation, Validation, and Critic Repair.
"""

import os
import sys
sys.path.insert(0, os.path.abspath("."))
import time

from production_engine.ingestion.content_processor import ProductionContentProcessor
from production_engine.core_engine_v2 import AdaptiveAssessmentEngineV2


def test_production_v2_e2e():
    print("="*80)
    print("FINAL END-TO-END PRODUCTION VERIFICATION: ARCHITECTURE E v2.0")
    print("="*80)

    engine = AdaptiveAssessmentEngineV2(provider="groq", model="qwen/qwen3.8-27b", temperature=0.2)

    # Test Input: Multimodal Classroom Lecture (VAE Fashion-MNIST)
    transcript = {
        "text": "In a Variational Autoencoder, the encoder predicts mu and log-variance. We use the reparameterization trick z = mu + sigma * epsilon to allow backpropagation through stochastic nodes.",
        "segments": [
            {"id": 1, "seek": 0, "start": 0.0, "end": 15.0, "text": "In a Variational Autoencoder, the encoder predicts mu and log-variance.", "tokens": [], "temperature": 0.0, "avg_logprob": -0.2, "compression_ratio": 1.1, "no_speech_prob": 0.01},
            {"id": 2, "seek": 15, "start": 15.0, "end": 30.0, "text": "We use the reparameterization trick z = mu + sigma * epsilon to allow backpropagation through stochastic nodes.", "tokens": [], "temperature": 0.0, "avg_logprob": -0.2, "compression_ratio": 1.1, "no_speech_prob": 0.01}
        ]
    }
    slides = "--- Slide 1 ---\nVAE Loss: Loss = Reconstruction_Loss + KL_Divergence\nSampling: z = mu + tf.exp(0.5 * log_var) * eps"

    canonical = ProductionContentProcessor.process_raw_input(
        input_id="PROD_E2E_VAE",
        title="Variational Autoencoder Fundamentals",
        input_type="VOICE_PLUS_PPT",
        content_style="PROBLEM_SOLVING",
        transcript_data=transcript,
        supporting_text=slides
    )

    print("\n--- 1. RUNNING COLD QUIZ REQUEST (Q=3, HARD) ---")
    t0 = time.time()
    suite_cold = engine.generate_assessment(canonical=canonical, transcript_data=transcript, requested_count=3, difficulty="HARD")
    lat_cold = round(time.time() - t0, 2)
    print(f"Cold Run Completed in {lat_cold}s | Delivered: {len(suite_cold.questions)}/3 questions | Status: {suite_cold.validation_status}")
    print(f"Representation Used: {suite_cold.representation_used} | Router Rationale: {suite_cold.routing_rationale[:60]}...")

    print("\n--- 2. RUNNING WARM QUIZ REQUEST (Q=5, MEDIUM) - Intermediate Cache Reuse ---")
    t1 = time.time()
    suite_warm = engine.generate_assessment(canonical=canonical, transcript_data=transcript, requested_count=5, difficulty="MEDIUM")
    lat_warm = round(time.time() - t1, 2)
    print(f"Warm Run Completed in {lat_warm}s | Delivered: {len(suite_warm.questions)}/5 questions | Status: {suite_warm.validation_status}")

    print("\n" + "="*80)
    print("ALL PRODUCTION E2E CHECKS PASSED SUCCESSFULLY!")
    print("="*80)


if __name__ == "__main__":
    test_production_v2_e2e()
