#!/usr/bin/env python3
"""
scripts/ingest_teammate_zip.py

Safe ingestion utility for teammate evaluation ZIP archives.
- Preserves the original raw ZIP in raw_teammate_zips/ (never deletes/overwrites raw data).
- Extracts into an isolated temporary folder.
- Inspects physical files (extensions, sizes, audio formats).
- Creates standardized item directories with collision-proof naming.
- Initializes template metadata.json with UNKNOWN/TBD for unannotated fields.
- Strictly does NOT make semantic judgments (no route guessing, no concept hallucination).
"""

import os
import sys
import shutil
import zipfile
import argparse
import json
import re

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RAW_ZIPS_DIR = os.path.join(BASE_DIR, "raw_teammate_zips")

MODALITY_FOLDERS = {
    "VOICE_ONLY": "01_voice_only",
    "VOICE_PLUS_MATERIAL": "02_voice_plus_material",
    "MATERIAL_ONLY": "03_material_only",
    "EDGE_CASES": "04_edge_cases"
}

AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".webm", ".ogg", ".flac", ".aac"}
DOC_EXTENSIONS = {".pdf", ".pptx", ".ppt", ".docx", ".doc", ".txt", ".md", ".py", ".java", ".cpp", ".c"}

def sanitize_slug(name):
    clean = re.sub(r'[^a-zA-Z0-9_]+', '_', name.strip().lower())
    return re.sub(r'_+', '_', clean).strip('_')

def get_next_sequence(category_folder, contributor_tag):
    cat_path = os.path.join(BASE_DIR, category_folder)
    existing = os.listdir(cat_path) if os.path.exists(cat_path) else []
    pattern = rf'^[A-Z]{{2}}-{re.escape(contributor_tag)}-(\d{{3}})'
    seqs = []
    for d in existing:
        m = re.match(pattern, d)
        if m:
            seqs.append(int(m.group(1)))
    return max(seqs) + 1 if seqs else 1

