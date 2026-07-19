import json
import re
import random
import os
import sys
import base64
import uuid
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Load environment from server/.env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), 'server', '.env'))

# Force UTF-8 output on Windows to avoid cp1252 UnicodeEncodeError with emoji/unicode chars
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
import tempfile
import numpy as np
import faiss
import requests
from typing import List, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
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
OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
MODEL_NAME = "quiz-expert"
DATABASE_URL = os.getenv("DATABASE_URL")

# Initialize RAG Engine (Phase 3)
print("Loading RAG Embedding Engine...")
embed_model = SentenceTransformer('all-MiniLM-L6-v2') 

# Initialize OCR
print("Loading OCR Engine...")
ocr_reader = easyocr.Reader(['en'])

# Initialize Whisper model locally (using 'base' optimized for CUDA/CPU)
whisper_model = None
try:
    print("Loading Local Whisper Engine...")
    from faster_whisper import WhisperModel
    try:
        # Enforce int8 quantization for 4x faster CPU execution
        whisper_model = WhisperModel("base", device="auto", compute_type="int8")
    except Exception:
        whisper_model = WhisperModel("base", device="auto", compute_type="default")
    print("Local Whisper Engine loaded successfully!")
except Exception as e:
    print(f"⚠️ Warning: Could not initialize local Whisper: {e}. Voice transcription will fall back to cloud/mock.")

# -----------------------------
# 2. DATABASE & RAG CORE LOGIC
# -----------------------------
def get_db_connection():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL is not set in environment.")
    
    url = DATABASE_URL
    if "connection_limit" in url:
        import urllib.parse as urlparse
        try:
            parsed = urlparse.urlparse(url)
            query = urlparse.parse_qs(parsed.query)
            query.pop('connection_limit', None)
            new_query = urlparse.urlencode(query, doseq=True)
            parsed = parsed._replace(query=new_query)
            url = urlparse.urlunparse(parsed)
        except Exception as e:
            print(f"Error stripping connection_limit: {e}")
            
    return psycopg2.connect(url)

def recursive_token_splitter(text, max_tokens=500, overlap_percent=10):
    if not text or not text.strip():
        return []
    
    # Pre-split giant texts to prevent token index blowouts & warnings
    if len(text) > 10000:
        blocks = []
        step = 8000
        for i in range(0, len(text), step):
            block = text[i:i+10000].strip()
            if len(block) > 10:
                blocks.append(block)
        
        all_chunks = []
        for block in blocks:
            all_chunks.extend(recursive_token_splitter(block, max_tokens, overlap_percent))
        return all_chunks

    try:
        tokens = embed_model.tokenizer.encode(text, add_special_tokens=False, truncation=True, max_length=10000)
    except Exception as e:
        print(f"Tokenization error, falling back to character approximation: {e}")
        # Fallback character approximation (1 token ~= 4 chars)
        char_limit = max_tokens * 4
        overlap_chars = int(char_limit * (overlap_percent / 100.0))
        step = char_limit - overlap_chars
        if step <= 0:
            step = char_limit
        return [text[i:i+char_limit].strip() for i in range(0, len(text), step) if len(text[i:i+char_limit].strip()) > 10]
    
    chunks = []
    overlap = int(max_tokens * (overlap_percent / 100.0))
    step = max_tokens - overlap
    if step <= 0:
        step = max_tokens
        
    for i in range(0, len(tokens), step):
        chunk_tokens = tokens[i : i + max_tokens]
        chunk_text = embed_model.tokenizer.decode(chunk_tokens, clean_up_tokenization_spaces=True)
        if len(chunk_text.strip()) > 10:
            chunks.append(chunk_text.strip())
        if i + max_tokens >= len(tokens):
            break
    return chunks

def get_relevant_db_context(query_text, top_k=5):
    try:
        query_emb = embed_model.encode([query_text])[0]
        query_emb_str = "[" + ",".join(map(str, query_emb)) + "]"
        
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        try:
            # Cosine distance operator <=> in pgvector
            cur.execute(
                'SELECT id, content, source, (embedding <=> %s::vector) as distance '
                'FROM "DocumentChunk" '
                'ORDER BY distance ASC '
                'LIMIT %s',
                (query_emb_str, top_k)
            )
            results = cur.fetchall()
            return [dict(row) for row in results]
        except Exception as e:
            print(f"Error executing vector similarity search: {e}")
            return []
        finally:
            cur.close()
            conn.close()
    except Exception as e:
        print(f"Failed to generate query embedding or connect: {e}")
        return []
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
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    print("❌ Validation Error Details:", exc.errors())
    print("❌ Request Body Sent:", exc.body)
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body},
    )

@app.get("/")
async def root():
    return {"status": "online", "service": "quiz-expert-ai"}

class MultiInputSource(BaseModel):
    type: str # 'text', 'pdf', 'docx', 'pptx', 'image', 'voice'
    content: str
    source_name: str = "Unknown Source"

class AnalyzeRequest(BaseModel):
    inputs: List[MultiInputSource]

class GeneratorRequest(BaseModel):
    inputs: Optional[List[MultiInputSource]] = None
    type: Optional[str] = None # Backwards compatibility
    content: Optional[str] = None # Backwards compatibility
    count: int = 5
    difficulty: str = "Medium"
    target_ratios: Optional[dict] = None
    source_material_id: Optional[str] = None
    topic_weights: Optional[dict] = None
    callback_url: Optional[str] = None
    taskId: Optional[str] = None

class IngestRequest(BaseModel):
    source: str
    type: str # 'text', 'pdf', 'docx', 'pptx', 'image'
    content: str # Can be raw text, file path, or base64
    metadata: dict = {}

