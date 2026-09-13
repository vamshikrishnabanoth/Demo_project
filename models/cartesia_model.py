"""
Cartesia Ink-2 STT Provider
Supports Cartesia's ultra-low-latency speech-to-text API.
"""

import os
import time
import requests
from pathlib import Path
from typing import Any, Dict, List, Optional
from models.base import BaseTranscriber, TranscriptionResult
from metrics.normalizer import normalize_text


class CartesiaTranscriber(BaseTranscriber):
    """Cartesia Ink-2 Speech-to-Text provider."""

    def __init__(
        self,
        model_name: str = "ink-2",
        api_key: Optional[str] = None,
        **kwargs
    ):
        super().__init__(model_name=model_name, **kwargs)
        self.api_key = api_key or os.environ.get("CARTESIA_API_KEY", "")

    def transcribe(self, audio_path: str | Path) -> TranscriptionResult:
        audio_path = Path(audio_path)
        duration = self.get_audio_duration(audio_path)
        start_t = time.perf_counter()

        if not self.api_key:
            return TranscriptionResult(
                model_name=f"Cartesia ({self.model_name})",
                raw_transcript="",
                latency_sec=0.0,
                audio_duration_sec=duration,
                error="CARTESIA_API_KEY is not set. Please set it in .env to evaluate Cartesia Ink-2."
            )

        try:
            url = "https://api.cartesia.ai/listen"
            headers = {
                "X-API-Key": self.api_key,
                "Cartesia-Version": "2024-06-10"
            }

            with open(audio_path, "rb") as f:
                files = {"file": f}
                data = {"model": self.model_name}
                response = requests.post(url, headers=headers, files=files, data=data, timeout=60)

            latency = time.perf_counter() - start_t

            if response.status_code != 200:
                return TranscriptionResult(
                    model_name=f"Cartesia ({self.model_name})",
                    raw_transcript="",
                    latency_sec=latency,
                    audio_duration_sec=duration,
                    error=f"Cartesia HTTP {response.status_code}: {response.text}"
                )

            res_json = response.json()
            raw_text = res_json.get("transcript", "") or res_json.get("text", "")

            return TranscriptionResult(
                model_name=f"Cartesia ({self.model_name})",
                raw_transcript=raw_text.strip(),
                normalized_transcript=normalize_text(raw_text),
                segments=[],
                words=[],
                latency_sec=latency,
                audio_duration_sec=duration,
                raw_response=res_json
            )

        except Exception as e:
            latency = time.perf_counter() - start_t
            return TranscriptionResult(
                model_name=f"Cartesia ({self.model_name})",
                raw_transcript="",
                latency_sec=latency,
                audio_duration_sec=duration,
                error=f"Cartesia Error: {str(e)}"
            )
