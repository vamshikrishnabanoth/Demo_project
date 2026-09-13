"""
Consistency and Determinism Evaluation Engine
Evaluates STT output stability and variance across repeated runs on identical audio.
"""

from typing import Any, Dict, List
from difflib import SequenceMatcher
from metrics.normalizer import normalize_text
from metrics.wer import compute_wer_cer


def evaluate_model_consistency(
    model_name: str,
    transcriber,
    audio_path: str,
    ground_truth_text: str,
    runs: int = 3
) -> Dict[str, Any]:
    """
    Executes N identical transcription runs and computes:
    - Pairwise similarity matrix between runs
    - Consistency Index (0.0 to 1.0, where 1.0 = 100% deterministic output)
    - WER standard deviation across runs
    """
    run_transcripts = []
    run_wers = []
    latencies = []

    for i in range(runs):
        res = transcriber.transcribe(audio_path)
        if res.error:
            continue
            
        norm_txt = normalize_text(res.raw_transcript)
        run_transcripts.append(norm_txt)
        latencies.append(res.latency_sec)
        
        wer_res = compute_wer_cer(ground_truth_text, res.raw_transcript, normalize=True)
        run_wers.append(wer_res["wer_percentage"])

    if len(run_transcripts) < 2:
        return {
            "model": model_name,
            "consistency_index_pct": 100.0 if len(run_transcripts) == 1 else 0.0,
            "wer_mean_pct": run_wers[0] if run_wers else None,
            "wer_std_dev": 0.0,
            "mean_latency_sec": round(sum(latencies)/len(latencies), 2) if latencies else 0.0,
            "runs_evaluated": len(run_transcripts)
        }

    # Calculate pairwise similarity between all run pairs
    similarities = []
    for i in range(len(run_transcripts)):
        for j in range(i + 1, len(run_transcripts)):
            ratio = SequenceMatcher(None, run_transcripts[i], run_transcripts[j]).ratio()
            similarities.append(ratio)

    avg_similarity = sum(similarities) / len(similarities) if similarities else 1.0
    
    # Calculate WER standard deviation
    mean_wer = sum(run_wers) / len(run_wers)
    variance = sum((w - mean_wer) ** 2 for w in run_wers) / len(run_wers)
    std_dev = variance ** 0.5

    return {
        "model": model_name,
        "consistency_index_pct": round(avg_similarity * 100, 2),
        "wer_mean_pct": round(mean_wer, 2),
        "wer_std_dev": round(std_dev, 3),
        "mean_latency_sec": round(sum(latencies) / len(latencies), 2),
        "runs_evaluated": len(run_transcripts)
    }
