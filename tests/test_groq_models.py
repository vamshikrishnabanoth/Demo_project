import os, dotenv, requests
dotenv.load_dotenv()

groq_key = os.getenv("GROQ_API_KEY")

models_to_test = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.6-27b",
    "canopylabs/orpheus-v1-english",
    "allam-2-7b"
]

for m in models_to_test:
    print(f"Testing Groq model: {m}...")
    try:
        res = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
            json={"model": m, "messages": [{"role": "user", "content": "Respond: {\"status\": \"ok\"}"}]},
            timeout=10
        )
        print(f"  Status {res.status_code}:", res.text[:120])
    except Exception as e:
        print("  Exception:", e)
