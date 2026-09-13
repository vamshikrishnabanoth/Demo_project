"""
Multimodal Synchronizer.
Aligns spoken speech timestamps with supporting slides, code cells, or document sections.
"""

from typing import List, Dict, Any, Optional
import re
from pipeline_experiment.shared.schemas.canonical_models import TimeSpan


class MultimodalSynchronizer:
    @staticmethod
    def parse_timestamped_transcript(raw_text: str, default_duration: float = 3600.0) -> List[Dict[str, Any]]:
        """
        Parses text segments containing timestamp markers like [00:15 - 01:30] or [12.5s],
        or distributes time evenly across sentences.
        """
        lines = [l.strip() for l in raw_text.split("\n") if l.strip()]
        segments = []
        timestamp_pattern = re.compile(r"\[(\d{1,2}:\d{2}(?::\d{2})?|\d+(?:\.\d+)?s?)(?:\s*-\s*(\d{1,2}:\d{2}(?::\d{2})?|\d+(?:\.\d+)?s?))?\]")

        current_time = 0.0
        time_step = max(5.0, default_duration / max(1, len(lines)))

        for idx, line in enumerate(lines):
            match = timestamp_pattern.search(line)
            if match:
                start_str = match.group(1).replace("s", "")
                end_str = match.group(2).replace("s", "") if match.group(2) else None
                
                start = MultimodalSynchronizer._to_seconds(start_str)
                end = MultimodalSynchronizer._to_seconds(end_str) if end_str else start + time_step
                clean_text = timestamp_pattern.sub("", line).strip()
            else:
                start = idx * time_step
                end = start + time_step
                clean_text = line

            if clean_text:
                segments.append({
                    "time_span": TimeSpan(start=round(start, 1), end=round(end, 1)),
                    "text": clean_text
                })

        return segments

    @staticmethod
    def _to_seconds(ts_str: str) -> float:
        parts = ts_str.split(":")
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
        elif len(parts) == 2:
            return int(parts[0]) * 60 + float(parts[1])
        try:
            return float(ts_str)
        except ValueError:
            return 0.0
