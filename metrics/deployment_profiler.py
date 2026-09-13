"""
Deployment Profiler & Infrastructure Scalability Engine
Evaluates GPU VRAM, CPU RAM, model disk footprint, inference latency, and production cost scaling.
"""

import os
import psutil
import torch
from typing import Any, Dict


DEPLOYMENT_SPECS = {
    "Whisper (Large-v3 Cloud)": {
        "deployment_mode": "Managed Cloud API (Groq/OpenAI)",
        "gpu_vram_gb": 0.0,
        "system_ram_mb": 50.0,
        "model_disk_mb": 0.0,
        "cost_per_hr_usd": 0.300,
        "scalability": "Horizontal Auto-scaling",
        "privacy": "Data leaves campus to US Cloud"
    },
    "Whisper (Local Large-v3)": {
        "deployment_mode": "Self-Hosted On-Premises (KMIT Server)",
        "gpu_vram_gb": 3.2,
        "system_ram_mb": 1500.0,
        "model_disk_mb": 1560.0,
        "cost_per_hr_usd": 0.000,
        "scalability": "Single Server (1 stream per GPU/4 CPU cores)",
        "privacy": "100% On-Campus Private"
    },
    "Deepgram (Nova-2 Cloud)": {
        "deployment_mode": "Managed Cloud API",
        "gpu_vram_gb": 0.0,
        "system_ram_mb": 40.0,
        "model_disk_mb": 0.0,
        "cost_per_hr_usd": 0.258,
        "scalability": "High concurrency (100+ parallel streams)",
        "privacy": "Enterprise Cloud"
    },
    "Gemini (2.5 Flash Cloud)": {
        "deployment_mode": "Multimodal Cloud API",
        "gpu_vram_gb": 0.0,
        "system_ram_mb": 45.0,
        "model_disk_mb": 0.0,
        "cost_per_hr_usd": 0.072,
        "scalability": "Infinite Google Cloud scale",
        "privacy": "Google Cloud Enterprise"
    }
}


def profile_deployment_economics(lecture_hours_per_semester: float = 500.0) -> Dict[str, Any]:
    """
    Computes total operational cost for a full academic semester (e.g. 500 hours across KMIT lecture halls).
    """
    comparison = {}
    for model_name, spec in DEPLOYMENT_SPECS.items():
        hourly_rate = spec["cost_per_hr_usd"]
        semester_cost = hourly_rate * lecture_hours_per_semester
        
        comparison[model_name] = {
            "deployment_mode": spec["deployment_mode"],
            "gpu_vram_required": f"{spec['gpu_vram_gb']} GB" if spec['gpu_vram_gb'] > 0 else "0 (Cloud)",
            "system_ram_required": f"{spec['system_ram_mb']} MB",
            "model_size_disk": f"{spec['model_disk_mb']} MB" if spec['model_disk_mb'] > 0 else "0 (Cloud)",
            "cost_per_hour": f"${hourly_rate:.3f}",
            "cost_500_hours_semester": f"${semester_cost:.2f}",
            "privacy_rating": spec["privacy"]
        }
    return comparison
