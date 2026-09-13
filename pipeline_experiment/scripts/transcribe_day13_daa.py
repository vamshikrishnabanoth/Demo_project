"""
Transcribe Day13-DAA-Median of two sorted array's using binary search.mp3
"""

import os
import json
import time
from faster_whisper import WhisperModel

audio_path = "Audio/only voice/Day13-DAA-Median of two sorted array's using binary search.mp3"
out_json = "pipeline_experiment/data/transcripts/day13_daa_median_transcript.json"

os.makedirs("pipeline_experiment/data/transcripts", exist_ok=True)

if os.path.exists(out_json):
    print(f"Already transcribed: {out_json}")
else:
    print(f"Loading faster-whisper model...")
    model = WhisperModel("base", device="cpu", compute_type="int8")

    print(f"Starting transcription of: {audio_path} ...")
    start_t = time.time()
    segments, info = model.transcribe(audio_path, beam_size=1)

    seg_list = []
    text_chunks = []
    for s in segments:
        seg_list.append({
            "id": s.id,
            "start": round(s.start, 2),
            "end": round(s.end, 2),
            "text": s.text.strip()
        })
        text_chunks.append(s.text.strip())

    dur = time.time() - start_t
    full_text = " ".join(text_chunks)

    data = {
        "audio_file": audio_path,
        "language": info.language,
        "duration_seconds": round(info.duration, 2),
        "transcription_time_seconds": round(dur, 2),
        "total_segments": len(seg_list),
        "text": full_text,
        "segments": seg_list
    }

    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print(f"Transcription complete in {dur:.1f}s. Saved to: {out_json}")
    print(f"Duration: {info.duration:.1f}s | Total Segments: {len(seg_list)} | Total Words: {len(full_text.split())}")
