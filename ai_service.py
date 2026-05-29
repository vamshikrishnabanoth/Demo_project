import json
import re
import random
import os
import sys
import base64

# Force UTF-8 output on Windows to avoid cp1252 UnicodeEncodeError with emoji/unicode chars
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
import tempfile
import numpy as np
import faiss
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import ast

# Extractors
import easyocr
import docx
from pptx import Presentation
from PyPDF2 import PdfReader

# -----------------------------
# 1. CONFIGURATION
# -----------------------------
OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "quiz-expert"

# Initialize RAG Engine (Phase 3)
print("Loading RAG Embedding Engine...")
embed_model = SentenceTransformer('all-MiniLM-L6-v2') 

# Initialize OCR
print("Loading OCR Engine...")
ocr_reader = easyocr.Reader(['en'])

# -----------------------------
# 2. RAG & EXTRACTION LOGIC
# -----------------------------
def extract_text_from_file(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    text = ""
    try:
        if ext in ['.jpg', '.jpeg', '.png']:
            text = " ".join(ocr_reader.readtext(file_path, detail=0))
        elif ext == '.docx':
            doc = docx.Document(file_path)
            text = "\n".join([p.text for p in doc.paragraphs])
        elif ext == '.pptx':
            prs = Presentation(file_path)
            for slide in prs.slides:
                for shape in slide.shapes:
                    if hasattr(shape, "text"): text += shape.text + "\n"
        elif ext == '.pdf':
            reader = PdfReader(file_path)
            for page in reader.pages:
                text += page.extract_text() or ""
    except Exception as e:
        print(f"Extraction Error: {e}")
    return text.strip()

def get_relevant_context(text, query, top_k=3):
    paragraphs = [p.strip() for p in text.split('\n\n') if len(p.strip()) > 100]
    if not paragraphs:
        paragraphs = [text[i:i+1000] for i in range(0, len(text), 800)]
    
    if len(paragraphs) <= top_k:
        return " ".join(paragraphs)

    embeddings = embed_model.encode(paragraphs)
    dimension = embeddings.shape[1]
    index = faiss.IndexFlatL2(dimension)
    index.add(np.array(embeddings).astype('float32'))
    
    query_emb = embed_model.encode([query])
    distances, indices = index.search(np.array(query_emb).astype('float32'), top_k)
    
    relevant_chunks = [paragraphs[i] for i in indices[0]]
    return " ".join(relevant_chunks)

# -----------------------------
# 3. FASTAPI SERVICE
# -----------------------------
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class GeneratorRequest(BaseModel):
    type: str # 'topic', 'pdf', 'docx', 'pptx', 'image'
    content: str 
    count: int = 5
    difficulty: str = "Medium"

def robust_json_loads(text):
    text = text.strip()
    
    # Strategy 1: Direct JSON load
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
        
    # Strategy 2: Extract Markdown block
    match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
    if match:
        extracted = match.group(1).strip()
        try:
            return json.loads(extracted)
        except json.JSONDecodeError:
            text = extracted # Use extracted for subsequent strategies

    # Strategy 3: Greedy brace/bracket extraction
    match_brace = re.search(r'({[\s\S]*})|(\[[\s\S]*\])', text)
    if match_brace:
        extracted = match_brace.group(0).strip()
        try:
            return json.loads(extracted)
        except json.JSONDecodeError:
            text = extracted # Use extracted for subsequent strategies

    # Strategy 4: Clean trailing commas
    try:
        cleaned = re.sub(r',\s*([\]}])', r'\1', text)
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Strategy 5: Python ast.literal_eval
    try:
        eval_text = text
        eval_text = re.sub(r'(?<![\'\"])\bnull\b(?![\'\"])', 'None', eval_text)
        eval_text = re.sub(r'(?<![\'\"])\btrue\b(?![\'\"])', 'True', eval_text)
        eval_text = re.sub(r'(?<![\'\"])\bfalse\b(?![\'\"])', 'False', eval_text)
        
        parsed = ast.literal_eval(eval_text)
        if isinstance(parsed, (dict, list)):
            return parsed
    except Exception:
        pass

    # Strategy 6: Heavy cleaning
    try:
        cleaned = text
        cleaned = re.sub(r"^'", '"', cleaned)
        cleaned = re.sub(r"'$", '"', cleaned)
        cleaned = re.sub(r"([{\[,:\s])'", r'\1"', cleaned)
        cleaned = re.sub(r"'([}\],:\s])", r'"\1', cleaned)
        cleaned = re.sub(r'([{,]\s*)([a-zA-Z0-9_]+)\s*:', r'\1"\2":', cleaned)
        cleaned = re.sub(r',\s*([\]}])', r'\1', cleaned)
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    raise json.JSONDecodeError("Failed to extract JSON from Ollama response.", text, 0)


# -----------------------------
# 4. CRITIC EVALUATOR
# -----------------------------
def critic_evaluate(q_text, q_opts, q_ans, topic, difficulty):
    """
    Sends a generated question to the critic LLM for quality evaluation.
    Returns (score: int 1-10, feedback: str).
    Falls back to score=7 if the critic itself fails, so generation isn't blocked.
    """
    options_str = "\n".join([f"  {chr(65+i)}) {opt}" for i, opt in enumerate(q_opts)])
    critic_prompt = (
        f"You are a strict quiz quality critic. Evaluate the quiz question below.\n\n"
        f"Topic: {topic}\n"
        f"Difficulty: {difficulty}\n\n"
        f"Question: {q_text}\n"
        f"Options:\n{options_str}\n"
        f"Correct Answer: {q_ans}\n\n"
        f"Rate this question from 1 to 10 based on:\n"
        f"1. Clarity       — Is the question unambiguous and well-worded?\n"
        f"2. Correctness   — Is the correct answer factually accurate?\n"
        f"3. Distractors   — Are the wrong options plausible but clearly incorrect?\n"
        f"4. Relevance     — Is it on-topic and appropriate for the difficulty level?\n\n"
        f"Return ONLY a JSON object with two keys:\n"
        f"  score    (integer, 1-10)\n"
        f"  feedback (one sentence explaining the rating)\n"
    )

    payload = {
        "model": MODEL_NAME,
        "prompt": critic_prompt,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.2,   # Low temp → consistent, deterministic critic
            "num_ctx": 1024
        }
    }

    try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=60)
        if response.status_code != 200:
            print(f"  [CRITIC]    Ollama returned HTTP {response.status_code} — defaulting score to 7.")
            return 7, "Critic unavailable, defaulting to pass."

        raw_text = response.json().get("response", "")
        data = robust_json_loads(raw_text)

        score = int(data.get("score", 7))
        score = max(1, min(10, score))   # Clamp to [1, 10]
        feedback = str(data.get("feedback", "No feedback provided."))
        return score, feedback

    except Exception as e:
        print(f"  [CRITIC]    Evaluation failed ({e}) — defaulting score to 7.")
        return 7, "Critic evaluation error, defaulting to pass."