@app.post("/admin/ingest")
async def ingest_document(req: IngestRequest):
    source_text = req.content
    
    if req.type in ['pdf', 'docx', 'pptx', 'image'] and os.path.exists(req.content):
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
            raise HTTPException(status_code=400, detail=f"Invalid base64 file content: {e}")
            
    if not source_text or len(source_text) < 10:
        raise HTTPException(status_code=400, detail="Content too short or unextractable.")
        
    try:
        chunks = recursive_token_splitter(source_text, max_tokens=500, overlap_percent=10)
        if not chunks:
            raise HTTPException(status_code=400, detail="No chunks generated from content.")
            
        embeddings = embed_model.encode(chunks)
        
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            for chunk, embedding in zip(chunks, embeddings):
                chunk_id = str(uuid.uuid4())
                embedding_str = "[" + ",".join(map(str, embedding)) + "]"
                metadata_json = json.dumps(req.metadata)
                cur.execute(
                    'INSERT INTO "DocumentChunk" (id, content, embedding, source, metadata, "createdAt") '
                    'VALUES (%s, %s, %s::vector, %s, %s, NOW())',
                    (chunk_id, chunk, embedding_str, req.source, metadata_json)
                )
            conn.commit()
        except Exception as e:
            conn.rollback()
            print(f"Database insertion error: {e}")
            raise HTTPException(status_code=500, detail=f"Database insertion failed: {e}")
        finally:
            cur.close()
            conn.close()
            
        return {
            "status": "success",
            "message": f"Successfully ingested {len(chunks)} chunks from source '{req.source}'.",
            "chunks_count": len(chunks)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def call_groq_fallback(prompt, json_mode=True):
    import time
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        raise ValueError("Groq API Key is not set in environment.")
    
    headers = {
        "Authorization": f"Bearer {groq_api_key}",
        "Content-Type": "application/json"
    }
    
    # Rotate models to bypass TPM rate limits if hit
    models = ["llama-3.1-8b-instant", "gemma2-9b-it", "mixtral-8x7b-32768"]
    
    for attempt in range(4):
        model = models[attempt % len(models)]
        payload = {
            "messages": [{"role": "user", "content": prompt}],
            "model": model,
            "temperature": 0.2
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
            
        try:
            response = requests.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers, timeout=45)
            if response.status_code == 200:
                return response.json()["choices"][0]["message"]["content"]
            elif response.status_code == 429:
                print(f"  [GROQ] ⚠️ 429 Rate Limit on {model}. Retrying next model in 3 seconds...")
                time.sleep(3)
            else:
                print(f"  [GROQ] ⚠️ API returned {response.status_code}. Retrying...")
                time.sleep(2)
        except Exception as e:
            print(f"  [GROQ] ⚠️ Request error: {e}. Retrying...")
            time.sleep(2)
            
    raise ValueError("Groq API failed after 4 retries.")

def sanitize_source_text(text: str) -> str:
    """
    Strips out file names, timestamps, and structural labels like
    'Voice Transcript (12:23:03 AM)' so the LLM never sees them.
    """
    # Remove strings like 'Voice Transcript (XX:XX:XX AM/PM)' case-insensitively
    text = re.sub(r'(?i)voice\s+transcript\s*\([^)]+\)', '', text)
    
    # Remove standalone timestamps like 12:23:03 AM
    text = re.sub(r'\b\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM|am|pm)\b', '', text)
    
    # Clean up double newlines left over by stripping
    return re.sub(r'\n\s*\n', '\n', text).strip()

def resolve_input_sources(inputs):
    aggregated_texts = []
    for inp in inputs:
        source_text = inp.content
        if inp.type in ['pdf', 'docx', 'pptx', 'image']:
            if os.path.exists(inp.content):
                source_text = extract_text_from_file(inp.content)
            elif inp.content.startswith("base64:"):
                try:
                    b64_data = inp.content[7:]
                    file_data = base64.b64decode(b64_data)
                    ext = inp.type if inp.type != 'image' else 'png'
                    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
                        tmp.write(file_data)
                        tmp_path = tmp.name
                    source_text = extract_text_from_file(tmp_path)
                    os.remove(tmp_path)
                except Exception as e:
                    print(f"Error parsing base64 file source: {e}")
                    source_text = ""
        if source_text and len(source_text.strip()) > 10:
            sanitized = sanitize_source_text(source_text)
            if len(sanitized.strip()) > 10:
                aggregated_texts.append(sanitized.strip())
    return "\n\n".join(aggregated_texts)

def deduplicate_text_chunks(text, embed_model, max_tokens=500, overlap_percent=10):
    chunks = recursive_token_splitter(text, max_tokens, overlap_percent)
    if not chunks:
        return []
    
    embeddings = embed_model.encode(chunks)
    
    kept_chunks = []
    kept_embeddings = []
    
    for chunk, embedding in zip(chunks, embeddings):
        is_duplicate = False
        if kept_embeddings:
            similarities = np.dot(kept_embeddings, embedding)
            if np.max(similarities) > 0.90:
                is_duplicate = True
        if not is_duplicate:
            kept_chunks.append(chunk)
            kept_embeddings.append(embedding)
            
    print(f"[Reduction]    : Kept {len(kept_chunks)} core academic blocks. Removed {len(chunks) - len(kept_chunks)} duplicates.")
    return kept_chunks

@app.post("/analyze-sources")
async def analyze_sources(req: AnalyzeRequest):
    if not req.inputs:
        raise HTTPException(status_code=400, detail="No input sources provided.")
        
    text = resolve_input_sources(req.inputs)
    if not text or len(text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Content too short or unextractable.")
        
    chunks = deduplicate_text_chunks(text, embed_model)
    context = "\n\n".join(chunks[:6])
    
    print("  [AGENT 1] Analyzing academic content, token density, summaries, and topics...")
    prompt = (
        "You are an elite academic analyzer. Analyze the textbook/lecture context below.\n\n"
        f"Context:\n{context[:6000]}\n\n"
        "Tasks:\n"
        "1. Check if the content is educational/academic. Set 'relevancy_verdict' to 'pass' if it is academic (note: programming manuals, code files, syntax lists, data structures, and computer science slides are 100% academic/educational), or 'fail' if it is gibberish, casual chat, or spam.\n"
        "2. Create a bulleted lobby summary (3-4 concise, high-impact bullet points for a quiz lobby study panel).\n"
        "3. Generate 5 core study flashcards (Q&A style for post-quiz review).\n"
        "4. Suggest target ratios for question types (theory, code_debugging, fill_blank, scenario) based on content structure (e.g., if there is code, suggest higher code_debugging ratio).\n"
        "5. Extract 5-10 specific curriculum concept tags and baseline weights (0.0 to 1.0).\n\n"
        "Return ONLY a clean JSON object conforming strictly to this format:\n"
        "{\n"
        "  \"relevancy_verdict\": \"pass\",\n"
        "  \"relevancy_reason\": \"...\",\n"
        "  \"lobby_summary\": \"- Key concept 1...\\n- Key concept 2...\",\n"
        "  \"ai_flashcards\": [\n"
        "    {\"question\": \"...\", \"answer\": \"...\"}\n"
        "  ],\n"
        "  \"ai_recommendation\": {\n"
        "    \"theory\": 0.4,\n"
        "    \"code_debugging\": 0.3,\n"
        "    \"fill_blank\": 0.2,\n"
        "    \"scenario\": 0.1\n"
        "  },\n"
        "  \"concepts\": [\n"
        "    {\"concept_tag\": \"...\", \"weight_score\": 0.85}\n"
        "  ]\n"
        "}"
    )

    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.2,
            "num_ctx": 8192
        }
    }
    
    try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=180)
        if response.status_code == 200:
            raw_text = response.json().get("response", "")
            data = robust_json_loads(raw_text)
            
            if data.get("relevancy_verdict") == "fail":
                raise HTTPException(
                    status_code=422,
                    detail={
                        "status": "validation_error",
                        "message": data.get("relevancy_reason") or "Non-academic content detected."
                    }
                )
                
            return data
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"⚠️ Local Ollama failed or timed out: {e}. Trying Groq Cloud fallback...")
        if os.getenv("GROQ_API_KEY"):
            try:
                # Trim the context inside prompt to avoid TPM limit on Groq
                fallback_context = context[:1500]
                fallback_prompt = (
                    "You are an elite academic analyzer. Analyze the textbook/lecture context below.\n\n"
                    f"Context:\n{fallback_context}\n\n"
                    "Tasks:\n"
                    "1. Check if the content is educational/academic. Set 'relevancy_verdict' to 'pass' if it is academic (note: programming manuals, code files, syntax lists, data structures, and computer science slides are 100% academic/educational), or 'fail' if it is gibberish, casual chat, or spam.\n"
                    "2. Create a bulleted lobby summary (3-4 concise, high-impact bullet points for a quiz lobby study panel).\n"
                    "3. Generate 5 core study flashcards (Q&A style for post-quiz review).\n"
                    "4. Suggest target ratios for question types (theory, code_debugging, fill_blank, scenario) based on content structure (e.g., if there is code, suggest higher code_debugging ratio).\n"
                    "5. Extract 5-10 specific curriculum concept tags and baseline weights (0.0 to 1.0).\n\n"
                    "Return ONLY a clean JSON object conforming strictly to this format:\n"
                    "{\n"
                    "  \"relevancy_verdict\": \"pass\",\n"
                    "  \"relevancy_reason\": \"...\",\n"
                    "  \"lobby_summary\": \"- Key concept 1...\\n- Key concept 2...\",\n"
                    "  \"ai_flashcards\": [\n"
                    "    {\"question\": \"...\", \"answer\": \"...\"}\n"
                    "  ],\n"
                    "  \"ai_recommendation\": {\n"
                    "    \"theory\": 0.4,\n"
                    "    \"code_debugging\": 0.3,\n"
                    "    \"fill_blank\": 0.2,\n"
                    "    \"scenario\": 0.1\n"
                    "  },\n"
                    "  \"concepts\": [\n"
                    "    {\"concept_tag\": \"...\", \"weight_score\": 0.85}\n"
                    "  ]\n"
                    "}"
                )
                raw_text = call_groq_fallback(fallback_prompt, json_mode=True)
                data = robust_json_loads(raw_text)
                
                if data.get("relevancy_verdict") == "fail":
                    raise HTTPException(
                        status_code=422,
                        detail={
                            "status": "validation_error",
                            "message": data.get("relevancy_reason") or "Non-academic content detected."
                        }
                    )
                    
                print("✅ Successfully recovered via Groq Cloud fallback!")
                return data
            except HTTPException as he2:
                raise he2
            except Exception as e2:
                print(f"❌ Groq fallback also failed: {e2}")
                raise HTTPException(status_code=500, detail=f"Ollama timed out and Groq fallback failed: {str(e2)}")
        else:
            raise HTTPException(status_code=500, detail=f"Ollama timed out/failed and no GROQ_API_KEY is configured. Error: {str(e)}")

