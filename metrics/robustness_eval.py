"""
Acoustic Robustness Evaluation Engine
Evaluates STT degradation across clean vs noisy (fan hum) vs reverberant (classroom echo) audio.
"""

from typing import Any, Dict, List
from metrics.wer import compute_wer_cer
from metrics.tech_terms import compute_tech_term_accuracy


def evaluate_model_robustness(
    model_name: str,
    transcriber,
    condition_suite: Dict[str, Any],
    ground_truth_text: str,
    glossary: List[str]
) -> Dict[str, Any]:
    """
    Evaluates a model across 5 acoustic conditions:
    1. clean
    2. fan_noise_15db (moderate classroom fan hum)
    3. fan_noise_8db (high classroom fan noise)
    4. hall_echo (lecture hall reverberation)
    5. distance_mic (low mic volume / distance attenuation)
    """
    condition_results = {}
    clean_wer = None

    for condition_name, audio_path in condition_suite.items():
        res = transcriber.transcribe(audio_path)
        if res.error:
            condition_results[condition_name] = {
                "wer_pct": None,
                "tta_pct": None,
                "error": res.error,
                "latency_sec": res.latency_sec
            }
            continue

        wer_eval = compute_wer_cer(ground_truth_text, res.raw_transcript, normalize=True)
        tta_eval = compute_tech_term_accuracy(ground_truth_text, res.raw_transcript, glossary=glossary)

        if condition_name == "clean":
            clean_wer = wer_eval["wer_percentage"]

        condition_results[condition_name] = {
            "wer_pct": wer_eval["wer_percentage"],
            "tta_pct": tta_eval["tech_term_accuracy_percentage"],
            "omission_pct": round(wer_eval["deletions"] / max(1, wer_eval["reference_word_count"]) * 100, 2),
            "hallucination_pct": round(wer_eval["insertions"] / max(1, wer_eval["reference_word_count"]) * 100, 2),
            "latency_sec": round(res.latency_sec, 2),
            "raw_transcript": res.raw_transcript
        }

    # Calculate Robustness Score based on degradation from clean
    if clean_wer is not None:
        noisy_wers = [
            data["wer_pct"] for cond, data in condition_results.items()
            if cond != "clean" and data.get("wer_pct") is not None
        ]
        if noisy_wers:
            avg_degradation = max(0.0, float(sum(noisy_wers) / len(noisy_wers) - clean_wer))
            # Robustness Index: 100% (0 degradation) scaling down
            robustness_index = max(0.0, round(100.0 - (avg_degradation * 2.0), 2))
        else:
            robustness_index = 0.0
    else:
        robustness_index = 0.0

    return {
        "model": model_name,
        "clean_wer_pct": clean_wer,
        "robustness_score_pct": robustness_index,
        "conditions": condition_results
    }