@app.post("/generate")
async def generate_questions(req: GeneratorRequest):
    source_text = req.content
    
    if req.type in ['pdf', 'docx', 'pptx', 'image']:
        if os.path.exists(req.content):
            source_text = extract_text_from_file(req.content)
        elif req.content.startswith("base64:"):
            try:
                b64_data = req.content[7:]
                file_data = base64.b64decode(b64_data)
                ext = req.type if req.type != 'image' else 'png'
                with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
                    tmp.write(file_data)
                    tmp_path = tmp.name
                source_text = extract_text_from_file(tmp_path)
                os.remove(tmp_path)
            except Exception as e:
                raise HTTPException(status_code=400, detail="Invalid base64 file content.")
    
    if not source_text or len(source_text) < 2:
        raise HTTPException(status_code=400, detail="Content too short or file unreadable.")

    query = "Important core concepts" if req.type != 'topic' else req.content[:100]
    context = get_relevant_context(source_text, query, top_k=5)

    questions = []
    generated_so_far = ""
    CRITIC_THRESHOLD = 6  # Minimum score (out of 10) for a question to be accepted
    print(f"")
    print(f"={'='*55}")
    print(f"  [PIPELINE] Starting Generator-Critic Pipeline")
    print(f"  Target: {req.count} questions | Difficulty: {req.difficulty}")
    print(f"  Critic threshold: {CRITIC_THRESHOLD}/10")
    print(f"={'='*55}")
    print(f"")

    def is_duplicate(new_text, existing_questions):
        new_norm = re.sub(r'\s+', ' ', new_text.strip().lower())
        for q in existing_questions:
            old_norm = re.sub(r'\s+', ' ', q["questionText"].strip().lower())
            if new_norm == old_norm:
                return True
            # Keyword overlap check to catch slightly rephrased questions
            words_new = set(new_norm.split())
            words_old = set(old_norm.split())
            if words_new and words_old:
                overlap = len(words_new.intersection(words_old)) / max(len(words_new), len(words_old))
                if overlap > 0.8:
                    return True
        return False

    for i in range(req.count):
        question_success = False
        print(f"")
        print(f"  --- Question {i+1}/{req.count} ---")

        for attempt in range(3):
            try:
                # ── GENERATOR PHASE ──────────────────────────────────────
                history_clause = ""
                if generated_so_far:
                    history_clause = f"\nCRITICAL: You MUST focus on a completely new sub-topic or distinct educational concept. Do NOT repeat or cover the same concepts as these questions: {generated_so_far}."

                short_topic = req.content[:100].replace('\n', ' ') + "..." if len(req.content) > 100 else req.content
                prompt = f"Topic: {short_topic}\nDifficulty: {req.difficulty}\nContext: {context[:1500]}\nTask: Create question #{i+1} of {req.count}. {history_clause}\nReturn a SINGLE JSON object with keys: questionText, options (list of 4), correctAnswer."

                print(f"  [GENERATOR] Attempt {attempt+1}/3 — calling model '{MODEL_NAME}'...")

                use_json_format = (attempt == 0)
                payload = {
                    "model": MODEL_NAME,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "repeat_penalty": 1.15,
                        "num_ctx": 2048
                    }
                }
                if use_json_format:
                    payload["format"] = "json"

                response = requests.post(OLLAMA_URL, json=payload, timeout=120)

                if response.status_code != 200:
                    if use_json_format:
                        print(f"  [GENERATOR] Ollama returned {response.status_code} with format='json'. Retrying without format...")
                        payload.pop("format", None)
                        response = requests.post(OLLAMA_URL, json=payload, timeout=90)
                    if response.status_code != 200:
                        raise Exception(f"Ollama server returned HTTP {response.status_code}: {response.text}")

                raw_text = response.json().get("response", "")
                data = robust_json_loads(raw_text)

                # Normalize keys
                q_text = data.get("questionText") or data.get("question")
                q_opts = data.get("options") or data.get("choices")
                q_ans  = data.get("correctAnswer") or data.get("answer")

                if not (q_text and q_opts):
                    raise Exception("Extracted JSON missing 'questionText' or 'options' keys.")

                print(f"  [GENERATOR] Question draft ready: \"{str(q_text)[:80]}{'...' if len(str(q_text)) > 80 else ''}\"")

                # Duplicate check
                if is_duplicate(str(q_text), questions):
                    raise Exception(f"Duplicate question detected, will retry with different concept.")

                # ── CRITIC PHASE ──────────────────────────────────────────
                print(f"  [CRITIC]    Evaluating question quality...")
                critic_score, critic_feedback = critic_evaluate(
                    q_text=str(q_text),
                    q_opts=[str(o) for o in q_opts[:4]],
                    q_ans=str(q_ans),
                    topic=short_topic,
                    difficulty=req.difficulty
                )

                score_bar = "█" * critic_score + "░" * (10 - critic_score)
                print(f"  [CRITIC]    Score: {critic_score}/10  [{score_bar}]")
                print(f"  [CRITIC]    Feedback: {critic_feedback}")

                if critic_score < CRITIC_THRESHOLD:
                    print(f"  [REJECT]    Score {critic_score}/10 below threshold {CRITIC_THRESHOLD}/10 — regenerating...")
                    raise Exception(f"Critic rejected question with score {critic_score}/10: {critic_feedback}")

                # ── ACCEPT ───────────────────────────────────────────────
                questions.append({
                    "questionText": str(q_text),
                    "options": [str(o) for o in q_opts[:4]],
                    "correctAnswer": str(q_ans),
                    "points": 10,
                    "type": "multiple-choice"
                })
                generated_so_far += f" [{q_text}] "
                print(f"  [ACCEPT]    Question {len(questions)}/{req.count} accepted (score {critic_score}/10) ✓")
                question_success = True
                break

            except Exception as e:
                print(f"  [WARN]      Attempt {attempt+1}/3 failed: {e}")

        if not question_success:
            print(f"  [FAIL]      Could not generate a passing question {i+1} after 3 attempts — skipping.")

    print(f"")
    print(f"={'='*55}")
    print(f"  [PIPELINE] Done! Accepted {len(questions)}/{req.count} questions.")
    print(f"={'='*55}")
    print(f"")

    if not questions:
        raise HTTPException(status_code=500, detail="AI failed to generate any questions.")

    return {"questions": questions}

if __name__ == "__main__":
    print(f"AI Service starting on port 8000 using local model: {MODEL_NAME}")
    uvicorn.run(app, host="0.0.0.0", port=8000)

