import os
import sys
import json
import time
from pathlib import Path
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
load_dotenv(PROJECT_ROOT / ".env")

from models.deepgram_model import DeepgramTranscriber

def transcribe_audio():
    audio_path = os.path.join(PROJECT_ROOT, "Audio", "only voice", "AI 20-8-26 unseen.m4a")
    output_path = os.path.join(PROJECT_ROOT, "pipeline_experiment", "data", "transcripts", "ai_20_8_26_unseen_transcript.json")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    print(f"Transcribing via Deepgram Nova-2: {audio_path}")
    transcriber = DeepgramTranscriber()
    
    result = transcriber.transcribe(audio_path)
    
    if result.error:
        print(f"Error during transcription: {result.error}")
        return
        
    print(f"Deepgram completed in {result.latency_sec:.2f}s! Audio duration: {result.audio_duration_sec:.2f}s")
    
    segments_formatted = []
    for idx, seg in enumerate(result.segments, 1):
        segments_formatted.append({
            "id": idx,
            "start": seg.get("start", 0.0),
            "end": seg.get("end", 0.0),
            "text": seg.get("text", "")
        })
        
    transcript_data = {
        "audio_file": "Audio/only voice/AI 20-8-26 unseen.m4a",
        "language": "en",
        "duration_seconds": result.audio_duration_sec,
        "transcription_time_seconds": round(result.latency_sec, 2),
        "total_segments": len(segments_formatted),
        "text": result.raw_transcript,
        "segments": segments_formatted
    }
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(transcript_data, f, indent=2, ensure_ascii=False)
        
    print(f"Saved {len(segments_formatted)} segments to {output_path}")

if __name__ == "__main__":
    transcribe_audio()
