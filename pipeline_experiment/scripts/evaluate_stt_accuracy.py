import json
import os
import jiwer

# Load ground truths
gt_deepa = 'dataset/ground_truth/deepa_madam_clip1.json'
gt_tapadia = 'dataset/ground_truth/tapadia_sir_clip1.json'

with open(gt_deepa, 'r', encoding='utf-8') as f:
    d_gt = json.load(f)
with open(gt_tapadia, 'r', encoding='utf-8') as f:
    t_gt = json.load(f)

with open('pipeline_experiment/data/transcripts/deepa_madam_transcript.json', 'r', encoding='utf-8') as f:
    d_tx = json.load(f)
with open('pipeline_experiment/data/transcripts/tapadia_sir_transcript.json', 'r', encoding='utf-8') as f:
    t_tx = json.load(f)

# Extract first 60s of transcript
d_first_60 = ' '.join([s['text'] for s in d_tx['segments'] if s['end'] <= 65.0])
t_first_60 = ' '.join([s['text'] for s in t_tx['segments'] if s['end'] <= 65.0])

wer_d = jiwer.wer(d_gt['text'], d_first_60)
cer_d = jiwer.cer(d_gt['text'], d_first_60)

wer_t = jiwer.wer(t_gt['text'], t_first_60)
cer_t = jiwer.cer(t_gt['text'], t_first_60)

print("="*80)
print(f"DEEPA MADAM CLIP 1 EVALUATION (WER: {wer_d:.3f}, CER: {cer_d:.3f})")
print("Ground Truth:", d_gt['text'])
print("Whisper Output:", d_first_60)
print("="*80)
print(f"TAPADIA SIR CLIP 1 EVALUATION (WER: {wer_t:.3f}, CER: {cer_t:.3f})")
print("Ground Truth:", t_gt['text'])
print("Whisper Output:", t_first_60)
print("="*80)
