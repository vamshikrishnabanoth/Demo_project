import os
import sys
import json
import time
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from models import WhisperTranscriber

def transcribe_audio():
    audio_path = os.path.join(PROJECT_ROOT, "Audio", "only voice", "AI 20-8-26 unseen.m4a")
    output_path = os.path.join(PROJECT_ROOT, "pipeline_experiment", "data", "transcripts", "ai_20_8_26_unseen_transcript.json")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    from faster_whisper import WhisperModel
    import multiprocessing
    threads = max(2, multiprocessing.cpu_count() or 4)
    print(f"Loading faster-whisper base.en model (threads={threads})...")
    model = WhisperModel("base.en", device="cpu", compute_type="int8", cpu_threads=threads)
    
    start_time = time.time()
    segments_gen, info = model.transcribe(audio_path, beam_size=1, word_timestamps=False)
    
    segments = []
    text_chunks = []
    for idx, seg in enumerate(segments_gen, 1):
        seg_dict = {
            "id": idx,
            "start": round(seg.start, 2),
            "end": round(seg.end, 2),
            "text": seg.text.strip()
        }
        segments.append(seg_dict)
        text_chunks.append(seg.text.strip())
        
    elapsed = time.time() - start_time
    
    transcript_data = {
        "audio_file": "Audio/only voice/AI 20-8-26 unseen.m4a",
        "language": "en",
        "duration_seconds": round(info.duration, 2),
        "transcription_time_seconds": round(elapsed, 2),
        "total_segments": len(segments),
        "text": " ".join(text_chunks),
        "segments": segments
    }
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(transcript_data, f, indent=2, ensure_ascii=False)
        
    print(f"Transcription complete in {elapsed:.2f}s! Saved {len(segments)} segments to {output_path}")

if __name__ == "__main__":
    transcribe_audio()
