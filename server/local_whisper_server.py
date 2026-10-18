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


from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[*] Pre-warming Whisper model on startup...", flush=True)
    get_model()
    print("=======================================================", flush=True)
    print("[+] WHISPER ENGINE READY!", flush=True)
    print("    Listening on: http://127.0.0.1:8000")
    print("    Waiting for audio uploads from your AWS EC2 server...")
    print("=======================================================\n", flush=True)
    yield

app = FastAPI(title="Local Whisper STT Engine", version="1.0.0", lifespan=lifespan)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
@app.get("/health")
def health():
    return {"status": "online", "model": MODEL_SIZE, "service": "Local Whisper STT Engine"}


@app.post("/transcribe")
def transcribe_audio(file: UploadFile = File(...)):
    """
    Accepts an audio file upload and returns timestamped transcription compatible
    with Node.js quizController.js. Runs in threadpool so event loop remains free.
    """
    start_time = time.perf_counter()
    print("\n=======================================================", flush=True)
    print(f"[*] [INCOMING AUDIO STREAM] Receiving from AWS: {file.filename}", flush=True)
    print(f"[*] Streaming chunks to local disk...", flush=True)

    model = get_model()

    # Save uploaded file to a temporary location
    suffix = Path(file.filename or "audio.wav").suffix or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_audio:
        temp_path = temp_audio.name
        total_bytes = 0
        while True:
            chunk = file.file.read(8 * 1024 * 1024)
            if not chunk:
                break
            temp_audio.write(chunk)
            total_bytes += len(chunk)
            print(f"    --> Received {total_bytes / (1024 * 1024):.1f} MB from AWS...", flush=True)

    try:
        file_size_mb = os.path.getsize(temp_path) / (1024 * 1024)
        print("-------------------------------------------------------", flush=True)
        print(f"[+] Audio download complete: {file_size_mb:.2f} MB saved", flush=True)
        print(f"[*] Transcribing audio with faster-whisper ('{MODEL_SIZE}')...", flush=True)
        print("-------------------------------------------------------", flush=True)

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
        seg_idx = 0
        for s in segments_gen:
            seg_idx += 1
            txt = s.text.strip()
            text_parts.append(txt)
            segments.append({
                "start": round(s.start, 2),
                "end": round(s.end, 2),
                "text": txt
            })
            if seg_idx % 4 == 1 or seg_idx <= 3:
                total_s = int(s.end)
                h = total_s // 3600
                m = (total_s % 3600) // 60
                sc = total_s % 60
                print(f"    [{h:02d}:{m:02d}:{sc:02d}] {txt[:70]}", flush=True)

        full_text = " ".join(text_parts).strip()
        elapsed = time.perf_counter() - start_time
        duration = info.duration or (segments[-1]["end"] if segments else 0)

        # Format human duration HH:MM:SS
        total_s = int(duration)
        h = total_s // 3600
        m = (total_s % 3600) // 60
        s = total_s % 60
        duration_formatted = f"{h:02d}:{m:02d}:{s:02d}"

        print("=======================================================", flush=True)
        print(f"[+] Transcribed successfully in {elapsed:.2f}s!", flush=True)
        print(f"    Audio duration: {duration_formatted} ({duration:.1f}s)", flush=True)
        print(f"    Characters: {len(full_text)} | Segments: {len(segments)}", flush=True)
        print("=======================================================\n", flush=True)

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
        print(f"[!] Transcription error: {err}", flush=True)
        raise HTTPException(status_code=500, detail=str(err))

    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting Local Whisper Service on http://127.0.0.1:{port}", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=port, reload=False)
