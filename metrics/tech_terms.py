"""
Technical Term Accuracy (TTA) and Domain Keyword Recognition Engine
Evaluates how accurately the STT model preserves specialized Computer Science & Engineering vocabulary.
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple
from difflib import SequenceMatcher
from metrics.normalizer import normalize_text


def load_glossary(glossary_path: str | Path) -> List[str]:
    """Loads terms from a JSON glossary file."""
    path = Path(glossary_path)
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    terms: Set[str] = set()
    if "categories" in data:
        for cat_terms in data["categories"].values():
            for t in cat_terms:
                norm_t = normalize_text(t)
                if norm_t:
                    terms.add(norm_t)
    elif isinstance(data, list):
        for t in data:
            norm_t = normalize_text(t)
            if norm_t:
                terms.add(norm_t)
    return sorted(list(terms))


def extract_terms_present(text: str, glossary: List[str]) -> List[str]:
    """
    Finds which glossary terms occur in the normalized text.
    Handles multi-word phrases (e.g., 'binary search tree', 'acid properties').
    """
    norm_text = f" {normalize_text(text)} "
    found = []
    
    # Sort by length descending to match longest phrases first
    sorted_glossary = sorted(glossary, key=lambda x: len(x.split()), reverse=True)
    
    for term in sorted_glossary:
        # Match as full word boundary
        pattern = f" {term} "
        if pattern in norm_text:
            found.append(term)
    return found


def compute_tech_term_accuracy(
    reference: str,
    hypothesis: str,
    glossary: List[str] | str | Path,
    fuzzy_threshold: float = 0.85
) -> Dict[str, Any]:
    """
    Calculates:
    - Technical Term Accuracy (TTA / Recall): Fraction of reference technical terms correctly captured in hypothesis.
    - Technical Term Precision: Fraction of technical terms in hypothesis that were actually in reference.
    - Technical Term F1-score.
    - List of correctly transcribed terms, missed/omitted terms, and substituted/corrupted terms.
    
    Args:
        reference: Ground truth text
        hypothesis: Model transcribed text
        glossary: List of glossary terms or path to glossary JSON
        fuzzy_threshold: Minimum string similarity ratio to consider a close acoustic match
        
    Returns:
        Dictionary with accuracy, precision, recall, f1, counts, and detailed term lists.
    """
    if isinstance(glossary, (str, Path)):
        glossary = load_glossary(glossary)
        
    ref_terms = extract_terms_present(reference, glossary)
    hyp_terms = extract_terms_present(hypothesis, glossary)
    
    ref_set = set(ref_terms)
    hyp_set = set(hyp_terms)
    
    total_ref_terms = len(ref_terms)
    
    if total_ref_terms == 0:
        return {
            "tech_term_accuracy": 1.0,
            "tech_term_accuracy_percentage": 100.0,
            "precision": 1.0 if len(hyp_terms) == 0 else 0.0,
            "recall": 1.0,
            "f1_score": 1.0 if len(hyp_terms) == 0 else 0.0,
            "total_reference_tech_terms": 0,
            "correctly_identified_terms": [],
            "missed_terms": [],
            "extra_hallucinated_terms": hyp_terms,
        }
        
    correct_terms = []
    missed_terms = []
    
    norm_hyp_text = normalize_text(hypothesis)
    
    for term in ref_terms:
        if term in hyp_set or f" {term} " in f" {norm_hyp_text} ":
            correct_terms.append(term)
        else:
            # Check for close fuzzy match (e.g. slight spelling distortion)
            words = norm_hyp_text.split()
            term_word_count = len(term.split())
            best_ratio = 0.0
            for i in range(len(words) - term_word_count + 1):
                window = " ".join(words[i:i + term_word_count])
                ratio = SequenceMatcher(None, term, window).ratio()
                if ratio > best_ratio:
                    best_ratio = ratio
                    
            if best_ratio >= fuzzy_threshold:
                correct_terms.append(f"{term} (fuzzy ~{int(best_ratio*100)}%)")
            else:
                missed_terms.append(term)
                
    correct_count = len(correct_terms)
    recall = correct_count / total_ref_terms if total_ref_terms > 0 else 0.0
    
    # Extra terms detected in hypothesis that weren't in reference
    extra_terms = [t for t in hyp_terms if t not in ref_set]
    
    precision = correct_count / (correct_count + len(extra_terms)) if (correct_count + len(extra_terms)) > 0 else 0.0
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    
    return {
        "tech_term_accuracy": round(recall, 4),
        "tech_term_accuracy_percentage": round(recall * 100, 2),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1, 4),
        "total_reference_tech_terms": total_ref_terms,
        "correct_count": correct_count,
        "missed_count": len(missed_terms),
        "correctly_identified_terms": correct_terms,
        "missed_terms": missed_terms,
        "extra_terms": extra_terms,
    }
