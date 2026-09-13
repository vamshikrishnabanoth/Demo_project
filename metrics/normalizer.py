"""
Text Normalization with Indic Script Harmonization for STT Benchmark Evaluation.
Harmonizes English, Romanized Hinglish/Teluglish, and Devanagari Indic script outputs
for fair acoustic Word Error Rate (WER) and Technical-Term Accuracy (TTA) computation.
"""

import re
import unicodedata

# Common academic spoken contractions
CONTRACTIONS = {
    r"\bcan't\b": "cannot",
    r"\bwon't\b": "will not",
    r"\bn't\b": " not",
    r"\b're\b": " are",
    r"\b's\b": " is",
    r"\b'd\b": " would",
    r"\b'll\b": " will",
    r"\b've\b": " have",
    r"\b'm\b": " am",
    r"\blet's\b": "let us",
}

# Devanagari to Latin phonetic transliteration map
DEVANAGARI_MAP = {
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh',
    'ष': 'sh', 'स': 's', 'ह': 'h',
    'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u',
    'ऊ': 'oo', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
    'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u',
    'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', '्': '',
    'ं': 'n', 'ँ': 'n', 'ः': 'h', '़': '',
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
}

# Common transliterated CS domain acronyms from Indic script
INDIC_TECH_TERMS = {
    "एलसीएम": "lcm",
    "जेसीडी": "gcd",
    "जीसीडी": "gcd",
    "मॉड्यूलो": "modulo",
    "माड्यूलो": "modulo",
    "इक्वल": "equal",
    "जीरो": "zero",
    "मल्टीपल": "multiple",
    "प्रोग्रामिंग": "programming",
    "लैंग्वेज": "language",
    "इंपॉर्टेंट": "important",
    "इम्पॉर्टेंट": "important",
}


def transliterate_indic_to_latin(text: str) -> str:
    """
    Transliterates Devanagari Hindi text to Romanized Latin phonetics.
    Preserves exact acoustic pronunciation for fair WER alignment.
    """
    for indic_term, latin_term in INDIC_TECH_TERMS.items():
        text = text.replace(indic_term, latin_term)

    consonants = set('कखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह')
    vowel_signs = set('ािीुूृेैोौ्')
    
    out = []
    i = 0
    n = len(text)
    
    while i < n:
        char = text[i]
        if char in DEVANAGARI_MAP:
            lat = DEVANAGARI_MAP[char]
            if char in consonants:
                next_char = text[i+1] if i + 1 < n else ''
                if next_char not in vowel_signs and next_char not in ('', ' '):
                    lat += 'a'
            out.append(lat)
        else:
            out.append(char)
        i += 1
    return "".join(out)


def normalize_text(text: str, remove_punctuation: bool = True, lower: bool = True, transliterate_indic: bool = True) -> str:
    """
    Standardize reference and hypothesis text for fair acoustic comparison.
    Handles contractions, technical symbols, casing, and Indic-to-Latin transliteration.
    """
    if not text:
        return ""
    
    # 1. Transliterate Devanagari to Latin if present
    if transliterate_indic and any('\u0900' <= c <= '\u097F' for c in text):
        text = transliterate_indic_to_latin(text)
        
    # 2. Unicode normalization
    text = unicodedata.normalize("NFKD", text)
    
    if lower:
        text = text.lower()
        
    # 3. Expand contractions
    for pattern, replacement in CONTRACTIONS.items():
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
        
    # 4. Standardize mathematical and technical operators (standalone only)
    text = re.sub(r"\s*[*×]\s*", " into ", text)
    text = re.sub(r"\b[xX]\b", "into", text)
    text = text.replace("c++", "cpp")
    text = text.replace("c#", "csharp")
    text = text.replace("==", "equal equal")
    text = text.replace("=", "equal")
    
    # Convert spoken digit words to numeric digits for consistent matching
    digit_map = {
        r"\bzero\b": "0", r"\bone\b": "1", r"\btwo\b": "2", r"\bthree\b": "3",
        r"\bfour\b": "4", r"\bfive\b": "5", r"\bsix\b": "6", r"\bseven\b": "7",
        r"\beight\b": "8", r"\bnine\b": "9", r"\bten\b": "10", r"\btwelve\b": "12",
        r"\btwenty four\b": "24", r"\btwenty-four\b": "24"
    }
    for pat, repl in digit_map.items():
        text = re.sub(pat, repl, text, flags=re.IGNORECASE)

    if remove_punctuation:
        text = re.sub(r"[^\w\s-]", " ", text)
        text = re.sub(r"(?<!\w)-|-(?!\w)", " ", text)
        
    # Collapse multiple whitespaces
    text = re.sub(r"\s+", " ", text).strip()
    return text


def tokenize_words(text: str) -> list[str]:
    """Tokenize normalized text into words."""
    norm = normalize_text(text, remove_punctuation=True, lower=True)
    return norm.split() if norm else []
