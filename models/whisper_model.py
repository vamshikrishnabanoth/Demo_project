"""
Whisper Transcriber
Supports OpenAI Whisper API, Groq Whisper (ultra-fast cloud GPU), and local faster-whisper.
"""

import os
import time
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional
from models.base import BaseTranscriber, TranscriptionResult
from metrics.normalizer import normalize_text


class WhisperTranscriber(BaseTranscriber):
    """Whisper STT implementation (Groq Cloud / OpenAI API / Local faster-whisper)."""

    def __init__(
        self,
        model_name: Optional[str] = None,
        use_local: bool = False,
        local_model_size: Optional[str] = None,
        device: str = "cpu",
        compute_type: str = "int8",
        api_key: Optional[str] = None,
        **kwargs
    ):
        active_model = model_name or os.environ.get("WHISPER_MODEL", "whisper-large-v3")
        super().__init__(model_name=active_model, **kwargs)
        self.use_local = use_local
        self.local_model_size = local_model_size or os.environ.get("WHISPER_LOCAL_MODEL", "large-v3-turbo")
        self.device = device
        self.compute_type = compute_type
        self.groq_api_key = os.environ.get("GROQ_API_KEY", "")
        self.openai_api_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        self._local_model = None

    def _init_local_model(self):
        if self._local_model is None:
            from faster_whisper import WhisperModel
            import os as _os
            cpu_threads = max(1, _os.cpu_count() or 4)
            self._local_model = WhisperModel(
                self.local_model_size,
                device=self.device,
                compute_type=self.compute_type,
                cpu_threads=cpu_threads
            )

    def transcribe(self, audio_path: str | Path, prompt: Optional[str] = None, **kwargs) -> TranscriptionResult:
        audio_path = Path(audio_path)
        duration = self.get_audio_duration(audio_path)
        start_t = time.perf_counter()

        # 1. If Groq API Key is present, use ultra-fast Groq Whisper Cloud (1-2s response)
        if self.groq_api_key and not self.use_local:
            try:
                return self._transcribe_groq(audio_path, duration, start_t, prompt=prompt)
            except Exception as e:
                print(f"    [Whisper-Groq] Warning: {e}. Trying OpenAI...")

        # 2. Try OpenAI Whisper API
        if self.openai_api_key and not self.use_local:
            try:
                return self._transcribe_openai(audio_path, duration, start_t, prompt=prompt)
            except Exception as e:
                print(f"    [Whisper-OpenAI] Warning: {e}. Falling back to local faster-whisper...")

        # 3. Fallback to Local faster-whisper
        return self._transcribe_local(audio_path, duration, start_t, prompt=prompt)

    def _transcribe_groq(self, audio_path: Path, duration: float, start_t: float, prompt: Optional[str] = None) -> TranscriptionResult:
        from openai import OpenAI
        client = OpenAI(
            api_key=self.groq_api_key,
            base_url="https://api.groq.com/openai/v1"
        )
        
        create_kwargs = {
            "model": "whisper-large-v3",
            "response_format": "verbose_json"
        }
        if prompt:
            create_kwargs["prompt"] = prompt

        with open(audio_path, "rb") as f:
            create_kwargs["file"] = f
            res = client.audio.transcriptions.create(**create_kwargs)
            
        latency = time.perf_counter() - start_t
        raw_text = res.text if hasattr(res, "text") else str(res)
        
        segments = []
        if hasattr(res, "segments") and res.segments:
            for s in res.segments:
                s_dict = s if isinstance(s, dict) else s.__dict__ if hasattr(s, "__dict__") else {}
                segments.append({
                    "start": float(s_dict.get("start", 0.0)),
                    "end": float(s_dict.get("end", 0.0)),
                    "text": s_dict.get("text", "")
                })

        return TranscriptionResult(
            model_name="Whisper (large-v3)",
            raw_transcript=raw_text.strip(),
            normalized_transcript=normalize_text(raw_text),
            segments=segments,
            words=[],
            latency_sec=latency,
            audio_duration_sec=duration
        )

    def _transcribe_openai(self, audio_path: Path, duration: float, start_t: float, prompt: Optional[str] = None) -> TranscriptionResult:
        from openai import OpenAI
        client = OpenAI(api_key=self.openai_api_key)
        
        create_kwargs = {
            "model": "whisper-1",
            "response_format": "verbose_json"
        }
        if prompt:
            create_kwargs["prompt"] = prompt

        with open(audio_path, "rb") as f:
            create_kwargs["file"] = f
            transcript_obj = client.audio.transcriptions.create(**create_kwargs)
            
        latency = time.perf_counter() - start_t
        raw_text = transcript_obj.text if hasattr(transcript_obj, "text") else str(transcript_obj)
        
        return TranscriptionResult(
            model_name="Whisper-API (whisper-1)",
            raw_transcript=raw_text.strip(),
            normalized_transcript=normalize_text(raw_text),
            segments=[],
            words=[],
            latency_sec=latency,
            audio_duration_sec=duration
        )

    def _transcribe_local(self, audio_path: Path, duration: float, start_t: float, prompt: Optional[str] = None) -> TranscriptionResult:
        try:
            self._init_local_model()
            kwargs = {"beam_size": 1, "word_timestamps": True}
            if prompt:
                kwargs["initial_prompt"] = prompt

            segments_gen, info = self._local_model.transcribe(
                str(audio_path),
                **kwargs
            )
            segments = []
            words = []
            full_text_parts = []
            
            for seg in segments_gen:
                full_text_parts.append(seg.text)
                segments.append({
                    "start": seg.start,
                    "end": seg.end,
                    "text": seg.text.strip()
                })
                if seg.words:
                    for w in seg.words:
                        words.append({
                            "start": w.start,
                            "end": w.end,
                            "word": w.word.strip()
                        })
                        
            latency = time.perf_counter() - start_t
            raw_text = " ".join(full_text_parts).strip()
            
            return TranscriptionResult(
                model_name=f"faster-whisper ({self.local_model_size})",
                raw_transcript=raw_text,
                normalized_transcript=normalize_text(raw_text),
                segments=segments,
                words=words,
                latency_sec=latency,
                audio_duration_sec=duration
            )
        except Exception as e:
            latency = time.perf_counter() - start_t
            return TranscriptionResult(
                model_name=f"faster-whisper ({self.local_model_size})",
                raw_transcript="",
                latency_sec=latency,
                audio_duration_sec=duration,
                error=f"Local Whisper Error: {str(e)}"
            )
