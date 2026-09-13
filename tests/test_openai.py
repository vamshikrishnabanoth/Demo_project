import os, dotenv, requests
dotenv.load_dotenv()

openai_key = os.getenv("OPENAI_API_KEY")
print("Testing OpenAI API...")
try:
    res = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"},
        json={"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "Respond: {\"status\": \"ok\"}"}]},
        timeout=10
    )
    print("OpenAI Response Code:", res.status_code)
    if res.status_code == 200:
        print("OpenAI Success:", res.json()["choices"][0]["message"]["content"])
    else:
        print("OpenAI Error:", res.text)
except Exception as e:
    print("OpenAI Exception:", e)