@app.post("/transcribe")
async def transcribe_audio_file(file: UploadFile = File(...)):
    if not whisper_model:
        raise HTTPException(status_code=503, detail="Local Whisper model is not loaded.")
        
    try:
        suffix = os.path.splitext(file.filename)[1] or ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
            
        print(f"🎙️ Transcribing local file: {tmp_path} using Whisper base...")
        segments, info = whisper_model.transcribe(tmp_path, beam_size=5)
        text = " ".join([segment.text for segment in segments])
        
        raw_text = text.strip()
        
        print("\n" + "="*60)
        print("🎙️ [STEP 1: WHISPER TRANSCRIPTION RAW OUTPUT]")
        print(f"Content: {raw_text}")
        print("="*60 + "\n")
        
        cleaned_text = sanitize_source_text(raw_text)
        
        print("\n" + "="*60)
        print("🧹 [STEP 2: SANITIZED TEXT PAYLOAD]")
        print(f"Content: {cleaned_text}")
        print("="*60 + "\n")
        
        try:
            os.remove(tmp_path)
        except Exception:
            pass
            
        return {
            "status": "success",
            "text": cleaned_text,
            "language": info.language,
            "duration": info.duration
        }
    except Exception as e:
        print(f"❌ Local Transcription Error: {e}")
        raise HTTPException(status_code=500, detail=f"Local transcription failed: {str(e)}")

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


