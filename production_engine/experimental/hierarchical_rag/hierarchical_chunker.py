"""
Hierarchical Chunker: Transforms canonical educational inputs into dual-level
Parent-Child Evidence Stores.
"""

import re
from typing import List, Dict, Any, Optional

from pipeline_experiment.shared.schemas.canonical_models import (
    CanonicalEducationalInput, SemanticChunk, TimeSpan
)
from production_engine.experimental.hierarchical_rag.schemas import (
    ChildChunk, ParentChunk, HierarchicalEvidenceStore
)


class HierarchicalChunker:
    """Builds dual-level Parent-Child chunk hierarchy from transcripts and supporting text."""

    CHILD_WINDOW_WORDS = 75    # Micro-unit for high-precision citation (~30-45s)
    PARENT_WINDOW_WORDS = 400  # Macro-unit for narrative reasoning context (~3-5 mins)

    @classmethod
    def tokenize_keywords(cls, text: str) -> List[str]:
        words = re.findall(r"\b[a-zA-Z_]{4,}\b", text.lower())
        stopwords = {
            "this", "that", "with", "from", "have", "were", "what", "when", "where",
            "which", "there", "their", "about", "would", "could", "should", "going",
            "because", "these", "those", "being", "other"
        }
        return list(set([w for w in words if w not in stopwords]))[:10]

    @classmethod
    def build_store(cls, canonical: CanonicalEducationalInput, transcript_data: Optional[Dict[str, Any]] = None) -> HierarchicalEvidenceStore:
        parents: List[ParentChunk] = []
        children: List[ChildChunk] = []
        parent_map: Dict[str, ParentChunk] = {}
        child_map: Dict[str, ChildChunk] = {}

        # 1. Process Spoken Audio if transcript segments are available
        if transcript_data and "segments" in transcript_data:
            segments = transcript_data["segments"]
            
            # Step A: Build Child Chunks
            curr_words: List[str] = []
            curr_start = 0.0
            curr_end = 0.0
            child_idx = 1
            temp_children: List[Dict[str, Any]] = []

            for seg in segments:
                text = seg.get("text", "").strip()
                s_time = float(seg.get("start", 0.0))
                e_time = float(seg.get("end", 0.0))

                if not curr_words:
                    curr_start = s_time
                curr_end = e_time
                curr_words.append(text)

                if len(" ".join(curr_words).split()) >= cls.CHILD_WINDOW_WORDS:
                    c_text = " ".join(curr_words)
                    cid = f"C_{child_idx:03d}"
                    eid = f"E_CHILD_{child_idx:03d}"
                    temp_children.append({
                        "child_id": cid,
                        "evidence_id": eid,
                        "start": curr_start,
                        "end": curr_end,
                        "text": c_text,
                        "word_count": len(c_text.split()),
                        "keywords": cls.tokenize_keywords(c_text)
                    })
                    child_idx += 1
                    curr_words = []

            if curr_words:
                c_text = " ".join(curr_words)
                cid = f"C_{child_idx:03d}"
                eid = f"E_CHILD_{child_idx:03d}"
                temp_children.append({
                    "child_id": cid,
                    "evidence_id": eid,
                    "start": curr_start,
                    "end": curr_end,
                    "text": c_text,
                    "word_count": len(c_text.split()),
                    "keywords": cls.tokenize_keywords(c_text)
                })

            # Step B: Group Children into Parent Windows (~4-5 children per parent)
            parent_idx = 1
            curr_p_children: List[Dict[str, Any]] = []
            curr_p_words = 0

            for tc in temp_children:
                curr_p_children.append(tc)
                curr_p_words += tc["word_count"]

                if curr_p_words >= cls.PARENT_WINDOW_WORDS:
                    p_id = f"P_{parent_idx:02d}"
                    p_eid = f"E_PARENT_{parent_idx:02d}"
                    p_start = curr_p_children[0]["start"]
                    p_end = curr_p_children[-1]["end"]
                    p_text = " ".join([c["text"] for c in curr_p_children])
                    c_ids = [c["evidence_id"] for c in curr_p_children]

                    parent_obj = ParentChunk(
                        parent_id=p_id,
                        evidence_id=p_eid,
                        title=f"Lecture Segment {parent_idx} ({int(p_start//60)}m{int(p_start%60):02d}s - {int(p_end//60)}m{int(p_end%60):02d}s)",
                        source_type="TRANSCRIPT",
                        time_span=TimeSpan(start=p_start, end=p_end),
                        full_text=p_text,
                        word_count=len(p_text.split()),
                        child_ids=c_ids
                    )
                    parents.append(parent_obj)
                    parent_map[p_eid] = parent_obj

                    for c in curr_p_children:
                        c_obj = ChildChunk(
                            child_id=c["child_id"],
                            evidence_id=c["evidence_id"],
                            parent_id=p_eid,
                            source_type="TRANSCRIPT",
                            time_span=TimeSpan(start=c["start"], end=c["end"]),
                            text=c["text"],
                            word_count=c["word_count"],
                            keywords=c["keywords"]
                        )
                        children.append(c_obj)
                        child_map[c["evidence_id"]] = c_obj

                    parent_idx += 1
                    curr_p_children = []
                    curr_p_words = 0

            if curr_p_children:
                p_id = f"P_{parent_idx:02d}"
                p_eid = f"E_PARENT_{parent_idx:02d}"
                p_start = curr_p_children[0]["start"]
                p_end = curr_p_children[-1]["end"]
                p_text = " ".join([c["text"] for c in curr_p_children])
                c_ids = [c["evidence_id"] for c in curr_p_children]

                parent_obj = ParentChunk(
                    parent_id=p_id,
                    evidence_id=p_eid,
                    title=f"Lecture Segment {parent_idx} ({int(p_start//60)}m{int(p_start%60):02d}s - {int(p_end//60)}m{int(p_end%60):02d}s)",
                    source_type="TRANSCRIPT",
                    time_span=TimeSpan(start=p_start, end=p_end),
                    full_text=p_text,
                    word_count=len(p_text.split()),
                    child_ids=c_ids
                )
                parents.append(parent_obj)
                parent_map[p_eid] = parent_obj

                for c in curr_p_children:
                    c_obj = ChildChunk(
                        child_id=c["child_id"],
                        evidence_id=c["evidence_id"],
                        parent_id=p_eid,
                        source_type="TRANSCRIPT",
                        time_span=TimeSpan(start=c["start"], end=c["end"]),
                        text=c["text"],
                        word_count=c["word_count"],
                        keywords=c["keywords"]
                    )
                    children.append(c_obj)
                    child_map[c["evidence_id"]] = c_obj

        # 2. Process Slide / PDF Sections
        slide_text = canonical.supporting_materials_text or (canonical.raw_content if canonical.input_type == "PDF" else "")
        if slide_text and "--- Slide " in slide_text:
            slide_sections = [s.strip() for s in slide_text.split("--- Slide ") if s.strip()]
            for s_idx, sec in enumerate(slide_sections):
                lines = sec.split("\n")
                slide_num = lines[0].split("---")[0].strip() if "---" in lines[0] else str(s_idx + 1)
                sec_text = "\n".join(lines[1:] if "---" in lines[0] else lines).strip()
                
                p_id = f"P_SLIDE_{slide_num}"
                p_eid = f"E_PARENT_SLIDE_{slide_num}"
                c_id = f"C_SLIDE_{slide_num}"
                c_eid = f"E_SLIDE_{slide_num}"

                parent_obj = ParentChunk(
                    parent_id=p_id,
                    evidence_id=p_eid,
                    title=f"Slide {slide_num} Full Context",
                    source_type="SLIDE",
                    full_text=sec_text,
                    word_count=len(sec_text.split()),
                    child_ids=[c_eid]
                )
                child_obj = ChildChunk(
                    child_id=c_id,
                    evidence_id=c_eid,
                    parent_id=p_eid,
                    source_type="SLIDE",
                    text=sec_text[:400],
                    word_count=len(sec_text[:400].split()),
                    keywords=cls.tokenize_keywords(sec_text)
                )

                parents.append(parent_obj)
                children.append(child_obj)
                parent_map[p_eid] = parent_obj
                child_map[c_eid] = child_obj

        return HierarchicalEvidenceStore(
            input_id=canonical.input_id,
            title=canonical.title,
            parents=parents,
            children=children,
            parent_map=parent_map,
            child_map=child_map
        )
