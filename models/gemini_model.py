"""
Gemini Multimodal Audio Transcriber
Uses Google Gemini for audio transcription.
Supports both inline audio and large audio file uploads (Files API) for full-length 1-2 hour lectures.
"""

import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from models.base import BaseTranscriber, TranscriptionResult
from metrics.normalizer import normalize_text


class GeminiTranscriber(BaseTranscriber):
    """Google Gemini STT provider using google-genai SDK."""

    def __init__(
        self,
        model_name: Optional[str] = None,
        api_key: Optional[str] = None,
        **kwargs
    ):
        active_model = model_name or os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
        super().__init__(model_name=active_model, **kwargs)
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY", "") or os.environ.get("GOOGLE_API_KEY", "")

    def transcribe(self, audio_path: str | Path) -> TranscriptionResult:
        audio_path = Path(audio_path)
        duration = self.get_audio_duration(audio_path)
        start_t = time.perf_counter()

        if not self.api_key:
            return TranscriptionResult(
                model_name=f"Gemini ({self.model_name})",
                raw_transcript="",
                latency_sec=0.0,
                audio_duration_sec=duration,
                error="GEMINI_API_KEY is not set. Please set it in .env or environment."
            )

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=self.api_key)

            file_size_mb = audio_path.stat().st_size / (1024 * 1024)
            name_lower = audio_path.name.lower()
            
            if "wav" in name_lower:
                mime_type = "audio/wav"
            elif "mp3" in name_lower or "mpeg" in name_lower:
                mime_type = "audio/mp3"
            elif "m4a" in name_lower or "mp4" in name_lower:
                mime_type = "audio/mp4"
            else:
                mime_type = "audio/mp3"

            prompt = (
                "Transcribe this classroom lecture audio recording exactly word-for-word as spoken. "
                "Do not summarize, do not omit technical explanations, and do not add conversational commentary. "
                "Output only the exact spoken transcript."
            )

            # For files > 15MB, use the Files API for high reliability
            if file_size_mb > 15.0:
                print(f"    [Gemini] Large lecture audio detected ({file_size_mb:.1f} MB). Uploading via Files API...")
                uploaded_file = client.files.upload(
                    file=str(audio_path),
                    config=types.UploadFileConfig(mime_type=mime_type)
                )
                
                # Wait briefly for file to become ACTIVE if needed
                while uploaded_file.state.name == "PROCESSING":
                    time.sleep(2)
                    uploaded_file = client.files.get(name=uploaded_file.name)

                response = client.models.generate_content(
                    model=self.model_name,
                    contents=[uploaded_file, prompt],
                    config=types.GenerateContentConfig(temperature=0.0)
                )
            else:
                with open(audio_path, "rb") as f:
                    audio_bytes = f.read()

                response = client.models.generate_content(
                    model=self.model_name,
                    contents=[
                        types.Part.from_bytes(
                            data=audio_bytes,
                            mime_type=mime_type
                        ),
                        prompt
                    ],
                    config=types.GenerateContentConfig(temperature=0.0)
                )

            latency = time.perf_counter() - start_t
            raw_text = response.text or ""

            return TranscriptionResult(
                model_name=f"Gemini ({self.model_name})",
                raw_transcript=raw_text.strip(),
                normalized_transcript=normalize_text(raw_text),
                segments=[],
                words=[],
                latency_sec=latency,
                audio_duration_sec=duration
            )

        except Exception as e:
            latency = time.perf_counter() - start_t
            return TranscriptionResult(
                model_name=f"Gemini ({self.model_name})",
                raw_transcript="",
                latency_sec=latency,
                audio_duration_sec=duration,
                error=f"Gemini Error: {str(e)}"
            )
