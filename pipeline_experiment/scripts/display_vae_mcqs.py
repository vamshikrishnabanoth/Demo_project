import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('pipeline_experiment/results/intermediate/input_11_ashamam_vae_colab/pipeline_a/03_mcq_suite_a.json', 'r', encoding='utf-8') as f:
    qa = json.load(f)

with open('pipeline_experiment/results/intermediate/input_11_ashamam_vae_colab/pipeline_b/06_mcq_suite_b.json', 'r', encoding='utf-8') as f:
    qb = json.load(f)

with open('pipeline_experiment/results/intermediate/input_11_ashamam_vae_colab/evaluation/07_metrics.json', 'r', encoding='utf-8') as f:
    ev = json.load(f)

print('=== EVALUATION METRICS ===')
print('Summary Q_A:', ev['decision']['composite_score_summary'])
print('Blueprint Q_B:', ev['decision']['composite_score_blueprint'])
print('Summary Grounding:', ev['metrics_summary_pipeline_a']['source_grounding_percentage'], '%')
print('Blueprint Grounding:', ev['metrics_blueprint_pipeline_b']['source_grounding_percentage'], '%')
print('Summary Bloom:', ev['metrics_summary_pipeline_a']['average_bloom_level'])
print('Blueprint Bloom:', ev['metrics_blueprint_pipeline_b']['average_bloom_level'])

print('\n' + '='*85)
print('PIPELINE A: SUMMARY GENERATED QUESTIONS')
print('='*85)
for i, q in enumerate(qa['questions']):
    bloom = q.get('target_bloom_level') or q.get('bloom_level', 'N/A')
    print(f"Q{i+1} [{bloom}] {q['question_text']}")
    print(f"  A: {q.get('option_a') or q.get('options', {}).get('A')}")
    print(f"  B: {q.get('option_b') or q.get('options', {}).get('B')}")
    print(f"  C: {q.get('option_c') or q.get('options', {}).get('C')}")
    print(f"  D: {q.get('option_d') or q.get('options', {}).get('D')}")
    print(f"  -> Correct: {q['correct_option']}")
    print(f"  -> Explanation: {q['explanation']}\n")

print('='*85)
print('PIPELINE B: BLUEPRINT GENERATED QUESTIONS')
print('='*85)
for i, q in enumerate(qb['questions']):
    bloom = q.get('target_bloom_level') or q.get('bloom_level', 'N/A')
    print(f"Q{i+1} [{bloom}] {q['question_text']}")
    print(f"  A: {q.get('option_a') or q.get('options', {}).get('A')}")
    print(f"  B: {q.get('option_b') or q.get('options', {}).get('B')}")
    print(f"  C: {q.get('option_c') or q.get('options', {}).get('C')}")
    print(f"  D: {q.get('option_d') or q.get('options', {}).get('D')}")
    print(f"  -> Correct: {q['correct_option']}")
    print(f"  -> Explanation: {q['explanation']}\n")
