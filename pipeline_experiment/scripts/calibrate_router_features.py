"""
Calibrate upfront router features on the 15 Development Datasets.
Prints the extracted features and actual winners (Summary vs Blueprint)
to establish transparent, frozen weights before any validation run.
"""

import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json

from pipeline_experiment.router.feature_extractor import UpfrontFeatureExtractor
from pipeline_experiment.scripts.run_single import load_canonical_input


metadata_path = "pipeline_experiment/data/metadata.json"
with open(metadata_path, "r", encoding="utf-8") as f:
    dev_inputs = json.load(f)

print("=" * 135)
print("FEATURE EXTRACTION & CALIBRATION ON 15 DEVELOPMENT DATASETS")
print("=" * 135)
header = "{:<32} | {:<5} | {:<5} | {:<7} | {:<6} | {:<8} | {:<9} | {:<10}".format(
    "Input ID", "Audio", "PPT", "CodeDen", "Words", "PedMarker", "DialogDen", "Winner (A/B)"
)
print(header)
print("=" * 135)

calib_records = []

for item in dev_inputs:
    canonical = load_canonical_input(item)
    feats = UpfrontFeatureExtractor.extract(canonical)

    # Load actual A/B winner from intermediate results
    metric_file = os.path.join("pipeline_experiment/results/intermediate", item["input_id"], "evaluation", "07_metrics.json")
    winner_ab = "UNKNOWN"
    q_a, q_b = 0.0, 0.0
    if os.path.exists(metric_file):
        with open(metric_file, "r", encoding="utf-8") as f:
            eval_data = json.load(f)
            q_a = eval_data["three_way_decision"]["q_summary_a"]
            q_b = eval_data["three_way_decision"]["q_blueprint_b"]
            winner_ab = "A (Summary)" if q_a >= q_b else "B (Blueprint)"

    calib_records.append({
        "feats": feats,
        "q_a": q_a,
        "q_b": q_b,
        "winner_ab": winner_ab
    })

    print("{:<32} | {:<5} | {:<5} | {:<7.3f} | {:<6} | {:<8.2f} | {:<9.2f} | {:<10}".format(
        feats.input_id[:32],
        str(feats.has_audio),
        str(feats.has_ppt),
        feats.code_density,
        feats.text_length_words,
        feats.pedagogical_marker_density,
        feats.dialogue_interaction_density,
        winner_ab
    ))

print("=" * 135)
