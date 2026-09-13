import glob
import json
import os

intermediate = glob.glob('pipeline_experiment/results/intermediate/*/evaluation/07_metrics.json')

results = []
for p in sorted(intermediate):
    norm_p = p.replace('\\', '/')
    parts = norm_p.split('/')
    inp_id = parts[-3]
    with open(p, 'r', encoding='utf-8') as f:
        d = json.load(f)
    ma = d['metrics_summary_pipeline_a']
    mb = d['metrics_blueprint_pipeline_b']
    dec = d['decision']
    results.append({
        'id': inp_id,
        'QA': dec['composite_score_summary'],
        'QB': dec['composite_score_blueprint'],
        'delta': dec['quality_delta'],
        'winner': dec['winner'],
        'bloom_a': ma.get('average_bloom_level'),
        'bloom_b': mb.get('average_bloom_level'),
        'ground_a': ma.get('source_grounding_percentage'),
        'ground_b': mb.get('source_grounding_percentage'),
        'spec_a': ma.get('specificity_score'),
        'spec_b': mb.get('specificity_score'),
        'gen_a': ma.get('genericness_index'),
        'gen_b': mb.get('genericness_index')
    })

print('=' * 125)
header = "{:<35} | {:<6} | {:<6} | {:<7} | {:<25} | {:<10} | {:<15} | {:<10}".format(
    "Input ID", "Q_A", "Q_B", "Delta", "Winner", "Bloom A/B", "Grounding A/B", "Spec A/B"
)
print(header)
print('=' * 125)

for r in results:
    row = "{:<35} | {:<6.3f} | {:<6.3f} | {:<+7.3f} | {:<25} | {:<4}/{:<5} | {:<5}% / {:<5}% | {:<4}/{:<4}".format(
        r['id'], r['QA'], r['QB'], r['delta'], r['winner'],
        r['bloom_a'], r['bloom_b'],
        r['ground_a'], r['ground_b'],
        r['spec_a'], r['spec_b']
    )
    print(row)

print('=' * 125)