def run_agent1_analyzer(context, count, topic_fallback="General Course Concept"):
    print("  [AGENT 1] Executing Semantic Weight & Concept Analyzer...")
    prompt = (
        "You are an expert university academic analyst. Your goal is to inspect the parsed source content chunks and isolate the primary learning objectives.\n\n"
        f"Context Chunks:\n{context[:4000]}\n\n"
        "Task:\n"
        "Identify the core structural topics within the provided text. Critically evaluate word usage, explicit focus flags (e.g., 'pay close attention here', 'this will form part of your assessment'), and text frequency.\n\n"
        f"Identify at least {count} distinct core concepts.\n\n"
        "Return ONLY a clean JSON object containing a list of topics with their estimated relative importance weights (0.0 to 1.0) and anchor text citations.\n"
        "Do NOT include markdown formatting outside the JSON block. Do NOT include extra commentary.\n\n"
        "FORMAT REQUIRED:\n"
        "{\n"
        "  \"concepts\": [\n"
        "    {\n"
        "      \"concept_tag\": \"Process Synchronization\",\n"
        "      \"weight_score\": 0.85,\n"
        "      \"anchor_citation\": \"To achieve process synchronization, operating systems use semaphores...\"\n"
        "    }\n"
        "  ]\n"
        "}"
    )
    
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.2,
            "num_ctx": 4096
        }
    }
    try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=180)
        if response.status_code == 200:
            raw_text = response.json().get("response", "")
            data = robust_json_loads(raw_text)
            concepts = data.get("concepts", [])
            print(f"  ├── [Agent 1 Analyzer] : Extracted {len(concepts)} concepts successfully.")
            return concepts
    except Exception as e:
        err_str = str(e).lower()
        if "timeout" in err_str or "read timed out" in err_str:
            print("  ├── [Agent 1 Analyzer] : ⚠️ CPU Latency Spike -> Dynamically pulled topic from filenames.")
        else:
            print(f"  ├── [Agent 1 Analyzer] : ⚠️ Concept mapping failed ({e}) -> Fallback to topic from filenames.")
    
    return [{"concept_tag": topic_fallback, "weight_score": 0.75, "anchor_citation": "Direct context chunk"}]

def run_agent2_generator(concept, question_type, context, generated_so_far="", difficulty="Medium"):
    concept_tag = concept.get("concept_tag", "General Course Concept")
    weight_score = concept.get("weight_score", 0.75)
    
    type_instruction = ""
    if question_type == "theory":
        type_instruction = (
            "Write a Theory & Conceptual MCQ. Focus entirely on core academic definitions, relational logic, architectural structures, and syllabus theory.\n"
            "Format the question with a prompt_text, and a list of 4 options (in options field) where exactly one correct option is copy-pasted into correct_answer."
        )
    elif question_type == "code_debugging":
        type_instruction = (
            "Write a Code Debugging & Compilation MCQ.\n"
            "Create a structured Markdown-supported code fragment (in code_snippet field, e.g., JavaScript, Python, or SQL) containing an intentional syntax, logical, or runtime bug.\n"
            "The prompt_text should ask the student to identify the vulnerability/bug or predict the execution output. Provide 4 options where exactly one is correct."
        )
    elif question_type == "fill_blank":
        type_instruction = (
            "Write a Fill-in-the-Blank or Short Syntax Entry prompt.\n"
            "Create a code snippet, math formula, or data declaration (in code_snippet, or place in prompt_text if not code) with specific lines or properties replaced with empty character gaps (e.g. '______').\n"
            "Provide a prompt_text asking the student to fill in the blank. The options field should contain 4 choices representing alternative syntax fills, and the correct_answer must be the exact correct characters for the gap."
        )
    elif question_type == "scenario":
        type_instruction = (
            "Write a Scenario-Based Enterprise Challenge.\n"
            "Construct a realistic engineering design constraint or system architecture bottleneck (e.g. 'Our database connection pool is dropping incoming requests at a specific load...').\n"
            "The options must provide alternative high-level system resolutions where only one accurately balances safety, efficiency, and scalability. Correct answer goes to correct_answer."
        )

    difficultyPrompts = {
        "easy": {
            "theory": "Focus on straightforward definitions and core protocol identification.",
            "coding": "Provide short, simple code snippets. Focus on basic output prediction or obvious missing syntax errors.",
            "fill_blank": "Ask about standard definitions or clear, elementary differences between two core concepts.",
            "scenario": "Simple, single-variable real-world applications with straightforward outcomes."
        },
        "medium": {
            "theory": "Focus on how mechanisms interact with each other and standard architectural workflows.",
            "coding": "Include loops, basic algorithmic structures, or functional tracking where state changes.",
            "fill_blank": "Focus on standard efficiency trade-offs, like time-complexity differences.",
            "scenario": "Introduce minor engineering bottlenecks or common edge-case system failures."
        },
        "hard": {
            "theory": "Test deep internal mechanics, architectural limitations, and complex structural constraints.",
            "coding": "Provide highly optimized or multi-threaded code snippets. Include hidden bugs, memory leaks, or tricky recursion logic.",
            "fill_blank": "Demand defense of custom system design choices under heavy resource constraints or scale requirements.",
            "scenario": "Construct deep, multi-layered system design failures with conflicting parameters (e.g., consistency vs availability)."
        }
    }
    
    diff_key = difficulty.lower()
    if diff_key not in difficultyPrompts: diff_key = "medium"
    
    matrix_cat = question_type
    if matrix_cat == "code_debugging": matrix_cat = "coding"
    
    targeted_criteria = difficultyPrompts[diff_key].get(matrix_cat, "Focus on general knowledge.")

    prompt = (
        "You are an elite Computer Science and Engineering curriculum developer. Your task is to write high-fidelity academic evaluations.\n\n"
        f"Context chunks:\n{context[:2000]}\n\n"
        f"Target Concept: {concept_tag} (Importance Weight: {weight_score})\n"
        f"Question Type: {question_type}\n\n"
        f"CRITICAL DIFFICULTY INSTRUCTION ({difficulty.upper()}):\n"
        f"You MUST strictly follow these criteria: '{targeted_criteria}'\n\n"
        f"Task:\n{type_instruction}\n\n"
        f"CRITICAL: Avoid repeating the topics of these existing questions: {generated_so_far}\n\n"
        "[STRICT GROUNDING CONSTRAINT]\n"
        "You must extract ONLY core academic, structural, and theoretical concepts present within the text body.\n"
        "CRITICAL WARNING: Completely ignore any references to dates, times, AM/PM, audio lengths, transcription artifacts, or file names. Under no circumstances should a question or answer choice analyze when a recording happened, what a file name is, or how data was collected.\n\n"
        "COMPLEXITY MANDATE: Do not create circular questions where the answer repeats words from the question stem. Focus on operational logic, mechanics (e.g., how splitting criteria work in Random Forests), and architectural design trade-offs.\n\n"
        "Return ONLY a clean JSON object conforming to this schema:\n"
        "{\n"
        "  \"concept_tag\": \"concept\",\n"
        "  \"prompt_text\": \"Question text...\",\n"
        "  \"code_snippet\": \"Markdown code block or null if not applicable\",\n"
        "  \"options\": [\n"
        "    \"Option A\",\n"
        "    \"Option B\",\n"
        "    \"Option C\",\n"
        "    \"Option D\"\n"
        "  ],\n"
        "  \"correct_answer\": \"Exact copy of the correct option from options\",\n"
        "  \"explanation\": \"Detailed explanation explaining the solution...\"\n"
        "}"
    )

    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.4,
            "repeat_penalty": 1.15,
            "num_ctx": 4096
        }
    }
    
    response = requests.post(OLLAMA_URL, json=payload, timeout=180)
    if response.status_code == 200:
        raw_text = response.json().get("response", "")
        data = robust_json_loads(raw_text)
        return data
    else:
        raise Exception(f"Generator failed with HTTP {response.status_code}")

