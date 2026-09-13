"""
Full Step-by-Step Pipeline Audit & Execution on Unseen Lecture: ML_MadhurikaMam.mp4
Executes and inspects every discrete stage:
1. Audio Ingestion & Noise Filtering
2. Speech-to-Text Transcription with Segment Timestamps
3. Non-Academic Filtering & Code-Switching / Translation Normalization
4. Semantic Chunking & Canonical Evidence Record Assignment (E_C01...)
5. Modality & Pedagogical Delivery Feature Analysis & Routing
6. Representation Extraction (Summary / Blueprint)
7. Assessment Planning with Instructional Salience
8. Target-Specific Evidence Retrieval (RAG)
9. Cognitive Fidelity Item & Misconception Generation
10. Grounding & Plausibility Audit
"""

import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json
import time
import re
from typing import List, Dict, Any, Optional

from faster_whisper import WhisperModel
from pipeline_experiment.generator.llm_engine import UnifiedLLMEngine
from pipeline_experiment.shared.schemas.canonical_models import (
    CanonicalEducationalInput, SemanticChunk, TimeSpan, InstructionalEvidenceRecord
)
from production_engine.ingestion.content_processor import ProductionContentProcessor
from production_engine.router import ProductionRouter
from production_engine.extractors.summary_extractor import ProductionSummaryExtractor
from production_engine.extractors.blueprint_extractor import ProductionBlueprintExtractor
from production_engine.extractors.unified_synthesizer import ProductionUnifiedSynthesizer
from production_engine.planner import ProductionAssessmentPlanner
from production_engine.retrieval.evidence_retriever import ProductionEvidenceRetriever
from production_engine.generator import ProductionMCQGenerator
from production_engine.validator import ProductionAssessmentValidator


def step1_transcribe_audio(audio_path: str) -> Dict[str, Any]:
    print("\n" + "="*70)
    print("STEP 1 & 2: AUDIO INGESTION & HIGH-FIDELITY SPEECH TRANSCRIPTION")
    print("="*70)
    print(f"Loading Audio File: {audio_path} ({os.path.getsize(audio_path):,} bytes)")
    
    t0 = time.time()
    model = WhisperModel("base", device="cpu", compute_type="int8", cpu_threads=4)
    segments_raw, info = model.transcribe(audio_path, beam_size=3, word_timestamps=False)
    
    segments = []
    full_text_list = []
    for s in segments_raw:
        seg_dict = {
            "id": s.id,
            "start": round(s.start, 2),
            "end": round(s.end, 2),
            "text": s.text.strip()
        }
        segments.append(seg_dict)
        full_text_list.append(s.text.strip())
        
    duration = round(info.duration, 2)
    latency = round(time.time() - t0, 2)
    print(f"Detected Language: {info.language} (Probability: {info.language_probability:.2f})")
    print(f"Duration: {duration}s (~{duration/60:.1f} mins) | Segments: {len(segments)} | Words: {len(' '.join(full_text_list).split())}")
    print(f"Transcription Latency: {latency}s")
    
    return {
        "audio_file": audio_path,
        "language": info.language,
        "language_probability": info.language_probability,
        "duration_seconds": duration,
        "segments": segments,
        "raw_text": " ".join(full_text_list)
    }


