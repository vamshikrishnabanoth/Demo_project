"""
Explicit Cross-Material Aligner: Establishes bi-directional semantic and code-symbol
edges between Spoken Audio Chunks and Slide/Document Chunks to prevent modality dropping.
"""

import re
from typing import List, Dict, Any, Set, Tuple
from pydantic import BaseModel, Field

from pipeline_experiment.shared.schemas.canonical_models import CanonicalEducationalInput, SemanticChunk


class CrossModalLink(BaseModel):
    source_evidence_id: str
    target_evidence_id: str
    similarity_score: float
    link_reason: str


class CrossMaterialAligner:
    """Builds explicit cross-modal semantic links between Voice transcripts and PPT/PDF slides."""

    @classmethod
    def tokenize(cls, text: str) -> Set[str]:
        words = re.findall(r"\b[a-zA-Z_]{3,}\b", text.lower())
        stopwords = {"this", "that", "with", "from", "have", "were", "what", "when", "where", "which", "there", "their", "about"}
        return set([w for w in words if w not in stopwords])

    @classmethod
    def build_alignment_graph(cls, canonical: CanonicalEducationalInput, threshold: float = 0.12) -> Dict[str, List[str]]:
        audio_chunks = [c for c in canonical.chunks if c.source_type == "TRANSCRIPT"]
        slide_chunks = [c for c in canonical.chunks if c.source_type == "SLIDE"]

        alignment_map: Dict[str, List[str]] = {}

        for a in audio_chunks:
            a_eid = a.evidence.evidence_id
            a_tokens = cls.tokenize(a.text)
            if not a_tokens:
                continue

            scored_slides: List[Tuple[float, str]] = []

            for s in slide_chunks:
                s_eid = s.evidence.evidence_id
                s_tokens = cls.tokenize(s.text)
                if not s_tokens:
                    continue

                # Compute Jaccard overlap + keyword/symbol boost
                overlap = len(a_tokens.intersection(s_tokens))
                union = len(a_tokens.union(s_tokens))
                jaccard = overlap / max(1, union)

                # Concept expansion heuristics: map colloquial terms to slide terms
                expanded_match = False
                if ("bottleneck" in a_tokens or "squeeze" in a_tokens) and ("latent" in s_tokens or "dimension" in s_tokens):
                    expanded_match = True
                if ("divergence" in a_tokens or "kl" in a_tokens or "loss" in a_tokens) and ("kl" in s_tokens or "regularization" in s_tokens):
                    expanded_match = True
                if ("reparameterization" in a_tokens or "sample" in a_tokens) and ("sampling" in s_tokens or "epsilon" in s_tokens):
                    expanded_match = True

                score = jaccard + (0.25 if expanded_match else 0.0)
                if score >= threshold:
                    scored_slides.append((score, s_eid))

            scored_slides.sort(key=lambda x: x[0], reverse=True)
            alignment_map[a_eid] = [eid for _, eid in scored_slides[:2]]

        # Reverse mapping: Slide -> Audio
        for s in slide_chunks:
            s_eid = s.evidence.evidence_id
            linked_audio = [a_eid for a_eid, s_eids in alignment_map.items() if s_eid in s_eids]
            alignment_map[s_eid] = linked_audio[:2]

        return alignment_map

    @classmethod
    def expand_evidence_with_alignment(
        cls,
        canonical: CanonicalEducationalInput,
        retrieved_evidence_ids: List[str],
        alignment_graph: Dict[str, List[str]]
    ) -> List[str]:
        """Expands retrieved evidence IDs to ensure both audio and slide modalities are represented."""
        expanded_ids = list(retrieved_evidence_ids)
        has_audio = any(eid.startswith("E_C") for eid in retrieved_evidence_ids)
        has_slide = any(eid.startswith("E_SLIDE") for eid in retrieved_evidence_ids)

        if has_audio and not has_slide:
            # Inject top linked slide for the primary audio chunk
            primary_audio = [eid for eid in retrieved_evidence_ids if eid.startswith("E_C")][0]
            linked_slides = alignment_graph.get(primary_audio, [])
            if linked_slides:
                expanded_ids.append(linked_slides[0])
        elif has_slide and not has_audio:
            # Inject top linked audio for the primary slide chunk
            primary_slide = [eid for eid in retrieved_evidence_ids if eid.startswith("E_SLIDE")][0]
            linked_audio = alignment_graph.get(primary_slide, [])
            if linked_audio:
                expanded_ids.append(linked_audio[0])

        return list(dict.fromkeys(expanded_ids))
