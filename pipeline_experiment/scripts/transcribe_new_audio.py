"""
Batch Transcriber for Newly Added Real Lecture Audio Files.
Uses faster-whisper on CPU (int8) with timestamp alignment.
"""

import os
import json
from faster_whisper import WhisperModel

audio_targets = [
    {
        "audio_path": "Audio/voice+ppt/tapadiasir_buyandsellstock_lecture2/Day16DAA-Code explanation of Best time to Buy and sell stock in singe and infinite transactions Mini.mp3",
        "output_json": "pipeline_experiment/data/transcripts/tapadia_buy_and_sell_stock_transcript.json",
        "title": "Tapadia Sir: Best Time to Buy and Sell Stock (Single & Infinite Transactions)"
    },
    {
        "audio_path": "Audio/only voice/WT 19-8-26.m4a",
        "output_json": "pipeline_experiment/data/transcripts/wt_19_8_26_transcript.json",
        "title": "Web Tech Lecture 2: Event Listeners & Event Bubbling"
    },
    {
        "audio_path": "Audio/only voice/WT 20-8-26.m4a",
        "output_json": "pipeline_experiment/data/transcripts/wt_20_8_26_transcript.json",
        "title": "Web Tech Lecture 3: DOM Nodes & Form Validation"
    },
    {
        "audio_path": "Audio/only voice/PP.m4a",
        "output_json": "pipeline_experiment/data/transcripts/pp_lecture_transcript.json",
        "title": "Python Programming / Problem Solving Lecture"
    }
]

os.makedirs("pipeline_experiment/data/transcripts", exist_ok=True)
model = WhisperModel("base", device="cpu", compute_type="int8")

for target in audio_targets:
    audio_file = target["audio_path"]
    out_json = target["output_json"]

    if os.path.exists(out_json):
        print(f"Skipping already transcribed: {out_json}")
        continue

    if not os.path.exists(audio_file):
        print(f"Audio file not found: {audio_file}")
        continue

    print(f"\n=======================================================")
    print(f"Transcribing: {target['title']}")
    print(f"File: {audio_file}")
    print(f"=======================================================", flush=True)

    segments, info = model.transcribe(audio_file, language="en", beam_size=5)

    seg_list = []
    full_text = []
    for s in segments:
        seg_list.append({
            "id": s.id,
            "start": round(s.start, 2),
            "end": round(s.end, 2),
            "text": s.text.strip(),
            "avg_logprob": round(s.avg_logprob, 3),
            "no_speech_prob": round(s.no_speech_prob, 3)
        })
        full_text.append(s.text.strip())

    payload = {
        "audio_file": audio_file,
        "title": target["title"],
        "duration": round(info.duration, 2),
        "total_segments": len(seg_list),
        "segments": seg_list,
        "text": " ".join(full_text)
    }

    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print(f"Done! {len(seg_list)} segments ({info.duration:.1f}s) saved to {out_json}", flush=True)

print("\nAll new audio files successfully transcribed!")
