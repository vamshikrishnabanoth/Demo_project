"""
Timestamp Accuracy and Boundary Alignment Engine
Measures Mean Absolute Error (MAE) and drift between ground-truth and predicted timestamps.
"""

from typing import Any, Dict, List, Optional
import numpy as np


def compute_timestamp_accuracy(
    ground_truth_data: Dict[str, Any] | List[Dict[str, Any]],
    hypothesis_segments: List[Dict[str, Any]],
    audio_duration: Optional[float] = None
) -> Dict[str, Any]:
    """
    Evaluates alignment accuracy between reference timestamps and hypothesis timestamps.
    
    Expected Ground Truth structure:
    {
      "text": "...",
      "segments": [
        {"start": 0.0, "end": 4.2, "text": "..."},
        {"start": 4.2, "end": 8.7, "text": "..."}
      ]
    }
    or a list of segment dictionaries.
    
    Returns:
        Dictionary with start_mae, end_mae, mean_boundary_error, max_drift_seconds, timestamp_accuracy_score
    """
    if isinstance(ground_truth_data, dict):
        ref_segments = ground_truth_data.get("segments", [])
    elif isinstance(ground_truth_data, list):
        ref_segments = ground_truth_data
    else:
        ref_segments = []

    if not ref_segments or not hypothesis_segments:
        has_hyp = len(hypothesis_segments) > 0
        return {
            "has_timestamps": has_hyp,
            "mean_start_mae_sec": None,
            "mean_end_mae_sec": None,
            "mean_boundary_error_sec": None,
            "max_drift_sec": None,
            "timestamp_accuracy_score": 0.0 if not has_hyp else 0.5,
            "timestamp_accuracy_percentage": 0.0 if not has_hyp else 50.0,
            "evaluated_segments_count": 0,
        }
        
    start_errors = []
    end_errors = []
    
    for ref in ref_segments:
        ref_start = float(ref.get("start", 0.0))
        ref_end = float(ref.get("end", 0.0))
        
        # Find closest hypothesis segment by start timestamp
        best_match = min(hypothesis_segments, key=lambda h: abs(float(h.get("start", 0.0)) - ref_start))
        hyp_start = float(best_match.get("start", 0.0))
        hyp_end = float(best_match.get("end", 0.0))
        
        start_errors.append(abs(hyp_start - ref_start))
        end_errors.append(abs(hyp_end - ref_end))
        
    mean_start_mae = float(np.mean(start_errors)) if start_errors else 0.0
    mean_end_mae = float(np.mean(end_errors)) if end_errors else 0.0
    mean_boundary_err = float((mean_start_mae + mean_end_mae) / 2.0)
    max_drift = float(max(max(start_errors, default=0.0), max(end_errors, default=0.0)))
    
    # Accuracy score: 1.0 (0s error) linearly scales down to 0.0 at >= 2.0s mean boundary error
    acc_score = max(0.0, min(1.0, 1.0 - (mean_boundary_err / 2.0)))
    
    return {
        "has_timestamps": True,
        "mean_start_mae_sec": round(mean_start_mae, 3),
        "mean_end_mae_sec": round(mean_end_mae, 3),
        "mean_boundary_error_sec": round(mean_boundary_err, 3),
        "max_drift_sec": round(max_drift, 3),
        "timestamp_accuracy_score": round(acc_score, 4),
        "timestamp_accuracy_percentage": round(acc_score * 100, 2),
        "evaluated_segments_count": len(ref_segments),
    }
