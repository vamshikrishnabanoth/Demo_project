"""
Model Factory and Provider Registry for Speech-to-Text Benchmark
"""

from typing import Dict, List, Type
from models.base import BaseTranscriber, TranscriptionResult
from models.whisper_model import WhisperTranscriber
from models.gpt4o_model import GPT4oTranscriber
from models.deepgram_model import DeepgramTranscriber
from models.gemini_model import GeminiTranscriber
from models.cartesia_model import CartesiaTranscriber

MODEL_REGISTRY: Dict[str, Type[BaseTranscriber]] = {
    "whisper": WhisperTranscriber,
    "whisper-large-v3": WhisperTranscriber,
    "whisper-local": WhisperTranscriber,
    "gpt-4o": GPT4oTranscriber,
    "openai": GPT4oTranscriber,
    "deepgram": DeepgramTranscriber,
    "gemini": GeminiTranscriber,
    "cartesia": CartesiaTranscriber,
    "cartesia-ink-2": CartesiaTranscriber,
}


def get_transcriber(model_id: str, **kwargs) -> BaseTranscriber:
    """Instantiate a transcriber by provider ID."""
    key = model_id.lower().strip()
    if key in ("whisper-local", "local-whisper"):
        return WhisperTranscriber(use_local=True, **kwargs)
    elif key in ("whisper", "whisper-api", "whisper-large-v3"):
        return WhisperTranscriber(use_local=False, **kwargs)
    elif "gpt" in key or key == "openai":
        return GPT4oTranscriber(**kwargs)
    elif "deepgram" in key:
        return DeepgramTranscriber(**kwargs)
    elif "gemini" in key:
        return GeminiTranscriber(**kwargs)
    elif "cartesia" in key:
        return CartesiaTranscriber(**kwargs)
    else:
        raise ValueError(f"Unknown model identifier: '{model_id}'. Supported: whisper, gpt-4o, deepgram, gemini, cartesia")


__all__ = [
    "BaseTranscriber",
    "TranscriptionResult",
    "WhisperTranscriber",
    "GPT4oTranscriber",
    "DeepgramTranscriber",
    "GeminiTranscriber",
    "CartesiaTranscriber",
    "get_transcriber",
    "MODEL_REGISTRY"
]
