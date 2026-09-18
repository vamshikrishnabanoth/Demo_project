#!/usr/bin/env python3
"""
scripts/validate_dataset_metadata.py

Validation and linting tool for evaluation dataset metadata.
- Validates all metadata.json files against DATASET_SCHEMA.json.
- Verifies physical file existence on disk (audio and supporting files must exist and be > 0 bytes).
- Verifies dataset_id uniqueness across the entire dataset.
- Verifies presence of all required fields.
- Produces a clear pass/fail audit report.
"""

import os
import sys
import json
import glob

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SCHEMA_PATH = os.path.join(BASE_DIR, "DATASET_SCHEMA.json")

def validate_all():
    print("=" * 85)
    print("📋 VALIDATING EVALUATION DATASET METADATA & PHYSICAL ASSETS")
    print("=" * 85)

    if not os.path.exists(SCHEMA_PATH):
        print(f"❌ Schema missing at: {SCHEMA_PATH}")
        sys.exit(1)

    with open(SCHEMA_PATH, "r", encoding="utf-8") as sf:
        schema = json.load(sf)

    required_fields = schema.get("required", [])

    meta_files = glob.glob(os.path.join(BASE_DIR, "*", "*", "metadata.json"))
    if not meta_files:
        print("ℹ️ No metadata.json files found in evaluation_dataset categories.")
        print("Ready for teammate ZIP ingestion.")
        return True

    print(f"Found {len(meta_files)} metadata file(s) across categories.\n")

    seen_ids = set()
    errors = []
    warnings = []
    valid_count = 0

    for m_path in meta_files:
        item_dir = os.path.dirname(m_path)
        item_folder = os.path.basename(item_dir)

        try:
            with open(m_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            errors.append(f"[{item_folder}] Corrupt JSON in metadata.json: {str(e)}")
            continue

        item_errors = []

        # Check required fields
        d_id = data.get("dataset_id")
        if not d_id:
            item_errors.append("Missing required field: dataset_id")
        elif d_id in seen_ids:
            item_errors.append(f"Duplicate dataset_id detected: {d_id}")
        else:
            seen_ids.add(d_id)

        for rf in required_fields:
            if rf not in data:
                item_errors.append(f"Missing required field: {rf}")

        # Check audio file on disk
        audio_f = data.get("audio_file")
        if data.get("modality") in ["VOICE_ONLY", "VOICE_PLUS_MATERIAL"]:
            if not audio_f:
                item_errors.append(f"modality is {data.get('modality')} but audio_file is null or empty")
            else:
                p_audio = os.path.join(item_dir, audio_f)
                if not os.path.exists(p_audio):
                    item_errors.append(f"Referenced audio_file does not exist on disk: {audio_f}")
                elif os.path.getsize(p_audio) == 0:
                    item_errors.append(f"Referenced audio_file is 0 bytes: {audio_f}")

        # Check supporting material files on disk
        supp_files = data.get("supporting_material_files", [])
        if data.get("modality") in ["VOICE_PLUS_MATERIAL", "MATERIAL_ONLY"]:
            if not supp_files:
                warnings.append(f"[{item_folder}] Modality {data.get('modality')} has no supporting_material_files listed")
            for sf in supp_files:
                p_sf = os.path.join(item_dir, sf)
                if not os.path.exists(p_sf):
                    item_errors.append(f"Referenced supporting material file missing on disk: {sf}")
                elif os.path.getsize(p_sf) == 0:
                    item_errors.append(f"Supporting material file is 0 bytes: {sf}")

        if item_errors:
            for ie in item_errors:
                errors.append(f"[{d_id or item_folder}] {ie}")
        else:
            valid_count += 1
            print(f"  ✅ [{d_id}]: {data.get('topic', 'Untitled')} ({data.get('modality')}) — Valid")

    print("\n" + "=" * 85)
    print(f"VALIDATION SUMMARY: {valid_count}/{len(meta_files)} ITEMS VALID")
    if warnings:
        print(f"⚠️ {len(warnings)} WARNING(S):")
        for w in warnings:
            print(f"   - {w}")
    if errors:
        print(f"❌ {len(errors)} ERROR(S) ENCOUNTERED:")
        for e in errors:
            print(f"   - {e}")
        print("=" * 85)
        return False
    else:
        print("🎉 ALL DATASET METADATA AND PHYSICAL ASSETS PASSED VALIDATION!")
        print("=" * 85)
        return True

if __name__ == "__main__":
    success = validate_all()
    sys.exit(0 if success else 1)