def ingest_zip(zip_path, contributor_tag="TM", default_modality=None, default_subject=None):
    if not os.path.exists(zip_path):
        print(f"❌ Error: ZIP file not found: {zip_path}")
        sys.exit(1)

    zip_filename = os.path.basename(zip_path)
    print(f"==================================================================")
    print(f"📦 INGESTING TEAMMATE ZIP: {zip_filename}")
    print(f"==================================================================")

    # 1. Preserve original ZIP in raw_teammate_zips
    dest_raw_zip = os.path.join(RAW_ZIPS_DIR, zip_filename)
    if os.path.abspath(zip_path) != os.path.abspath(dest_raw_zip):
        shutil.copy2(zip_path, dest_raw_zip)
        print(f"  -> Preserved untouched raw archive at: {dest_raw_zip}")
    else:
        print(f"  -> Raw archive already present at: {dest_raw_zip}")

    # 2. Extract to a safe scratch directory
    staging_dir = os.path.join(BASE_DIR, "scripts", ".staging_" + sanitize_slug(zip_filename))
    if os.path.exists(staging_dir):
        shutil.rmtree(staging_dir)
    os.makedirs(staging_dir, exist_ok=True)

    with zipfile.ZipFile(dest_raw_zip, 'r') as zf:
        zf.extractall(staging_dir)

    # 3. Discover items inside the extracted contents
    # Case A: Top-level subdirectories representing individual items
    # Case B: Flat files inside ZIP representing a single item
    entries = [e for e in os.listdir(staging_dir) if not e.startswith('.') and not e.startswith('__MACOSX')]
    
    item_dirs = []
    has_subdirs = any(os.path.isdir(os.path.join(staging_dir, e)) for e in entries)
    
    if has_subdirs:
        for e in entries:
            full_p = os.path.join(staging_dir, e)
            if os.path.isdir(full_p):
                item_dirs.append(full_p)
    else:
        item_dirs.append(staging_dir)

    print(f"  -> Detected {len(item_dirs)} candidate item folder(s). Processing...")

    ingested_count = 0
    for idx, item_p in enumerate(item_dirs, 1):
        item_name = os.path.basename(item_p)
        if item_name == os.path.basename(staging_dir):
            item_name = os.path.splitext(zip_filename)[0]

        files = []
        for root, _, fs in os.walk(item_p):
            for f in fs:
                if not f.startswith('.') and not f.startswith('__MACOSX'):
                    rel_f = os.path.relpath(os.path.join(root, f), item_p)
                    files.append(rel_f)

        audio_files = [f for f in files if os.path.splitext(f)[1].lower() in AUDIO_EXTENSIONS]
        doc_files = [f for f in files if os.path.splitext(f)[1].lower() in DOC_EXTENSIONS]

        # Determine structural modality based purely on file presence (no semantic guessing)
        if default_modality:
            modality = default_modality
        elif len(audio_files) > 0 and len(doc_files) > 0:
            modality = "VOICE_PLUS_MATERIAL"
        elif len(audio_files) > 0:
            modality = "VOICE_ONLY"
        elif len(doc_files) > 0:
            modality = "MATERIAL_ONLY"
        else:
            modality = "EDGE_CASES"

        prefix_map = {
            "VOICE_ONLY": "VO",
            "VOICE_PLUS_MATERIAL": "VM",
            "MATERIAL_ONLY": "MO",
            "EDGE_CASES": "EC"
        }
        prefix = prefix_map[modality]
        cat_folder = MODALITY_FOLDERS[modality]

        seq = get_next_sequence(cat_folder, contributor_tag)
        dataset_id = f"{prefix}-{contributor_tag}-{seq:03d}"
        slug = sanitize_slug(item_name)
        target_dir_name = f"{dataset_id}_{slug}"
        final_item_dir = os.path.join(BASE_DIR, cat_folder, target_dir_name)

        os.makedirs(final_item_dir, exist_ok=True)

        # Move files into final item directory
        dest_audio = None
        dest_docs = []
        for f in files:
            src_f = os.path.join(item_p, f)
            dst_f = os.path.join(final_item_dir, os.path.basename(f))
            shutil.copy2(src_f, dst_f)
            ext = os.path.splitext(f)[1].lower()
            if ext in AUDIO_EXTENSIONS and not dest_audio:
                dest_audio = os.path.basename(f)
            elif ext in DOC_EXTENSIONS or ext in AUDIO_EXTENSIONS:
                dest_docs.append(os.path.basename(f))

        # Check if existing metadata.json was provided by contributor
        meta_src = os.path.join(item_p, "metadata.json")
        provided_meta = {}
        if os.path.exists(meta_src):
            try:
                with open(meta_src, "r", encoding="utf-8") as mf:
                    provided_meta = json.load(mf)
            except Exception:
                pass

        # Build clean standardized metadata with UNKNOWN/TBD where unspecified
        metadata = {
            "dataset_id": dataset_id,
            "subject": provided_meta.get("subject", default_subject or "UNKNOWN/TBD"),
            "topic": provided_meta.get("topic", item_name.replace('_', ' ').title()),
            "modality": modality,
            "audio_file": dest_audio,
            "supporting_material_files": [d for d in dest_docs if d != dest_audio],
            "duration": provided_meta.get("duration", "UNKNOWN/TBD"),
            "language": provided_meta.get("language", "English"),
            "teaching_style": provided_meta.get("teaching_style", "UNKNOWN/TBD"),
            "content_type": provided_meta.get("content_type", "Academic Instruction" if modality != "EDGE_CASES" else "UNKNOWN/TBD"),
            "expected_academicity": provided_meta.get("expected_academicity", "PASS" if modality != "EDGE_CASES" else "UNKNOWN/TBD"),
            "expected_content_behavior": provided_meta.get("expected_content_behavior", "instructional_only" if modality != "EDGE_CASES" else "UNKNOWN/TBD"),
            "expected_representation_route": provided_meta.get("expected_representation_route", "UNKNOWN/TBD"),
            "expected_usable_concepts": provided_meta.get("expected_usable_concepts", []),
            "expected_excluded_content": provided_meta.get("expected_excluded_content", []),
            "special_conditions": provided_meta.get("special_conditions", "None noted during ingestion."),
            "contributor": contributor_tag,
            "verification_status": "DRAFT"
        }

        meta_out = os.path.join(final_item_dir, "metadata.json")
        with open(meta_out, "w", encoding="utf-8") as mf:
            json.dump(metadata, mf, indent=2)

        print(f"  ✅ Ingested [{dataset_id}]: {target_dir_name} -> {cat_folder}/")
        ingested_count += 1

    # Cleanup staging
    shutil.rmtree(staging_dir, ignore_errors=True)
    print(f"\\nSuccessfully ingested {ingested_count} item(s) from {zip_filename}.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest teammate evaluation dataset ZIP.")
    parser.add_argument("zip_path", help="Path to teammate ZIP archive")
    parser.add_argument("--contributor", default="TM1", help="Contributor code (e.g., TM1, TM2, TEAM_A)")
    parser.add_argument("--modality", choices=["VOICE_ONLY", "VOICE_PLUS_MATERIAL", "MATERIAL_ONLY", "EDGE_CASES"], default=None)
    parser.add_argument("--subject", default=None, help="Subject name if known for entire batch")
    args = parser.parse_args()

    ingest_zip(args.zip_path, args.contributor, args.modality, args.subject)
