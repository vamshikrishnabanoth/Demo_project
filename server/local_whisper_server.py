"""
Local Fast Whisper Server (GPU/CPU-Accelerated)
Provides a high-speed local transcription endpoint for the AI Live Quiz platform.
Listens on http://127.0.0.1:8000/transcribe

Requirements:
    pip install fastapi uvicorn python-multipart faster-whisper
"""

import sys
import os

# Fix Windows console UTF-8 encoding so emojis never crash Python
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

import time
import tempfile
import shutil
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="Local Whisper STT Engine", version="1.0.0")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model holder
whisper_model = None
MODEL_SIZE = os.environ.get("WHISPER_MODEL", "small")  # "small" (cached, instant) or "medium", "large-v3-turbo"


def get_model():
    global whisper_model
    if whisper_model is not None:
        return whisper_model

    from faster_whisper import WhisperModel
    import torch

    device = "cuda" if torch.cuda.is_available() else "cpu"
    compute_type = "float16" if device == "cuda" else "int8"
    cpu_threads = max(1, os.cpu_count() or 4)

    print("\n=======================================================")
    print(f"[*] Loading faster-whisper model: '{MODEL_SIZE}'")
    print(f"    Device: {device.upper()} | Compute: {compute_type} | CPU Threads: {cpu_threads}")
    print("=======================================================")

    try:
        whisper_model = WhisperModel(
            MODEL_SIZE,
            device=device,
            compute_type=compute_type,
            cpu_threads=cpu_threads
        )
    except Exception as e:
        print(f"[!] Failed to load on {device} ({e}). Falling back to CPU int8...")
        whisper_model = WhisperModel(
            MODEL_SIZE,
            device="cpu",
            compute_type="int8",
            cpu_threads=cpu_threads
        )

    print("[+] Model loaded and ready to transcribe.\n")
    return whisper_model


@app.on_event("startup")
def startup_event():
    print("[*] Pre-warming Whisper model on startup...")
    get_model()
    print("=======================================================")
    print("[+] WHISPER ENGINE READY!")
    print("    Listening on: http://127.0.0.1:8000")
    print("    Waiting for audio uploads from your AWS EC2 server...")
    print("=======================================================\n")


@app.get("/")
@app.get("/health")
def health():
    return {"status": "online", "model": MODEL_SIZE, "service": "Local Whisper STT Engine"}


@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Accepts an audio file upload and returns timestamped transcription compatible
    with Node.js quizController.js.
    """
    start_time = time.perf_counter()
    model = get_model()

    # Save uploaded file to a temporary location
    suffix = Path(file.filename or "audio.wav").suffix or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_audio:
        temp_path = temp_audio.name
        shutil.copyfileobj(file.file, temp_audio)

    try:
        file_size_mb = os.path.getsize(temp_path) / (1024 * 1024)
        print("\n=======================================================")
        print(f"[AUDIO RECEIVED FROM AWS] {file.filename} ({file_size_mb:.2f} MB)")
        print(f"[*] Transcribing audio speech to text now on your laptop...")
        print("=======================================================")

        # Transcribe with VAD filter to ignore silence
        segments_gen, info = model.transcribe(
            temp_path,
            beam_size=5,
            word_timestamps=False,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500)
        )

        segments = []
        text_parts = []
        for s in segments_gen:
            text_parts.append(s.text.strip())
            segments.append({
                "start": round(s.start, 2),
                "end": round(s.end, 2),
                "text": s.text.strip()
            })

        full_text = " ".join(text_parts).strip()
        elapsed = time.perf_counter() - start_time
        duration = info.duration or (segments[-1]["end"] if segments else 0)

        # Format human duration HH:MM:SS
        total_s = int(duration)
        h = total_s // 3600
        m = (total_s % 3600) // 60
        s = total_s % 60
        duration_formatted = f"{h:02d}:{m:02d}:{s:02d}"

        print(f"[+] Transcribed successfully in {elapsed:.2f}s!")
        print(f"    Audio duration: {duration_formatted} ({duration:.1f}s)")
        print(f"    Characters: {len(full_text)} | Segments: {len(segments)}")
        print("=======================================================\n")

        return {
            "status": "success",
            "text": full_text,
            "raw_text": full_text,
            "segments": segments,
            "duration": duration,
            "duration_formatted": duration_formatted,
            "language": info.language or "en"
        }

    except Exception as err:
        print(f"[!] Transcription error: {err}")
        raise HTTPException(status_code=500, detail=str(err))

    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting Local Whisper Service on http://127.0.0.1:{port}")
    uvicorn.run("local_whisper_server:app", host="0.0.0.0", port=port, reload=False)
