"""
Unified LLM Engine for Pipeline Experiment.
Supports Groq high-speed models (openai/gpt-oss-120b, openai/gpt-oss-20b), Google GenAI, and Local Ollama.
Features 3s request pacing, 5-stage rate limit backoff retry, and strict Pydantic JSON schema parsing.
"""

import os
import time
import json
import re
import requests
from typing import Type, TypeVar, Optional
from pydantic import BaseModel
import dotenv

dotenv.load_dotenv()
_project_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_demo_env = os.path.join(_project_dir, ".env")
if os.path.exists(_demo_env):
    dotenv.load_dotenv(_demo_env)

T = TypeVar("T", bound=BaseModel)


class UnifiedLLMEngine:
    def __init__(
        self,
        provider: str = "groq",
        model: str = "openai/gpt-oss-120b",
        temperature: float = 0.2,
        max_tokens: int = 4096
    ):
        self.provider = provider
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        
        self.groq_api_key = os.getenv("GROQ_API_KEY", "")
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "") or os.getenv("GOOGLE_API_KEY", "")
        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.ollama_model = os.getenv("OLLAMA_MODEL", "quiz-expert:latest")

    def generate_text(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        json_mode: bool = False
    ) -> str:
        """
        Generates text strictly using the configured primary LLM model.
        Silent model fallbacks are strictly disabled to prevent experimental confounding.
        """
        if self.provider == "groq":
            if not self.groq_api_key:
                raise ValueError("GROQ_API_KEY is not configured.")
            return self._call_groq(prompt, system_prompt, json_mode)
        elif self.provider == "gemini":
            if not self.gemini_api_key:
                raise ValueError("GEMINI_API_KEY is not configured.")
            return self._call_gemini(prompt, system_prompt, json_mode)
        elif self.provider == "ollama":
            return self._call_ollama(prompt, system_prompt, json_mode)
        else:
            raise ValueError(f"Unsupported LLM provider: {self.provider}")

    def generate_pydantic(
        self,
        prompt: str,
        pydantic_class: Type[T],
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_retries: int = 2
    ) -> T:
        """
        Generates structured output validated strictly against the given Pydantic schema.
        """
        json_schema_str = json.dumps(pydantic_class.model_json_schema(), indent=2)
        enriched_system_prompt = (
            (system_prompt + "\n\n" if system_prompt else "")
            + f"CRITICAL REQUIREMENT: Output MUST be strictly valid JSON conforming exactly to this JSON schema:\n{json_schema_str}\n"
            + "Do NOT output markdown backticks, greetings, or explanations outside the JSON."
        )

        for attempt in range(max_retries + 1):
            raw_response = self.generate_text(
                prompt=prompt,
                system_prompt=enriched_system_prompt,
                json_mode=True
            )
            cleaned_json = self._extract_json_string(raw_response)
            try:
                import json_repair
                parsed_dict = json_repair.loads(cleaned_json)
                if isinstance(parsed_dict, list) and hasattr(pydantic_class, "model_fields"):
                    for field_name in ["topics", "questions", "targets", "slots"]:
                        if field_name in pydantic_class.model_fields:
                            parsed_dict = {field_name: parsed_dict}
                            break
                if isinstance(parsed_dict, dict):
                    return pydantic_class.model_validate(parsed_dict)
            except Exception as e:
                try:
                    parsed_dict = json.loads(cleaned_json)
                    if isinstance(parsed_dict, list) and hasattr(pydantic_class, "model_fields"):
                        for field_name in ["topics", "questions", "targets", "slots"]:
                            if field_name in pydantic_class.model_fields:
                                parsed_dict = {field_name: parsed_dict}
                                break
                    if isinstance(parsed_dict, dict):
                        return pydantic_class.model_validate(parsed_dict)
                except Exception as inner_e:
                    pass
            if attempt == max_retries:
                # Return empty instance if available or raise
                for field_name in ["topics", "questions", "targets"]:
                    if hasattr(pydantic_class, "model_fields") and field_name in pydantic_class.model_fields:
                        try:
                            return pydantic_class.model_validate({field_name: []})
                        except Exception:
                            pass
                raise ValueError(f"Failed to validate {pydantic_class.__name__} after {max_retries+1} attempts.\nRaw:\n{raw_response}")
            prompt = f"{prompt}\n\n[Previous attempt had schema validation error. Output strictly valid JSON conforming to schema.]"

    def _extract_json_string(self, text: str) -> str:
        text = text.strip()
        # 1. Clean LLM syntax glitches like "key",":", "value" or "key", : "value"
        text = re.sub(r'",\s*":\s*",\s*', r'": ', text)
        text = re.sub(r'",\s*":\s*', r'": ', text)
        text = re.sub(r'",\s*:\s*', r'": ', text)

        # 2. Sanitize misplaced closing braces before question metadata fields
        text = re.sub(r'\}\s*,\s*"(correct_option|explanation|target_concept|cognitive_level|what_taught|why_assessed|difficulty_level|evidence_refs|misconception_rationale)"', r',\n      "\1"', text)

        # 3. Check for outer ```json ... ``` code fence explicitly
        json_fence = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
        if json_fence:
            candidate = json_fence.group(1).strip()
            return candidate

        # 4. Find outermost JSON object braces { ... }
        start_obj = text.find("{")
        end_obj = text.rfind("}")
        if start_obj != -1 and end_obj != -1 and end_obj > start_obj:
            candidate = text[start_obj:end_obj+1]
            return candidate

        # 5. Find outermost JSON array braces [ ... ]
        start_arr = text.find("[")
        end_arr = text.rfind("]")
        if start_arr != -1 and end_arr != -1 and end_arr > start_arr:
            candidate = text[start_arr:end_arr+1]
            return candidate

        return text

    def _call_groq(
        self,
        prompt: str,
        system_prompt: Optional[str],
        json_mode: bool,
        fallback_model: Optional[str] = None,
        max_retries: int = 15
    ) -> str:
        model = fallback_model or self.model
        headers = {
            "Authorization": f"Bearer {self.groq_api_key}",
            "Content-Type": "application/json"
        }
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": model,
            "messages": messages,
            "temperature": self.temperature,
            "max_tokens": min(2500, self.max_tokens),
            "top_p": 0.9
        }
        if json_mode and not any(m in model.lower() for m in ["allam", "gpt-oss"]):
            payload["response_format"] = {"type": "json_object"}

        for attempt in range(max_retries):
            time.sleep(2.0)  # Polite pacing
            try:
                res = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload, timeout=60)
            except Exception as net_err:
                print(f"  [LLMEngine] Network error: {net_err}. Pausing 10s before retry ({attempt+1}/{max_retries})...", flush=True)
                time.sleep(10)
                continue

            if res.status_code in [413, 429]:
                err_msg = ""
                try:
                    err_msg = res.json().get("error", {}).get("message", "")
                except Exception:
                    pass
                
                # Dynamically parse wait time from Groq error if available
                import re
                m_sec = re.search(r"try again in ([\d\.]+)s", err_msg, re.IGNORECASE)
                m_ms = re.search(r"try again in ([\d\.]+)ms", err_msg, re.IGNORECASE)
                if m_sec:
                    wait_sec = max(2.0, float(m_sec.group(1)) + 1.5)
                elif m_ms:
                    wait_sec = max(1.5, (float(m_ms.group(1)) / 1000.0) + 1.0)
                else:
                    wait_sec = 60 if attempt >= 3 else (20 + (attempt * 10))

                print(f"  [LLMEngine] Groq {res.status_code} rate limit ({err_msg}). Pausing for {wait_sec:.1f}s before retry ({attempt+1}/{max_retries})...", flush=True)
                time.sleep(wait_sec)
                continue
            elif res.status_code == 400 and json_mode:
                print(f"  [LLMEngine] Groq 400 ({res.text[:150]}). Retrying without explicit response_format...", flush=True)
                payload.pop("response_format", None)
                time.sleep(2.0)
                continue
            elif res.status_code != 200:
                print(f"  [LLMEngine] Groq HTTP {res.status_code} Error: {res.text}", flush=True)
                res.raise_for_status()

            data = res.json()
            return data["choices"][0]["message"]["content"]

        raise RuntimeError("Groq failed after rate-limit backoff.")

    def _call_gemini(self, prompt: str, system_prompt: Optional[str], json_mode: bool) -> str:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=self.gemini_api_key)
        config = types.GenerateContentConfig(
            temperature=self.temperature,
            max_output_tokens=self.max_tokens,
            top_p=0.9
        )
        if system_prompt:
            config.system_instruction = system_prompt
        if json_mode:
            config.response_mime_type = "application/json"

        time.sleep(3.0)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=config
        )
        return response.text or ""

    def _is_ollama_available(self) -> bool:
        try:
            res = requests.get(f"{self.ollama_base_url}/api/tags", timeout=2.0)
            return res.status_code == 200
        except Exception:
            return False

    def _call_ollama(self, prompt: str, system_prompt: Optional[str], json_mode: bool) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.ollama_model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": self.temperature, "top_p": 0.9}
        }
        if json_mode:
            payload["format"] = "json"

        res = requests.post(f"{self.ollama_base_url}/api/chat", json=payload, timeout=300)
        res.raise_for_status()
        data = res.json()
        return data["message"]["content"]
