import os
import requests
import dotenv
dotenv.load_dotenv()

print("--- Testing Ollama (quiz-expert:latest) ---")
try:
    res = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": "quiz-expert:latest",
            "prompt": "Respond with JSON: {\"status\": \"ollama_online\"}",
            "stream": False,
            "format": "json"
        },
        timeout=10
    )
    print("Ollama Response:", res.json().get("response"))
except Exception as e:
    print("Ollama Error:", e)

print("\n--- Testing Google GenAI (gemini-2.5-flash) ---")
try:
    from google import genai
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    resp = client.models.generate_content(
        model="gemini-2.5-flash",
        contents="Respond with JSON: {\"status\": \"gemini_online\"}"
    )
    print("Gemini Response:", resp.text)
except Exception as e:
    print("Gemini Error:", e)