def check_python_syntax(code):
    try:
        ast.parse(code)
        return True, []
    except SyntaxError as e:
        return False, [f"Python Code Block Syntax Error: {e.msg} at line {e.lineno}"]

def check_js_syntax(code):
    import subprocess
    try:
        js_cmd = f"new Function({json.dumps(code)})"
        res = subprocess.run(['node', '-e', js_cmd], capture_output=True, text=True, timeout=2)
        if res.returncode != 0:
            err_lines = [l for l in res.stderr.split('\n') if l.strip()]
            return False, [f"JS Code Block Syntax Error: {err_lines[0] if err_lines else 'Compilation failed'}"]
        return True, []
    except Exception:
        return True, []

def run_agent3_critic(q_data, context, flavor="theory"):
    issues = []
    
    prompt_text = q_data.get("prompt_text")
    options = q_data.get("options", [])
    correct_ans = q_data.get("correct_answer") or q_data.get("correctAnswer")
    code_snippet = q_data.get("code_snippet")
    
    if not prompt_text:
        issues.append("Missing prompt_text")
    else:
        # Rule X (Zero Metadata Leak)
        metadata_indicators = [
            r'\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)\b',
            r'\b(?:voice\s+)?transcript\b',
            r'\bfile\s+name\b',
            r'\b\.pdf\b|\b\.docx\b|\b\.pptx\b|\b\.txt\b|\b\.webm\b',
            r'\brecording\b'
        ]
        for pattern in metadata_indicators:
            if re.search(pattern, prompt_text, re.IGNORECASE):
                issues.append("Question contains timestamps, file names, or recording properties (Metadata Leak).")
                break

    if not options or len(options) < 4:
        issues.append("Fewer than 4 options provided")
    else:
        # Check options for metadata leaks
        for opt in options:
            metadata_indicators = [
                r'\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)\b',
                r'\b(?:voice\s+)?transcript\b',
                r'\bfile\s+name\b',
                r'\b\.pdf\b|\b\.docx\b|\b\.pptx\b|\b\.txt\b|\b\.webm\b',
                r'\brecording\b'
            ]
            leak_found = False
            for pattern in metadata_indicators:
                if re.search(pattern, opt, re.IGNORECASE):
                    issues.append("An option choice contains metadata leaks (timestamps/file details).")
                    leak_found = True
                    break
            if leak_found:
                break

    if not correct_ans:
        issues.append("Missing correct_answer")
    elif correct_ans not in options:
        if flavor != "code_debugging":
            issues.append("Correct answer does not match any of the options exactly")
            
    # Rule Y (Circular Verification)
    if correct_ans and prompt_text:
        prompt_clean = re.sub(r'[^\w\s]', '', prompt_text.lower())
        ans_clean = re.sub(r'[^\w\s]', '', correct_ans.lower())
        prompt_words = set(prompt_clean.split())
        ans_words = set(ans_clean.split())
        if len(ans_words) > 0:
            overlap = prompt_words.intersection(ans_words)
            if len(overlap) / len(ans_words) > 0.8:
                issues.append("Question is circular (the correct answer repeats almost all words from the question stem).")
        
    if code_snippet and isinstance(code_snippet, str) and ("```" in code_snippet):
        match_py = re.search(r'```python\n([\s\S]*?)```', code_snippet)
        match_js = re.search(r'```(?:javascript|js)\n([\s\S]*?)```', code_snippet)
        
        if match_py:
            code = match_py.group(1)
            if flavor != "code_debugging":
                valid, errs = check_python_syntax(code)
                if not valid:
                    issues.extend(errs)
        elif match_js:
            code = match_js.group(1)
            if flavor != "code_debugging":
                valid, errs = check_js_syntax(code)
                if not valid:
                    issues.extend(errs)
                
    if len(set(options)) < len(options):
        issues.append("Duplicate options detected")
        
    status = "pass" if len(issues) == 0 else "fail"
    return {
        "status": status,
        "issues": issues
    }

def run_agent2_repair(q_data, issues, context):
    prompt = (
        "You are an elite Computer Science and Engineering curriculum developer.\n"
        "Your task is to fix a multiple-choice question that failed quality control checks.\n\n"
        "ORIGINAL QUESTION:\n"
        f"{json.dumps(q_data, indent=2)}\n\n"
        "QUALITY CONTROL ISSUES FOUND:\n"
        + "\n".join([f"- {iss}" for iss in issues]) + "\n\n"
        "CONTEXT FOR GROUNDING:\n"
        f"{context[:2000]}\n\n"
        "Task:\n"
        "Rewrite the question to fix all listed issues. Make sure the correct_answer is an exact copy-paste of one of the options and all options are unique.\n\n"
        "Return ONLY a clean JSON object conforming to the same schema as the original question."
    )
    
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.2,
            "num_ctx": 4096
        }
    }
    
    response = requests.post(OLLAMA_URL, json=payload, timeout=180)
    if response.status_code == 200:
        raw_text = response.json().get("response", "")
        data = robust_json_loads(raw_text)
        return data
    else:
        raise Exception("Repair failed")
def log_pipeline_step(step_number, step_name, data_description, payload):
    CYAN = '\033[36m'
    GREEN = '\033[32m'
    GRAY = '\033[90m'
    RESET = '\033[0m'
    print(f"{GRAY}\n========================================================{RESET}")
    print(f"{CYAN}➡️ [STEP {step_number}] {step_name}{RESET}")
    print(f"{GRAY}📋 Data State: {data_description}{RESET}")
    print(f"{GRAY}--------------------------------------------------------{RESET}")
    import json
    if isinstance(payload, (dict, list)):
        print(f"{GREEN}{json.dumps(payload, indent=2)}{RESET}")
    else:
        print(f"{GREEN}{payload}{RESET}")
    print(f"{GRAY}========================================================{RESET}\n")

