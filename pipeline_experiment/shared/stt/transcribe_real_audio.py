"""
Frozen STT Transcriber for Real Audio Lectures using faster-whisper.
Transcribes audio recordings into canonical timestamped JSON transcript representations.
"""

import os
import json
from faster_whisper import WhisperModel


def transcribe_audio_file(
    audio_path: str,
    output_json_path: str,
    model_size: str = "base",
    device: str = "cpu",
    compute_type: str = "int8"
):
    print(f"[STT] Transcribing: {os.path.basename(audio_path)} ...", flush=True)
    os.makedirs(os.path.dirname(output_json_path), exist_ok=True)

    model = WhisperModel(model_size, device=device, compute_type=compute_type)
    segments, info = model.transcribe(audio_path, beam_size=5, language="en")

    parsed_segments = []
    full_text_parts = []
    total_duration = info.duration

    for seg in segments:
        text = seg.text.strip()
        if text:
            parsed_segments.append({
                "start": round(seg.start, 2),
                "end": round(seg.end, 2),
                "text": text
            })
            full_text_parts.append(f"[{round(seg.start, 1)}s - {round(seg.end, 1)}s] {text}")

    full_content = "\n".join(full_text_parts)
    payload = {
        "audio_file": os.path.basename(audio_path),
        "duration_seconds": round(total_duration, 2),
        "language": info.language,
        "raw_content": full_content,
        "segments": parsed_segments
    }

    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print(f"[STT] Saved transcript to: {output_json_path} (Duration: {total_duration:.1f}s, Segments: {len(parsed_segments)})", flush=True)
    return payload


if __name__ == "__main__":
    audio_tasks = [
        (
            r"Audio/only voice/deepa madam.mp3.mpeg",
            r"pipeline_experiment/data/transcripts/deepa_madam_transcript.json"
        ),
        (
            r"Audio/only voice/tapadia sir.mp3.mpeg",
            r"pipeline_experiment/data/transcripts/tapadia_sir_transcript.json"
        ),
        (
            r"Audio/only voice/WT 18-8-26.m4a",
            r"pipeline_experiment/data/transcripts/wt_web_tech_transcript.json"
        ),
        (
            r"Audio/voice+ppt/Binary Trees and different types of  trees.mp3",
            r"pipeline_experiment/data/transcripts/binary_trees_transcript.json"
        )
    ]

    for audio_p, out_p in audio_tasks:
        if os.path.exists(audio_p) and not os.path.exists(out_p):
            transcribe_audio_file(audio_p, out_p)
