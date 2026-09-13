"""
Base Transcriber Interface and Unified Transcription Result Schema
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional
import time


@dataclass
class TranscriptionResult:
    """Unified transcription output for all STT providers."""
    model_name: str
    raw_transcript: str
    normalized_transcript: str = ""
    segments: List[Dict[str, Any]] = field(default_factory=list)
    words: List[Dict[str, Any]] = field(default_factory=list)
    latency_sec: float = 0.0
    audio_duration_sec: float = 0.0
    error: Optional[str] = None
    raw_response: Optional[Dict[str, Any]] = None

    @property
    def text(self) -> str:
        return self.raw_transcript

    @property
    def duration(self) -> float:
        return self.audio_duration_sec

    def to_dict(self) -> Dict[str, Any]:
        return {
            "model_name": self.model_name,
            "raw_transcript": self.raw_transcript,
            "normalized_transcript": self.normalized_transcript,
            "segments_count": len(self.segments),
            "words_count": len(self.words),
            "latency_sec": self.latency_sec,
            "audio_duration_sec": self.audio_duration_sec,
            "error": self.error,
        }


class BaseTranscriber(ABC):
    """Abstract base class for speech-to-text model providers."""
    
    def __init__(self, model_name: str, **kwargs):
        self.model_name = model_name
        self.kwargs = kwargs

    @abstractmethod
    def transcribe(self, audio_path: str | Path) -> TranscriptionResult:
        """
        Transcribes the given audio file.
        
        Args:
            audio_path: Path to audio file (.wav, .mp3, .mpeg, etc.)
            
        Returns:
            TranscriptionResult object
        """
        pass

    def get_audio_duration(self, audio_path: str | Path) -> float:
        """
        Robustly measures audio duration across formats (.mp3, .mpeg, .wav)
        using PyAV, wave, or soundfile.
        """
        path = Path(audio_path)
        # 1. Try PyAV (fastest and most versatile for mpeg/mp3)
        try:
            import av
            with av.open(str(path)) as container:
                if container.duration:
                    return float(container.duration / 1000000.0)
                if container.streams.audio:
                    stream = container.streams.audio[0]
                    if stream.duration and stream.time_base:
                        return float(stream.duration * stream.time_base)
        except Exception:
            pass

        # 2. Try Wave
        try:
            import wave
            with wave.open(str(path), 'rb') as wf:
                frames = wf.getnframes()
                rate = wf.getframerate()
                return frames / float(rate)
        except Exception:
            pass

        # 3. Try soundfile
        try:
            import soundfile as sf
            info = sf.info(str(path))
            return float(info.duration)
        except Exception:
            pass

        return 0.0
