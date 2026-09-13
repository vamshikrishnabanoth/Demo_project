"""
Speed (RTF, Latency) and Production API Cost Calculator
"""

from typing import Any, Dict, Optional

# Public Pricing Rates (in USD per audio hour)
API_COST_RATES_PER_HOUR = {
    "whisper-api": 0.36,         # $0.006 / minute ($0.36/hour)
    "whisper-local": 0.00,       # Self-hosted / Open Source
    "deepgram-nova-2": 0.258,    # $0.0043 / minute
    "deepgram-nova-3": 0.354,    # $0.0059 / minute
    "deepgram": 0.258,           # default
    "gpt-4o-audio": 3.60,        # ~$0.06 / minute for audio tokens
    "gpt-4o": 3.60,
    "gemini-2.0-flash": 0.072,   # ~$0.0012 / minute ($0.072/hour)
    "gemini-1.5-flash": 0.072,
    "gemini-1.5-pro": 0.360,
    "gemini": 0.072,
}


def calculate_speed_and_cost(
    model_name: str,
    latency_sec: float,
    audio_duration_sec: float
) -> Dict[str, Any]:
    """
    Calculates processing speed, Real-Time Factor (RTF), and production cost.
    
    RTF = Latency (s) / Audio Duration (s)
    - RTF < 1.0 : Faster than real-time (e.g. RTF 0.1 means 10x real-time speed)
    - RTF > 1.0 : Slower than real-time
    """
    if audio_duration_sec <= 0:
        audio_duration_sec = 1.0
        
    rtf = latency_sec / audio_duration_sec
    speed_x = audio_duration_sec / latency_sec if latency_sec > 0 else float("inf")
    
    # Identify price rate
    key = model_name.lower().strip()
    cost_per_hour = API_COST_RATES_PER_HOUR.get(key)
    if cost_per_hour is None:
        # Fallback matching
        for k, rate in API_COST_RATES_PER_HOUR.items():
            if k in key:
                cost_per_hour = rate
                break
        if cost_per_hour is None:
            cost_per_hour = 0.30  # Default average fallback
            
    audio_hours = audio_duration_sec / 3600.0
    run_cost = audio_hours * cost_per_hour
    
    return {
        "audio_duration_sec": round(audio_duration_sec, 2),
        "latency_sec": round(latency_sec, 3),
        "rtf": round(rtf, 4),
        "speed_multiplier": f"{round(speed_x, 1)}x real-time" if speed_x < 1000 else "N/A",
        "cost_per_hour_usd": round(cost_per_hour, 4),
        "run_cost_usd": round(run_cost, 6),
    }
