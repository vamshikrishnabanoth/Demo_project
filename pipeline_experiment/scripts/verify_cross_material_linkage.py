"""
Cross-Material Linkage Verification (Voice + PPT Multi-Modal Pipeline)
Tests and audits cross-modal alignment between spoken audio transcript and PDF slides
on Ashamam_VAE (Variational Autoencoders on Fashion-MNIST).
"""

import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json
import pypdf
from typing import Dict, Any

from production_engine.ingestion.content_processor import ProductionContentProcessor
from production_engine.retrieval.evidence_retriever import ProductionEvidenceRetriever
from production_engine.schemas import AssessmentTarget


def extract_pdf_slides(pdf_path: str) -> str:
    reader = pypdf.PdfReader(pdf_path)
    slides = []
    for idx, page in enumerate(reader.pages):
        text = page.extract_text()
        if text:
            slides.append(f"--- Slide {idx+1} ---\n{text.strip()}")
    return "\n\n".join(slides)


def audit_cross_material_linkage():
    print("="*70)
    print("CROSS-MATERIAL LINKAGE AUDIT: AUDIO TRANSCRIPT <-> SLIDE ALIGNMENT")
    print("="*70)

    audio_json = "pipeline_experiment/data/transcripts/ashamam_vae_transcript.json"
    slide_pdf = "Audio/voice+ppt/Ashamam_VAE/CSE-AI-MODULE2-EX3_VAE_FASHIONMNIST.pdf"

    if not os.path.exists(audio_json) or not os.path.exists(slide_pdf):
        print("Missing test files!")
        return

    with open(audio_json, "r", encoding="utf-8") as f:
        transcript_data = json.load(f)

    slide_text = extract_pdf_slides(slide_pdf)
    dur = transcript_data.get("duration") or transcript_data.get("duration_seconds", 0.0)
    print(f"1. Slide Ingestion: Extracted {slide_text.count('--- Slide ')} slide sections from PDF.")
    print(f"2. Audio Ingestion: Loaded {len(transcript_data['segments'])} audio segments ({dur:.1f}s).")

    # Ingest into Canonical Input
    canonical = ProductionContentProcessor.process_raw_input(
        input_id="input_vae_cross_linkage_audit",
        title="Variational Autoencoders: Multimodal Audio + Slide Linkage Audit",
        input_type="VOICE_PLUS_PPT",
        content_style="PROBLEM_SOLVING",
        transcript_data=transcript_data,
        supporting_text=slide_text
    )

    audio_chunks = [c for c in canonical.chunks if c.source_type == "TRANSCRIPT"]
    slide_chunks = [c for c in canonical.chunks if c.source_type == "SLIDE"]

    print(f"3. Canonical Chunking: Created {len(audio_chunks)} audio chunks and {len(slide_chunks)} slide chunks.")
    print(f"   - Audio Chunks: {[c.evidence.evidence_id for c in audio_chunks[:3]]} ...")
    print(f"   - Slide Chunks: {[c.evidence.evidence_id for c in slide_chunks]}")

    # Test RAG Retrieval across both modalities
    sample_target = AssessmentTarget(
        target_id="T_VAE_REPARAM_TRICK",
        concept_name="Reparameterization Trick & Latent Sampling",
        what_taught="z = mu + sigma * epsilon where epsilon ~ N(0, 1) allows backpropagation through random sampling node",
        why_assessed="Teacher emphasized the backpropagation blockage on slides and explained why deterministic path is required",
        cognitive_level="APPLY",
        difficulty_level="HARD"
    )

    retrieved = ProductionEvidenceRetriever.retrieve_for_plan(
        canonical=canonical,
        targets=[sample_target]
    )

    ev = retrieved.get(sample_target.target_id)
    print("\n4. Cross-Modal Evidence Retrieval Results for Target 'Reparameterization Trick':")
    print(f"   - Cited Evidence IDs: {ev.evidence_ids}")
    
    has_audio_link = any(eid.startswith("E_C") for eid in ev.evidence_ids)
    has_slide_link = any(eid.startswith("E_SLIDE") for eid in ev.evidence_ids)
    
    print(f"   - Linked Spoken Audio Evidence: {'YES (' + ', '.join([e for e in ev.evidence_ids if e.startswith('E_C')]) + ')' if has_audio_link else 'NO'}")
    print(f"   - Linked Slide Visual Evidence: {'YES (' + ', '.join([e for e in ev.evidence_ids if e.startswith('E_SLIDE')]) + ')' if has_slide_link else 'NO'}")
    print(f"   - Cross-Material Linkage Status: {'SUCCESSFUL (BI-DIRECTIONAL LINK ESTABLISHED)' if (has_audio_link and has_slide_link) else 'PARTIAL'}")
    print("\nSample Retrieved Multi-Modal Snippet:")
    print("-" * 50)
    print(ev.retrieved_content[:400] + "...")
    print("-" * 50)


if __name__ == "__main__":
    audit_cross_material_linkage()