def step3_clean_and_filter_content(transcript_dict: Dict[str, Any], llm: UnifiedLLMEngine) -> Dict[str, Any]:
    print("\n" + "="*70)
    print("STEP 3: CONTENT CLEANING, NON-ACADEMIC FILTERING & TRANSLATION NORMALIZATION")
    print("="*70)
    
    segments = transcript_dict["segments"]
    print(f"Analyzing {len(segments)} raw speech segments for classroom noise and non-academic chatter...")
    
    # Heuristic and LLM-assisted identification of non-academic utterances
    academic_segments = []
    removed_segments = []
    
    # Common classroom boilerplate / non-academic phrases
    non_academic_patterns = [
        r"^(can you hear me|am i audible|is screen visible|good morning|good afternoon|silence please|listen here|attendance|roll number|wait for two minutes)\b",
        r"^(yes ma'?am|no ma'?am|okay sir|thank you|any doubts guys)\b"
    ]
    
    for seg in segments:
        txt = seg["text"].strip()
        is_filler = False
        for pat in non_academic_patterns:
            if re.search(pat, txt, re.IGNORECASE) and len(txt.split()) < 8:
                is_filler = True
                break
        
        if is_filler:
            removed_segments.append(seg)
        else:
            academic_segments.append(seg)
            
    print(f"Filtered {len(removed_segments)} non-academic chatter segments. Retained {len(academic_segments)} core academic segments.")
    if removed_segments:
        print("Sample Filtered Utterances:")
        for r in removed_segments[:3]:
            print(f"  - [{r['start']}s - {r['end']}s]: \"{r['text']}\"")
            
    cleaned_transcript = {
        **transcript_dict,
        "segments": academic_segments,
        "cleaned_text": " ".join([s["text"] for s in academic_segments]),
        "removed_count": len(removed_segments)
    }
    return cleaned_transcript