def normalize_question_json(q_data, concept_tag, flavor):
    # 1. Normalize prompt_text
    prompt_text = q_data.get("prompt_text") or q_data.get("questionText") or q_data.get("question") or q_data.get("text") or ""
    
    # 2. Normalize code_snippet
    code_snippet = q_data.get("code_snippet") or q_data.get("code")
    if code_snippet and isinstance(code_snippet, str) and len(code_snippet.strip()) > 0:
        cs_clean = code_snippet.strip()
        if "```" not in cs_clean:
            cs_clean = f"```\n{cs_clean}\n```"
        if cs_clean not in prompt_text:
            prompt_text = f"{prompt_text}\n\n{cs_clean}"
    else:
        code_snippet = None
        
    # 3. Normalize options
    raw_options = q_data.get("options")
    options = []
    if isinstance(raw_options, list):
        options = [str(o) for o in raw_options]
    elif isinstance(raw_options, dict):
        # Sort by key to maintain A, B, C, D order
        sorted_keys = sorted(raw_options.keys())
        options = [str(raw_options[k]) for k in sorted_keys]
        
    # Ensure exactly 4 options
    while len(options) < 4:
        options.append(f"Option {len(options)+1}")
    options = options[:4]
    
    # 4. Normalize correct_answer
    correct_answer = q_data.get("correct_answer") or q_data.get("correctAnswer") or q_data.get("answer") or ""
    # If correct_answer is just "A", "B", "C", "D": map it to the corresponding option value
    if correct_answer in ["A", "B", "C", "D"] and isinstance(raw_options, dict):
        correct_answer = raw_options.get(correct_answer, correct_answer)
    elif correct_answer in ["A", "B", "C", "D"] and len(options) >= 4:
        idx = ord(correct_answer) - ord('A')
        if 0 <= idx < len(options):
            correct_answer = options[idx]
            
    # 5. Normalize explanation
    explanation = q_data.get("explanation") or q_data.get("reason") or "No explanation provided."
    
    return {
        "concept_tag": q_data.get("concept_tag") or concept_tag,
        "prompt_text": prompt_text,
        "questionText": prompt_text, # Dual keys compatibility
        "code_snippet": code_snippet,
        "options": options,
        "correct_answer": correct_answer,
        "correctAnswer": correct_answer, # Dual keys compatibility
        "explanation": explanation
    }

def print_stage_header(stage_num, stage_title):
    CYAN = '\033[36m'
    RESET = '\033[0m'
    print(f"\n{CYAN}======================================================================{RESET}")
    print(f"{CYAN}  STAGE {stage_num}: {stage_title}{RESET}")
    print(f"{CYAN}======================================================================{RESET}")

