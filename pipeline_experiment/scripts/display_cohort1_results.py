import os
import sys
import json

base_results = "pipeline_experiment/results/intermediate"
material_ids = [
    "input_01_daa_unit2",
    "input_02_cnn_object_detection",
    "input_03_ds_lab_programs",
    "input_04_se_lab_git_github",
    "input_05_assignment_mongodb_crud",
    "input_06_mongodb_commands_reference"
]

cohort1_data = []

for m_id in material_ids:
    metric_file = os.path.join(base_results, m_id, "evaluation", "07_metrics.json")
    if os.path.exists(metric_file):
        with open(metric_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            ma = data["metrics_summary_pipeline_a"]
            mb = data["metrics_blueprint_pipeline_b"]
            mc = data["metrics_unified_pipeline_c"]
            dec3 = data["three_way_decision"]

            cohort1_data.append({
                "input_id": m_id,
                "q_a": dec3["q_summary_a"],
                "q_b": dec3["q_blueprint_b"],
                "q_c": dec3["q_unified_c"],
                "delta_c_a": dec3["delta_c_minus_a"],
                "delta_c_b": dec3["delta_c_minus_b"],
                "winner": dec3["winner"],
                "bloom_a": ma.get("average_bloom_level"),
                "bloom_b": mb.get("average_bloom_level"),
                "bloom_c": mc.get("average_bloom_level"),
                "ground_a": ma.get("source_grounding_percentage"),
                "ground_b": mb.get("source_grounding_percentage"),
                "ground_c": mc.get("source_grounding_percentage"),
                "spec_a": ma.get("specificity_score"),
                "spec_b": mb.get("specificity_score"),
                "spec_c": mc.get("specificity_score")
            })

print("=" * 130)
print("COHORT 1: ONLY MATERIAL (STATIC DOCUMENTS) - 3-WAY COMPARATIVE RESULTS")
print("=" * 130)
header = "{:<36} | {:<5} | {:<5} | {:<5} | {:<7} | {:<7} | {:<20} | {:<12} | {:<18}".format(
    "Input ID", "Q_A", "Q_B", "Q_C", "d(C-A)", "d(C-B)", "Winner", "Bloom (A/B/C)", "Grounding (A/B/C)"
)
print(header)
print("=" * 130)

for r in cohort1_data:
    row = "{:<36} | {:<5.3f} | {:<5.3f} | {:<5.3f} | {:<+7.3f} | {:<+7.3f} | {:<20} | {:<3}/{:<3}/{:<4} | {:<4}%/{:<4}%/{:<4}%".format(
        r["input_id"][:36],
        r["q_a"], r["q_b"], r["q_c"],
        r["delta_c_a"], r["delta_c_b"],
        r["winner"],
        r["bloom_a"], r["bloom_b"], r["bloom_c"],
        r["ground_a"], r["ground_b"], r["ground_c"]
    )
    print(row)
print("=" * 130)
