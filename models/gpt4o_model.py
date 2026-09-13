"""
GPT-4o Audio Transcriber
Uses OpenAI's audio modality with configurable model IDs and verbatim transcription.
Includes automatic voice compression for optimal audio token efficiency.
"""

import os
import base64
import time
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional
from models.base import BaseTranscriber, TranscriptionResult
from metrics.normalizer import normalize_text


def compress_for_gpt4o(input_path: Path, max_size_mb: float = 15.0) -> Path:
    """Compress audio to 16kHz mono to minimize audio token payload."""
    try:
        import av
        file_size_mb = input_path.stat().st_size / (1024 * 1024)
        if file_size_mb <= max_size_mb:
            return input_path

        temp_dir = Path(tempfile.gettempdir())
        compressed_path = temp_dir / f"gpt4o_voice_{input_path.stem}.mp3"
        
        input_container = av.open(str(input_path))
        in_stream = input_container.streams.audio[0]

        output_container = av.open(str(compressed_path), mode="w")
        out_stream = output_container.add_stream("mp3", rate=16000)
        out_stream.bit_rate = 32000
        out_stream.channels = 1
        out_stream.layout = "mono"

        for frame in input_container.decode(in_stream):
            for packet in out_stream.encode(frame):
                output_container.mux(packet)
        for packet in out_stream.encode(None):
            output_container.mux(packet)

        input_container.close()
        output_container.close()
        return compressed_path
    except Exception:
        return input_path


class GPT4oTranscriber(BaseTranscriber):
    """GPT-4o audio transcription provider."""

    def __init__(
        self,
        model_name: Optional[str] = None,
        api_key: Optional[str] = None,
        **kwargs
    ):
        active_model = model_name or os.environ.get("GPT4O_MODEL", "gpt-4o-audio-preview")
        super().__init__(model_name=active_model, **kwargs)
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY", "")

    def transcribe(self, audio_path: str | Path) -> TranscriptionResult:
        audio_path = Path(audio_path)
        duration = self.get_audio_duration(audio_path)
        start_t = time.perf_counter()

        if not self.api_key:
            return TranscriptionResult(
                model_name=f"GPT-4o ({self.model_name})",
                raw_transcript="",
                latency_sec=0.0,
                audio_duration_sec=duration,
                error="OPENAI_API_KEY is not set. Please set it in .env or environment."
            )

        # GPT-4o input audio is designed for short clips / utterances (max ~5-10 min)
        if duration > 600:
            print(f"    [GPT-4o] Note: Full audio is {duration/60:.1f} mins. GPT-4o audio context is optimized for <=10min clips.")

        compressed_file = None
        try:
            from openai import OpenAI
            client = OpenAI(api_key=self.api_key)

            upload_path = compress_for_gpt4o(audio_path, max_size_mb=15.0)
            if upload_path != audio_path:
                compressed_file = upload_path

            with open(upload_path, "rb") as f:
                audio_bytes = f.read()
            encoded_audio = base64.b64encode(audio_bytes).decode("utf-8")

            suffix = upload_path.suffix.lower().replace(".", "")
            audio_format = "wav" if suffix == "wav" else "mp3"

            response = client.chat.completions.create(
                model=self.model_name,
                modalities=["text"],
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Transcribe the provided audio recording verbatim word-for-word. "
                            "Do not summarize, do not omit words, and do not provide explanations. "
                            "Output only the transcript text."
                        )
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "input_audio",
                                "input_audio": {
                                    "data": encoded_audio,
                                    "format": audio_format,
                                }
                            }
                        ]
                    }
                ],
                temperature=0.0
            )

            latency = time.perf_counter() - start_t
            raw_text = response.choices[0].message.content or ""

            return TranscriptionResult(
                model_name=f"GPT-4o ({self.model_name})",
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
                model_name=f"GPT-4o ({self.model_name})",
                raw_transcript="",
                latency_sec=latency,
                audio_duration_sec=duration,
                error=f"GPT-4o Error: {str(e)}"
            )
        finally:
            if compressed_file and compressed_file.exists() and compressed_file != audio_path:
                try:
                    compressed_file.unlink()
                except Exception:
                    pass