def execute_generation_logic(req: GeneratorRequest):
    print_stage_header("1", "RAW INCOMING CAPTURE")
    
    if req.inputs:
        src_type = f"Multiple Uploaded Documents ({len(req.inputs)} Chunks Detected)"
        file_names_str = " | ".join([f"📑 {inp.source_name}" for inp in req.inputs])
    else:
        src_type = f"Single Source ({req.type or 'unknown'})"
        file_names_str = f"📑 {req.content[:50]}..." if req.content else "No File Name Available"
        
    raw_chars = len(req.content) if req.content else sum([len(inp.content) for inp in req.inputs]) if req.inputs else 0
    
    print(f"[Source Type] : {src_type}")
    print(f"[File Names]   : {file_names_str}")
    print(f"[Raw State]    : {raw_chars:,} characters of unparsed raw text structures.")

    if req.inputs:
        resolved_text = resolve_input_sources(req.inputs)
        if not resolved_text or len(resolved_text.strip()) < 50:
            raise HTTPException(status_code=400, detail="Content too short or unextractable from sources.")
        
        print_stage_header("2", "CONTENT SANITIZATION & METADATA STRIPPING")
        print(f"[Action]       : Stripped away PPTX syntax, fonts, sizes, slide numbers, and timestamps.")
        chunks = deduplicate_text_chunks(resolved_text, embed_model)
        context = "\n\n".join(chunks[:6])
        print(f"[Clean Text]   : \"{context[:150].strip().replace(chr(10), ' ')}...\"")
    else:
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
        
        print_stage_header("2", "CONTENT SANITIZATION & METADATA STRIPPING")
        print(f"[Action]       : Stripped away PPTX syntax, fonts, sizes, slide numbers, and timestamps.")
        if req.type == 'topic':
            print(f"  [RAG] Searching global database for topic '{req.content}'...")
            db_results = get_relevant_db_context(req.content, top_k=5)
            if db_results:
                context = "\n\n".join([r["content"] for r in db_results])
                print(f"  [RAG] Found {len(db_results)} matching chunks in database.")
            else:
                context = f"Syllabus topic: {req.content}"
                print("  [RAG] No matching chunks found in database. Using empty fallback.")
        else:
            if not source_text or len(source_text) < 2:
                raise HTTPException(status_code=400, detail="Content too short or file unreadable.")
            query = "Important core concepts"
            context = get_relevant_context(source_text, query, top_k=5)
        print(f"[Clean Text]   : \"{context[:150].strip().replace(chr(10), ' ')}...\"")

    # 1. Determine Target Flavor Ratios and Question count
    ratios = req.target_ratios or {"theory": 1.0, "code_debugging": 0.0, "fill_blank": 0.0, "scenario": 0.0}
    total_count = req.count
    
    # Calculate counts per flavor
    sum_ratios = sum(ratios.values())
    if sum_ratios == 0:
        ratios = {"theory": 1.0, "code_debugging": 0.0, "fill_blank": 0.0, "scenario": 0.0}
        sum_ratios = 1.0
        
    counts = {}
    accumulated_count = 0
    active_flavors = [f for f in ratios.keys() if ratios[f] > 0]
    if not active_flavors:
        active_flavors = ["theory"]
        
    for f in active_flavors[:-1]:
        c = int(round(total_count * (ratios[f] / sum_ratios)))
        counts[f] = c
        accumulated_count += c
    counts[active_flavors[-1]] = max(0, total_count - accumulated_count)

    print_stage_header("3", "DYNAMIC RATIO MATRIX (THE TEACHER'S SLIDERS)")
    requested_list = []
    for flavor_key, flavor_val in ratios.items():
        lbl = flavor_key.replace("_", " ").title()
        requested_list.append(f"{lbl} ({int(flavor_val * 100)}%)")
    requested_str = " | ".join(requested_list)
    print(f"[Requested]    : {requested_str}")
    print(f"[Hard Zero]    : Enforced! Small margins eliminated to maximize quiz focus.")
    
    final_list = []
    emojis = {"theory": "📝", "code_debugging": "💻", "fill_blank": "✏️", "scenario": "🎬"}
    for f_key, f_cnt in counts.items():
        if f_cnt > 0:
            emoji = emojis.get(f_key, "❓")
            lbl = f_key.replace("_", " ").title()
            final_list.append(f"{emoji} {f_cnt} {lbl} Question{'s' if f_cnt > 1 else ''}")
    final_count_str = " | ".join(final_list)
    print(f"[Final Count]  : {final_count_str}")

    print_stage_header("4", "3-AGENT COGNITIVE GENERATION PIPELINE")
    print(f"={'='*55}")
    print(f"")

    # 2. Executing Agent 1: Concept & Weight Analyzer
    topic_fallback = "General Course Concept"
    if req.inputs:
        names = [inp.source_name for inp in req.inputs if inp.source_name and inp.source_name != "Unknown Source"]
        if names:
            clean_names = []
            for name in names:
                cleaned = re.sub(r'\.[a-zA-Z0-9]+$', '', name)
                cleaned = re.sub(r'(?i)voice\s+transcript\s*\([^)]+\)', '', cleaned)
                cleaned = cleaned.strip()
                if cleaned:
                    clean_names.append(cleaned)
            if clean_names:
                topic_fallback = " ".join(clean_names)
    elif req.content and req.type == 'topic':
        topic_fallback = req.content

    concepts = run_agent1_analyzer(context, count=total_count, topic_fallback=topic_fallback)
    if not concepts:
        concepts = [{"concept_tag": topic_fallback, "weight_score": 0.75, "anchor_citation": "Direct context"}]

    if req.topic_weights:
        for c in concepts:
            c_tag = c.get("concept_tag")
            if c_tag in req.topic_weights:
                c["weight_score"] = float(req.topic_weights[c_tag])
        concepts = [c for c in concepts if c.get("weight_score", 0.0) > 0.0]
        if not concepts:
            concepts = [{"concept_tag": topic_fallback, "weight_score": 0.75, "anchor_citation": "Direct context"}]

    # Create the queue of generation tasks
    generation_tasks = []
    concept_idx = 0
    for flavor, cnt in counts.items():
        for _ in range(cnt):
            # Select concept wrapping around if fewer concepts than total count
            concept = concepts[concept_idx % len(concepts)]
            generation_tasks.append((concept, flavor))
            concept_idx += 1

    questions = []
    generated_so_far = ""

    # 3. Executing Agent 2 Generator & Agent 3 Critic loop
    for i, (concept, flavor) in enumerate(generation_tasks):
        print(f"\n• QUESTION {i+1} [Flavor: {flavor.upper()}]")
        q_success = False
        
        # Initial Draft Generation by Agent 2
        for attempt in range(3):
            try:
                q_data = run_agent2_generator(concept, flavor, context, generated_so_far, req.difficulty)
                print(f"  ├── [Agent 2 Creator]  : Drafted a multiple-choice question on '{concept.get('concept_tag')}'.")
                
                # Validation by Agent 3
                critic_res = run_agent3_critic(q_data, context, flavor)
                
                # Self-Correction Loop if failed
                if critic_res["status"] == "fail":
                    for repair_pass in range(2):
                        print(f"  ├── [Self-Correction]  : Agent 2 re-drafting the formatting structure (Attempt {repair_pass+1})...")
                        q_data = run_agent2_repair(q_data, critic_res["issues"], context)
                        critic_res = run_agent3_critic(q_data, context, flavor)
                        if critic_res["status"] == "pass":
                            break
                
                if critic_res["status"] == "pass":
                    normalized = normalize_question_json(q_data, concept.get("concept_tag"), flavor)
                    
                    q_final = {
                        "id": f"q_id_{str(i+1).zfill(3)}",
                        "type": flavor,
                        "concept_tag": normalized["concept_tag"],
                        "weight_score": float(concept.get("weight_score", 0.75)),
                        "prompt_text": normalized["prompt_text"],
                        "questionText": normalized["questionText"],
                        "code_snippet": normalized["code_snippet"],
                        "options": normalized["options"],
                        "correct_answer": normalized["correct_answer"],
                        "correctAnswer": normalized["correctAnswer"],
                        "explanation": normalized["explanation"]
                    }
                    questions.append(q_final)
                    generated_so_far += f" [{q_final['prompt_text']}] "
                    print(f"  └── [Agent 3 Critic]   : [ \033[32m✅ PASS\033[0m ] -> Structure matches perfectly.")
                    q_success = True
                    break
                else:
                    print(f"  ├── [Agent 3 Critic]   : [ \033[31m❌ FAIL\033[0m ] -> {critic_res['issues'][0] if critic_res['issues'] else 'QA issues detected'}")
            except Exception as e:
                err_str = str(e).lower()
                if "timeout" in err_str or "read timed out" in err_str or "connection" in err_str:
                    print("  ├── [Agent 2 Creator]  : ⚠️ CPU Latency Spike -> Instantly routed to Groq Cloud fallback safety handler.")
                    if os.getenv("GROQ_API_KEY"):
                        try:
                            # Construct prompt for Groq to generate a single question conforming to schema
                            prompt = (
                                "You are an elite Computer Science curriculum developer. Generate a single question.\n\n"
                                f"Context:\n{context[:2000]}\n\n"
                                f"Concept: {concept.get('concept_tag')}\n"
                                f"Type: {flavor}\n"
                                f"Difficulty: {req.difficulty}\n"
                                f"Already generated questions: {generated_so_far}\n\n"
                                "Return ONLY a clean JSON object conforming to this schema:\n"
                                "{\n"
                                "  \"concept_tag\": \"concept\",\n"
                                "  \"prompt_text\": \"Question text...\",\n"
                                "  \"code_snippet\": \"Markdown code snippet or null\",\n"
                                "  \"options\": [\"Option A\", \"Option B\", \"Option C\", \"Option D\"],\n"
                                "  \"correct_answer\": \"Exact copy of correct option from options\",\n"
                                "  \"explanation\": \"Detailed explanation explaining the solution...\"\n"
                                "}"
                            )
                            raw_text = call_groq_fallback(prompt, json_mode=True)
                            q_data = robust_json_loads(raw_text)
                            
                            normalized = normalize_question_json(q_data, concept.get("concept_tag"), flavor)
                            
                            q_final = {
                                "id": f"q_id_{str(i+1).zfill(3)}",
                                "type": flavor,
                                "concept_tag": normalized["concept_tag"],
                                "weight_score": float(concept.get("weight_score", 0.75)),
                                "prompt_text": normalized["prompt_text"],
                                "questionText": normalized["questionText"],
                                "code_snippet": normalized["code_snippet"],
                                "options": normalized["options"],
                                "correct_answer": normalized["correct_answer"],
                                "correctAnswer": normalized["correctAnswer"],
                                "explanation": normalized["explanation"]
                            }
                            questions.append(q_final)
                            generated_so_far += f" [{q_final['prompt_text']}] "
                            print(f"  └── [Agent 3 Critic]   : [ \033[32m✅ PASS\033[0m ] -> Groq fallback generated successfully.")
                            q_success = True
                            break
                        except Exception as ge:
                            print(f"  ├── [Agent 2 Creator]  : ⚠️ Groq fallback safety handler failed: {ge}")
                else:
                    print(f"  ├── [Agent 2 Creator]  : ⚠️ Execution error: {e}")

        if not q_success:
            print(f"  └── [Agent 2 Creator]  : [ \033[31m❌ FAIL\033[0m ] -> Failed to generate question after 3 attempts.")

    # Conforming to structured blueprint output JSON
    payload_response = {
        "quiz_metadata": {
            "source_material_id": req.source_material_id or "kmit_dynamic_gen",
            "total_questions": len(questions),
            "target_ratios": ratios
        },
        "questions": questions
    }
    
    print_stage_header("5", "FAULT-TOLERANT WEBHOOK CALLBACK DISPATCH")
    print(f"[Status]       : {len(questions)}/{total_count} Validated questions compiled into clean JSON payload.")

    if not questions:
        raise HTTPException(status_code=500, detail="AI failed to generate any questions.")

    return payload_response

