"""
Hierarchical Retriever: Precision child matching with parent contextual framing.
"""

import re
from typing import List, Dict, Any, Tuple
from production_engine.schemas import AssessmentTarget
from production_engine.experimental.hierarchical_rag.schemas import (
    HierarchicalEvidenceStore, ChildChunk, ParentChunk, HierarchicalRetrievedEvidence
)


class HierarchicalRetriever:
    """Retrieves target evidence by scoring child chunks and expanding to parent context windows."""

    @classmethod
    def tokenize(cls, text: str) -> List[str]:
        return [w.lower() for w in re.findall(r"\b\w{3,}\b", text)]

    @classmethod
    def retrieve_for_target(
        cls,
        store: HierarchicalEvidenceStore,
        target: AssessmentTarget,
        top_k_children: int = 2
    ) -> HierarchicalRetrievedEvidence:
        query_text = f"{target.concept_name} {target.what_taught} {target.why_assessed}"
        q_tokens = cls.tokenize(query_text)
        q_set = set(q_tokens)

        scored_children: List[Tuple[float, ChildChunk]] = []

        for child in store.children:
            c_tokens = cls.tokenize(child.text)
            if not c_tokens:
                continue

            overlap = sum(1 for t in c_tokens if t in q_set)
            jaccard = overlap / max(1, len(set(c_tokens).union(q_set)))
            
            # Boost if exact concept name appears in child text
            boost = 1.5 if target.concept_name.lower() in child.text.lower() else 1.0
            score = round(jaccard * boost, 4)

            scored_children.append((score, child))

        scored_children.sort(key=lambda x: x[0], reverse=True)
        top_children = [c for _, c in scored_children[:top_k_children]]

        if not top_children and store.children:
            top_children = store.children[:1]

        matched_child_eids = [c.evidence_id for c in top_children]
        
        # Identify and deduplicate parent contexts
        parent_eids = list(dict.fromkeys([c.parent_id for c in top_children if c.parent_id in store.parent_map]))
        
        # Build precise citation spans
        citation_spans = []
        for c in top_children:
            if c.time_span:
                s, e = c.time_span.start, c.time_span.end
                citation_spans.append(f"{c.evidence_id} ({int(s//60)}m{int(s%60):02d}s - {int(e//60)}m{int(e%60):02d}s)")
            else:
                citation_spans.append(f"{c.evidence_id}")

        # Assemble prompt context: Parent macro-narrative with explicit highlighted child focal points
        prompt_sections = []
        total_parent_words = 0
        total_child_words = sum(c.word_count for c in top_children)

        for p_eid in parent_eids:
            parent_obj = store.parent_map[p_eid]
            total_parent_words += parent_obj.word_count
            
            # Highlight child excerpts within parent context
            prompt_sections.append(
                f"=== [PARENT CONTEXT: {parent_obj.title} ({parent_obj.evidence_id})] ===\n"
                f"{parent_obj.full_text}\n"
                f"=== [END PARENT CONTEXT] ==="
            )

        combined_prompt_content = "\n\n".join(prompt_sections)
        top_score = scored_children[0][0] if scored_children else 0.0

        return HierarchicalRetrievedEvidence(
            target_id=target.target_id,
            concept_name=target.concept_name,
            matched_child_ids=matched_child_eids,
            parent_context_ids=parent_eids,
            citation_spans_text=" | ".join(citation_spans),
            retrieved_content=combined_prompt_content,
            relevance_score=top_score,
            parent_context_length_words=total_parent_words,
            child_evidence_length_words=total_child_words
        )

    @classmethod
    def retrieve_for_plan(
        cls,
        store: HierarchicalEvidenceStore,
        targets: List[AssessmentTarget]
    ) -> Dict[str, HierarchicalRetrievedEvidence]:
        return {t.target_id: cls.retrieve_for_target(store, t) for t in targets}
