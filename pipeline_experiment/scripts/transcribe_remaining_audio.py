"""
Transcribe remaining voice-only audio files from the screenshot:
- New (1).m4a
- New (2).m4a
- New recording 37 (1).m4a
- New.m4a
- Pps jocks.m4a
- Voice.m4a
"""

import os
import json
from faster_whisper import WhisperModel

audio_targets = [
    {
        "audio_path": "Audio/only voice/New (1).m4a",
        "output_json": "pipeline_experiment/data/transcripts/new_1_transcript.json",
        "title": "Classroom Lecture: Audio Recording New (1)"
    },
    {
        "audio_path": "Audio/only voice/New (2).m4a",
        "output_json": "pipeline_experiment/data/transcripts/new_2_transcript.json",
        "title": "Classroom Lecture: Audio Recording New (2)"
    },
    {
        "audio_path": "Audio/only voice/New recording 37 (1).m4a",
        "output_json": "pipeline_experiment/data/transcripts/new_recording_37_1_transcript.json",
        "title": "Classroom Lecture: Audio Recording 37"
    },
    {
        "audio_path": "Audio/only voice/New.m4a",
        "output_json": "pipeline_experiment/data/transcripts/new_transcript.json",
        "title": "Classroom Lecture: Audio Recording New"
    },
    {
        "audio_path": "Audio/only voice/Pps jocks.m4a",
        "output_json": "pipeline_experiment/data/transcripts/pps_jocks_transcript.json",
        "title": "Problem Solving & Python Discussion (Short Segment)"
    },
    {
        "audio_path": "Audio/only voice/Voice.m4a",
        "output_json": "pipeline_experiment/data/transcripts/voice_m4a_transcript.json",
        "title": "Classroom Lecture: Audio Recording Voice"
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

print("\nAll remaining audio files successfully transcribed!")
