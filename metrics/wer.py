"""
Word Error Rate (WER) and Character Error Rate (CER) Metric Engine
Uses JiWER with alignment analysis.
"""

from typing import Any, Dict
import jiwer
from metrics.normalizer import normalize_text


def compute_wer_cer(
    reference: str,
    hypothesis: str,
    normalize: bool = True
) -> Dict[str, Any]:
    """
    Computes WER, CER, and detailed Levenshtein edit operations:
    - S: Substitutions
    - D: Deletions (Omissions)
    - I: Insertions (Hallucinations / Additions)
    - H: Hits (Correctly matched words)
    - N: Total reference words
    
    Args:
        reference: Ground truth human transcript
        hypothesis: Model predicted transcript
        normalize: Whether to normalize both texts before computation
        
    Returns:
        Dictionary containing wer, cer, substitutions, deletions, insertions, hits, reference_length, hypothesis_length
    """
    ref_eval = normalize_text(reference) if normalize else reference.strip()
    hyp_eval = normalize_text(hypothesis) if normalize else hypothesis.strip()
    
    if not ref_eval:
        if not hyp_eval:
            return {
                "wer": 0.0,
                "cer": 0.0,
                "substitutions": 0,
                "deletions": 0,
                "insertions": 0,
                "hits": 0,
                "reference_word_count": 0,
                "hypothesis_word_count": 0,
            }
        return {
            "wer": 1.0,
            "cer": 1.0,
            "substitutions": 0,
            "deletions": 0,
            "insertions": len(hyp_eval.split()),
            "hits": 0,
            "reference_word_count": 0,
            "hypothesis_word_count": len(hyp_eval.split()),
        }

    # Use jiwer process_words for detailed alignment counts
    out = jiwer.process_words(ref_eval, hyp_eval)
    
    wer = float(out.wer)
    cer = float(jiwer.cer(ref_eval, hyp_eval))
    
    return {
        "wer": round(wer, 4),
        "cer": round(cer, 4),
        "wer_percentage": round(wer * 100, 2),
        "cer_percentage": round(cer * 100, 2),
        "substitutions": int(out.substitutions),
        "deletions": int(out.deletions),
        "insertions": int(out.insertions),
        "hits": int(out.hits),
        "reference_word_count": int(out.substitutions + out.deletions + out.hits),
        "hypothesis_word_count": int(out.substitutions + out.insertions + out.hits),
    }
