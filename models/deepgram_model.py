"""
Deepgram Nova-2 Transcriber
"""

import os
import time
import json
import requests
from pathlib import Path
from typing import Any, Dict, List, Optional
from models.base import BaseTranscriber, TranscriptionResult
from metrics.normalizer import normalize_text


class DeepgramTranscriber(BaseTranscriber):
    """Deepgram Nova-2 Speech-to-Text implementation."""

    def __init__(
        self,
        model_name: Optional[str] = None,
        api_key: Optional[str] = None,
        smart_format: bool = True,
        punctuate: bool = True,
        **kwargs
    ):
        active_model = model_name or os.environ.get("DEEPGRAM_MODEL", "nova-2")
        super().__init__(model_name=active_model, **kwargs)
        self.api_key = api_key or os.environ.get("DEEPGRAM_API_KEY", "")
        self.smart_format = smart_format
        self.punctuate = punctuate

    def transcribe(self, audio_path: str | Path, keywords: Optional[List[str]] = None, **kwargs) -> TranscriptionResult:
        audio_path = Path(audio_path)
        duration = self.get_audio_duration(audio_path)
        start_t = time.perf_counter()

        if not self.api_key:
            return TranscriptionResult(
                model_name=f"Deepgram ({self.model_name})",
                raw_transcript="",
                latency_sec=0.0,
                audio_duration_sec=duration,
                error="DEEPGRAM_API_KEY is not set. Please set it in .env or environment."
            )

        try:
            query_params = [
                f"model={self.model_name}",
                f"smart_format={str(self.smart_format).lower()}",
                f"punctuate={str(self.punctuate).lower()}",
                "utterances=true"
            ]
            
            # Add keyword boosting parameters if provided
            if keywords:
                for kw in keywords[:50]:  # Deepgram supports up to 50 key terms
                    clean_kw = kw.strip().replace(" ", "%20")
                    if clean_kw:
                        query_params.append(f"keywords={clean_kw}:2")

            url = f"https://api.deepgram.com/v1/listen?{'&'.join(query_params)}"
            
            name_lower = audio_path.name.lower()
            if "wav" in name_lower:
                content_type = "audio/wav"
            elif "m4a" in name_lower or "mp4" in name_lower:
                content_type = "audio/mp4"
            else:
                content_type = "audio/mpeg"

            headers = {
                "Authorization": f"Token {self.api_key}",
                "Content-Type": content_type
            }

            with open(audio_path, "rb") as f:
                audio_data = f.read()

            response = requests.post(url, headers=headers, data=audio_data, timeout=300)
            latency = time.perf_counter() - start_t

            if response.status_code != 200:
                return TranscriptionResult(
                    model_name=f"Deepgram ({self.model_name})",
                    raw_transcript="",
                    latency_sec=latency,
                    audio_duration_sec=duration,
                    error=f"Deepgram HTTP {response.status_code}: {response.text}"
                )

            res_json = response.json()
            results = res_json.get("results", {})
            channels = results.get("channels", [{}])
            alt = channels[0].get("alternatives", [{}])[0] if channels else {}

            raw_text = alt.get("transcript", "")
            norm_text = normalize_text(raw_text)

            segments = []
            utterances = results.get("utterances", [])
            for utt in utterances:
                segments.append({
                    "start": utt.get("start", 0.0),
                    "end": utt.get("end", 0.0),
                    "text": utt.get("transcript", "").strip()
                })

            words = []
            for w in alt.get("words", []):
                words.append({
                    "start": w.get("start", 0.0),
                    "end": w.get("end", 0.0),
                    "word": w.get("word", "")
                })

            return TranscriptionResult(
                model_name=f"Deepgram ({self.model_name})",
                raw_transcript=raw_text.strip(),
                normalized_transcript=norm_text,
                segments=segments,
                words=words,
                latency_sec=latency,
                audio_duration_sec=duration,
                raw_response=res_json
            )

        except Exception as e:
            latency = time.perf_counter() - start_t
            return TranscriptionResult(
                model_name=f"Deepgram ({self.model_name})",
                raw_transcript="",
                latency_sec=latency,
                audio_duration_sec=duration,
                error=f"Deepgram Error: {str(e)}"
            )
