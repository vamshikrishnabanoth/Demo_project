import os
import sys
import json

base_results = "pipeline_experiment/results/intermediate"

metadata_path = "pipeline_experiment/data/metadata.json"
with open(metadata_path, "r", encoding="utf-8") as f:
    all_meta = json.load(f)

all_data = []

for item in all_meta:
    m_id = item["input_id"]
    metric_file = os.path.join(base_results, m_id, "evaluation", "07_metrics.json")
    if os.path.exists(metric_file):
        with open(metric_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            ma = data["metrics_summary_pipeline_a"]
            mb = data["metrics_blueprint_pipeline_b"]
            mc = data["metrics_unified_pipeline_c"]
            dec3 = data["three_way_decision"]

            all_data.append({
                "input_id": m_id,
                "title": item["title"],
                "input_type": item["input_type"],
                "content_style": item["content_style"],
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
                "ground_c": mc.get("source_grounding_percentage")
            })

print("=" * 135)
print("MASTER 15-DATASET 3-WAY COMPARATIVE BENCHMARK MATRIX")
print("=" * 135)
header = "{:<36} | {:<14} | {:<5} | {:<5} | {:<5} | {:<7} | {:<7} | {:<20} | {:<12}".format(
    "Input ID", "Modality", "Q_A", "Q_B", "Q_C", "d(C-A)", "d(C-B)", "Winner", "Bloom(A/B/C)"
)
print(header)
print("=" * 135)

for r in all_data:
    row = "{:<36} | {:<14} | {:<5.3f} | {:<5.3f} | {:<5.3f} | {:<+7.3f} | {:<+7.3f} | {:<20} | {:<3}/{:<3}/{:<4}".format(
        r["input_id"][:36],
        r["input_type"][:14],
        r["q_a"], r["q_b"], r["q_c"],
        r["delta_c_a"], r["delta_c_b"],
        r["winner"],
        r["bloom_a"], r["bloom_b"], r["bloom_c"]
    )
    print(row)
print("=" * 135)

# Save Master Summary JSON
os.makedirs("pipeline_experiment/results/overall", exist_ok=True)
with open("pipeline_experiment/results/overall/master_three_way_15_inputs.json", "w", encoding="utf-8") as f:
    json.dump(all_data, f, indent=2)
print("Saved master results to pipeline_experiment/results/overall/master_three_way_15_inputs.json")