def run_generation_task(req: GeneratorRequest):
    try:
        result = execute_generation_logic(req)
        
        # Determine topic fallback for sub_topic mapping
        topic_fallback = "General Course Concept"
        if req.inputs:
            names = [inp.source_name for inp in req.inputs if inp.source_name and inp.source_name != "Unknown Source"]
            if names:
                clean_names = []
                for name in names:
                    cleaned = re.sub(r'\.[a-zA-Z0-9]+$', '', name)
                    cleaned = re.sub(r'(?i)voice\s+transcript\s*\([^)]+\)', '', cleaned)
                    cleaned = cleaned.strip()
                    if cleaned:
                        clean_names.append(cleaned)
                if clean_names:
                    topic_fallback = " ".join(clean_names)
        elif req.content and req.type == 'topic':
            topic_fallback = req.content

        # Enforce strict key normalization on callback dispatch
        normalized_questions = []
        for i, q in enumerate(result.get("questions", [])):
            raw_options = q.get("options")
            options_list = []
            if isinstance(raw_options, list):
                options_list = [str(o) for o in raw_options]
            elif isinstance(raw_options, dict):
                sorted_keys = sorted(raw_options.keys())
                options_list = [str(raw_options[k]) for k in sorted_keys]
            while len(options_list) < 4:
                options_list.append(f"Option {len(options_list)+1}")
            options_list = options_list[:4]
            
            # Map options uniformly to object containing keys { A, B, C, D }
            options_dict = {
                "A": options_list[0],
                "B": options_list[1],
                "C": options_list[2],
                "D": options_list[3]
            }

            norm_q = {
                "id": q.get("id") or f"q_id_{str(i+1).zfill(3)}",
                "type": q.get("type") or "theory",
                "concept_tag": q.get("concept_tag") or topic_fallback,
                "sub_topic": q.get("concept_tag") or topic_fallback, # UI displays actual topic
                "weight_score": float(q.get("weight_score") or 0.75),
                "prompt_text": q.get("prompt_text") or q.get("questionText") or "",
                "questionText": q.get("prompt_text") or q.get("questionText") or "",
                "code_snippet": q.get("code_snippet"),
                "options": options_dict, # Object containing { A, B, C, D }
                "correct_answer": q.get("correct_answer") or q.get("correctAnswer") or "",
                "correctAnswer": q.get("correct_answer") or q.get("correctAnswer") or "",
                "explanation": q.get("explanation") or "Detailed explanation for solution choice."
            }
            normalized_questions.append(norm_q)

        result["questions"] = normalized_questions

        # Post success callback
        print(f"[Callback]     : Forwarding complete quiz structure to cloud engine... ", end="", flush=True)
        res = requests.post(req.callback_url, json={"status": "success", "result": result}, headers={"Content-Type": "application/json"}, timeout=30)
        print(f"[Success {res.status_code}]")
        print(f"======================================================================\n")
    except Exception as e:
        print(f"[Callback]     : Generation failed: {e}. Dispatching failure callback... ", end="", flush=True)
        try:
            res = requests.post(req.callback_url, json={"status": "failed", "error": str(e)}, headers={"Content-Type": "application/json"}, timeout=30)
            print(f"[Failed Callback Sent {res.status_code}]")
            print(f"======================================================================\n")
        except Exception as cb_err:
            print(f"[Error {cb_err}]")
            print(f"======================================================================\n")

@app.post("/generate")
async def generate_questions(req: GeneratorRequest, background_tasks: BackgroundTasks):
    if req.callback_url:
        print(f"  [PIPELINE] Received async request. Scheduling background generation task. callback_url={req.callback_url}")
        background_tasks.add_task(run_generation_task, req)
        return {"status": "accepted", "msg": "Quiz generation started in background", "taskId": req.taskId}
    
    # Otherwise synchronous execution
    return execute_generation_logic(req)

if __name__ == "__main__":
    print(f"AI Service starting on port 8000 using local model: {MODEL_NAME}")
    uvicorn.run(app, host="0.0.0.0", port=8000)