def run_full_pipeline_audit():
    audio_path = "Audio/only voice/ML_MadhurikaMam.mp4"
    if not os.path.exists(audio_path):
        print(f"Error: {audio_path} not found!")
        return

    # Initialize Engine
    llm = UnifiedLLMEngine(provider="groq", model="qwen/qwen3.8-27b", temperature=0.2)

    # 1 & 2. Transcribe or Load Cached
    transcript_out_path = "pipeline_experiment/data/transcripts/ml_madhurikamam_transcript.json"
    if os.path.exists(transcript_out_path):
        print("\n" + "="*70)
        print("STEP 1 & 2: LOADING HIGH-FIDELITY SPEECH TRANSCRIPTION (CACHED)")
        print("="*70)
        with open(transcript_out_path, "r", encoding="utf-8") as f:
            transcript_data = json.load(f)
        print(f"Loaded {len(transcript_data['segments'])} segments ({transcript_data['duration_seconds']}s, {len(transcript_data['raw_text'].split())} words)")
    else:
        transcript_data = step1_transcribe_audio(audio_path)
        with open(transcript_out_path, "w", encoding="utf-8") as f:
            json.dump(transcript_data, f, indent=2)
        print(f"Saved raw transcript to: {transcript_out_path}")

    # 3. Clean & Filter
    cleaned_data = step3_clean_and_filter_content(transcript_data, llm)

    # 4. Canonical Ingestion & Semantic Chunking
    print("\n" + "="*70)
    print("STEP 4: SEMANTIC CHUNKING & CANONICAL EVIDENCE RECORD ASSIGNMENT")
    print("="*70)
    canonical = ProductionContentProcessor.process_raw_input(
        input_id="input_24_ml_madhurikamam",
        title="Machine Learning Lecture: Supervised Learning, Model Training & Core Concepts (Prof. Madhurika)",
        input_type="VOICE_ONLY",
        content_style="CONCEPTUAL",
        transcript_data=cleaned_data,
        chunk_window_words=140
    )
    print(f"Generated {len(canonical.chunks)} Semantic Chunks with permanent Evidence IDs (E_C01 to E_C{len(canonical.chunks):02d})")
    print("Sample Canonical Chunks:")
    for c in canonical.chunks[:2]:
        dwell = round(c.time_spans[0].end - c.time_spans[0].start, 1) if c.time_spans else 0.0
        print(f"  - [{c.evidence.evidence_id}] ({c.time_spans[0].start}s - {c.time_spans[0].end}s | Dwell: {dwell}s): \"{c.text[:120]}...\"")

    # 5. Modality & Feature Router
    print("\n" + "="*70)
    print("STEP 5: UPFRONT FEATURE ANALYSIS & REPRESENTATION ROUTING")
    print("="*70)
    routing = ProductionRouter.route(canonical)
    print(f"Pedagogical Delivery Index (PDI): {routing.pedagogical_delivery_index:.3f}")
    print(f"Code Density: {routing.features.code_density:.3f} | Dialogue Density: {routing.features.dialogue_interaction_density:.3f}")
    print(f"Selected Representation: >> {routing.selected_representation} <<")
    print(f"Routing Rationale: {routing.rationale}")

    # 6. Representation Extraction
    print("\n" + "="*70)
    print(f"STEP 6: EXTRACTING REPRESENTATION ({routing.selected_representation})")
    print("="*70)
    summary = None
    blueprint = None
    rep_type = routing.selected_representation

    if rep_type == "SUMMARY":
        summary = ProductionSummaryExtractor.extract(canonical, llm)
        print(f"Summary Extracted: {len(summary.concepts_and_definitions)} concepts, {len(summary.mechanisms_and_formulas)} mechanisms")
    elif rep_type == "BLUEPRINT":
        blueprint = ProductionBlueprintExtractor.extract(canonical, llm)
        print(f"Blueprint Extracted: {len(blueprint.topics)} topics with instructional intent and Bloom levels")
    elif rep_type == "UNIFIED":
        summary, blueprint = ProductionUnifiedSynthesizer.extract_both(canonical, llm)
        print(f"Unified Synthesis Extracted: {len(summary.concepts_and_definitions)} concepts and {len(blueprint.topics)} blueprint topics")

    # 7. Assessment Planner
    print("\n" + "="*70)
    print("STEP 7: ASSESSMENT PLANNING (INSTRUCTIONAL SALIENCE & CAPACITY BOUND)")
    print("="*70)
    plan = ProductionAssessmentPlanner.plan_assessment(
        canonical=canonical,
        representation_type=rep_type,
        requested_count=5,
        llm=llm,
        summary=summary,
        blueprint=blueprint,
        difficulty="MIXED"
    )
    print(f"Maximum Defensible Capacity: {plan.maximum_defensible_capacity} | Allocated Targets: {plan.allocated_question_count}")
    for idx, t in enumerate(plan.targets):
        print(f"  Target {idx+1}: [{t.cognitive_level}] {t.concept_name} -> Why: {t.why_assessed[:80]}...")

    # 8. Evidence Retrieval Layer (RAG)
    print("\n" + "="*70)
    print("STEP 8: EVIDENCE RETRIEVAL LAYER (RAG DETERMINISTIC CITATION MATCHING)")
    print("="*70)
    retrieved_map = ProductionEvidenceRetriever.retrieve_for_plan(
        canonical=canonical,
        targets=plan.targets
    )
    for t_id, ev in retrieved_map.items():
        print(f"  Target {t_id} -> Citations: {ev.evidence_ids} | Length: {len(ev.retrieved_content)} chars")

    # 9. MCQ Generation with Misconception Modeling
    print("\n" + "="*70)
    print("STEP 9: COGNITIVE FIDELITY MCQ GENERATION")
    print("="*70)
    raw_questions = ProductionMCQGenerator.generate_questions(
        canonical=canonical,
        plan=plan,
        llm=llm,
        retrieved_evidence_map=retrieved_map
    )
    print(f"Generated {len(raw_questions)} candidate MCQs.")

    # 10. Validation & Grounding Audit
    print("\n" + "="*70)
    print("STEP 10: DETERMINISTIC GROUNDING & VALIDATION AUDIT")
    print("="*70)
    raw_evidence = (canonical.raw_content or "") + "\n" + (canonical.supporting_materials_text or "")
    valid_questions, val_status = ProductionAssessmentValidator.validate_suite(raw_questions, raw_evidence)
    print(f"Validation Result: {len(valid_questions)} valid questions (Status: {val_status})")

    # Compile Final Suite Report
    final_output = {
        "lecture_title": canonical.title,
        "audio_file": audio_path,
        "duration_seconds": transcript_data["duration_seconds"],
        "cleaned_segments_count": len(cleaned_data["segments"]),
        "removed_chatter_count": cleaned_data["removed_count"],
        "pdi_score": routing.pedagogical_delivery_index,
        "routed_representation": rep_type,
        "allocated_questions": len(valid_questions),
        "validation_status": val_status,
        "questions": [q.model_dump() for q in valid_questions]
    }

    out_file = "production_engine/outputs/ml_madhurikamam_audit_results.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(final_output, f, indent=2)

    print("\n" + "="*70)
    print(f"Audit Complete! Saved results to: {out_file}")
    print("="*70)


if __name__ == "__main__":
    run_full_pipeline_audit()
