"""
Omission Rate, Hallucination Rate, and Repetition Anomaly Detection Engine
"""

import re
from typing import Any, Dict, List, Tuple
from collections import Counter
from metrics.normalizer import normalize_text
from metrics.wer import compute_wer_cer


def detect_repetition_loops(text: str, min_phrase_len: int = 2, max_phrase_len: int = 8, min_repeats: int = 3) -> List[Dict[str, Any]]:
    """
    Detects hallucinated repetition loops where the model repeats phrases consecutively.
    E.g.: 'thank you for watching thank you for watching thank you for watching'
    """
    words = normalize_text(text).split()
    n = len(words)
    loops = []
    
    if n < min_phrase_len * min_repeats:
        return loops
        
    seen_spans = set()
    
    for phrase_len in range(min_phrase_len, min_phrase_len + max_phrase_len):
        for i in range(n - phrase_len * min_repeats + 1):
            phrase = " ".join(words[i:i + phrase_len])
            repeats = 1
            idx = i + phrase_len
            
            while idx + phrase_len <= n and " ".join(words[idx:idx + phrase_len]) == phrase:
                repeats += 1
                idx += phrase_len
                
            if repeats >= min_repeats:
                span_key = (phrase, i, repeats)
                if phrase not in [l["phrase"] for l in loops]:
                    loops.append({
                        "phrase": phrase,
                        "repetitions": repeats,
                        "start_word_index": i,
                        "total_wasted_words": repeats * phrase_len
                    })
    return loops


def compute_omission_and_hallucination(
    reference: str,
    hypothesis: str,
    wer_details: Dict[str, Any] | None = None
) -> Dict[str, Any]:
    """
    Calculates:
    - Omission Rate: Deletions / Reference Words (fraction of words dropped by model)
    - Hallucination Rate: Insertions / Reference Words (fraction of unprompted phantom words inserted)
    - Repetition Loops: List of hallucinated looping sequences
    """
    if wer_details is None:
        wer_details = compute_wer_cer(reference, hypothesis)
        
    ref_words = wer_details["reference_word_count"]
    deletions = wer_details["deletions"]
    insertions = wer_details["insertions"]
    
    if ref_words > 0:
        omission_rate = deletions / ref_words
        hallucination_rate = insertions / ref_words
    else:
        omission_rate = 0.0
        hallucination_rate = 1.0 if wer_details["hypothesis_word_count"] > 0 else 0.0
        
    repetition_loops = detect_repetition_loops(hypothesis)
    
    return {
        "omission_rate": round(omission_rate, 4),
        "omission_rate_percentage": round(omission_rate * 100, 2),
        "hallucination_rate": round(hallucination_rate, 4),
        "hallucination_rate_percentage": round(hallucination_rate * 100, 2),
        "deleted_word_count": deletions,
        "inserted_word_count": insertions,
        "repetition_loops_detected": len(repetition_loops),
        "repetition_loops": repetition_loops,
    }
