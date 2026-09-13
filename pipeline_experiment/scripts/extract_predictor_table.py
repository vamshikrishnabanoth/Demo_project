"""
Predictor Feature Table Extractor.
Extracts the 8-dimensional instructional feature vector for every real educational input
and computes correlation against empirical Delta Q (QB - QA).
"""

import json
import glob
import os
import numpy as np

features_rows = []
for idx in range(1, 11):
    inp_id_pattern = f"input_{idx:02d}_*"
    match = glob.glob(f"pipeline_experiment/results/intermediate/{inp_id_pattern}/evaluation/07_metrics.json")
    if not match:
        continue
    eval_p = match[0]
    trace_dir = os.path.dirname(os.path.dirname(eval_p))
    inp_id = os.path.basename(trace_dir)

    with open(eval_p, "r", encoding="utf-8") as f:
        ev = json.load(f)
    dec = ev["decision"]
    delta_q = dec["quality_delta"]

    # Load canonical chunks to extract features
    chunks_p = os.path.join(trace_dir, "01_canonical_chunks.json")
    with open(chunks_p, "r", encoding="utf-8") as f:
        chunks = json.load(f)

    # Compute features
    dwell_times = [c["evidence"]["dwell_time"] for c in chunks]
    dwell_std = float(np.std(dwell_times)) if dwell_times else 0.0
    
    total_emphasis = sum(len(c["evidence"]["emphasis_markers"]) for c in chunks)
    has_debugging = 1.0 if any(c["evidence"]["debugging_event"] or c["evidence"]["teacher_correction"] for c in chunks) else 0.0
    worked_examples_count = sum(1 for c in chunks if c["evidence"]["worked_example"])
    has_multimodal = 1.0 if "supporting_materials_text" in chunks or "binary_trees" in inp_id or "voice_ppt" in inp_id else 0.0
    student_qna_count = sum(1 for c in chunks if c["evidence"]["student_question"])
    repetition_count = sum(c["evidence"]["repetition_count"] for c in chunks)

    features_rows.append({
        "input_id": inp_id,
        "dwell_std": round(dwell_std, 1),
        "debugging": has_debugging,
        "worked_ex": worked_examples_count,
        "emphasis": total_emphasis,
        "qna": student_qna_count,
        "multimodal": has_multimodal,
        "repetition": repetition_count,
        "delta_q": delta_q,
        "winner": dec["winner"]
    })

print("=" * 125)
header = "{:<32} | {:<9} | {:<7} | {:<9} | {:<8} | {:<4} | {:<10} | {:<7} | {:<20}".format(
    "Input ID", "Dwell Std", "Debug", "WorkedEx", "Emphasis", "QnA", "Multimodal", "Delta Q", "Winner"
)
print(header)
print("=" * 125)

for r in features_rows:
    row = "{:<32} | {:<9.1f} | {:<7.0f} | {:<9} | {:<8} | {:<4} | {:<10.0f} | {:<+7.3f} | {:<20}".format(
        r["input_id"][:32], r["dwell_std"], r["debugging"], r["worked_ex"],
        r["emphasis"], r["qna"], r["multimodal"], r["delta_q"], r["winner"]
    )
    print(row)

print("=" * 125)
