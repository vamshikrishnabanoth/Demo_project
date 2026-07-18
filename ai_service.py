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
from fastapi import FastAPI, HTTPException, UploadFile, File
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
    whisper_model = WhisperModel("base", device="auto", compute_type="float32")
    print("Local Whisper Engine loaded successfully!")
except Exception as e:
    print(f"⚠️ Warning: Could not initialize local Whisper: {e}. Voice transcription will fall back to cloud/mock.")

# -----------------------------
# 2. DATABASE & RAG CORE LOGIC
# -----------------------------
def get_db_connection():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL is not set in environment.")
    return psycopg2.connect(DATABASE_URL)

def recursive_token_splitter(text, max_tokens=500, overlap_percent=10):
    if not text or not text.strip():
        return []
    try:
        tokens = embed_model.tokenizer.encode(text, add_special_tokens=False)
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
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "online", "service": "quiz-expert-ai"}

class MultiInputSource(BaseModel):
    type: str # 'text', 'pdf', 'docx', 'pptx', 'image', 'voice'
    content: str
    source_name: str = "Unknown Source"

class AnalyzeRequest(BaseModel):
    inputs: list[MultiInputSource]

class GeneratorRequest(BaseModel):
    inputs: list[MultiInputSource] = None
    type: str = None # Backwards compatibility
    content: str = None # Backwards compatibility
    count: int = 5
    difficulty: str = "Medium"
    target_ratios: dict = None
    source_material_id: str = None
    topic_weights: dict = None

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
            aggregated_texts.append(source_text.strip())
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
            
    print(f"  [DEDUPLICATOR] Kept {len(kept_chunks)}/{len(chunks)} chunks (removed {len(chunks) - len(kept_chunks)} duplicates).")
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
        "1. Check if the content is educational/academic. Set 'relevancy_verdict' to 'pass' if it is academic, or 'fail' if it is gibberish, casual chat, or spam.\n"
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
        response = requests.post(OLLAMA_URL, json=payload, timeout=90)
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
        print(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

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
        
        try:
            os.remove(tmp_path)
        except Exception:
            pass
            
        return {
            "status": "success",
            "text": text.strip(),
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


def run_agent1_analyzer(context, count):
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
        response = requests.post(OLLAMA_URL, json=payload, timeout=90)
        if response.status_code == 200:
            raw_text = response.json().get("response", "")
            data = robust_json_loads(raw_text)
            concepts = data.get("concepts", [])
            print(f"  [AGENT 1] Extracted {len(concepts)} concepts successfully.")
            return concepts
    except Exception as e:
        print(f"  [AGENT 1] Concept mapping failed: {e}")
    
    return [{"concept_tag": "General Course Concept", "weight_score": 0.75, "anchor_citation": "Direct context chunk"}]

def run_agent2_generator(concept, question_type, context, generated_so_far="", difficulty="Medium"):
    concept_tag = concept.get("concept_tag", "General Course Concept")
    weight_score = concept.get("weight_score", 0.75)
    print(f"  [AGENT 2] Flavor Generator: Creating question on '{concept_tag}' (flavor: {question_type})...")
    
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
    
    response = requests.post(OLLAMA_URL, json=payload, timeout=90)
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
    print("  [AGENT 3] System Critic: Validating drafted question...")
    issues = []
    
    prompt_text = q_data.get("prompt_text")
    options = q_data.get("options", [])
    correct_ans = q_data.get("correct_answer") or q_data.get("correctAnswer")
    code_snippet = q_data.get("code_snippet")
    
    if not prompt_text:
        issues.append("Missing prompt_text")
    if not options or len(options) < 4:
        issues.append("Fewer than 4 options provided")
    if not correct_ans:
        issues.append("Missing correct_answer")
    elif correct_ans not in options:
        if flavor != "code_debugging":
            issues.append("Correct answer does not match any of the options exactly")
        
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
    print(f"  [AGENT 3] Verdict: {status.upper()} (Found {len(issues)} issues)")
    return {
        "status": status,
        "issues": issues
    }

def run_agent2_repair(q_data, issues, context):
    print("  [AGENT 2] Repair Pass: Re-correcting question based on Critic feedback...")
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
    
    response = requests.post(OLLAMA_URL, json=payload, timeout=90)
    if response.status_code == 200:
        raw_text = response.json().get("response", "")
        data = robust_json_loads(raw_text)
        return data
    else:
        raise Exception("Repair failed")

@app.post("/generate")
async def generate_questions(req: GeneratorRequest):
    if req.inputs:
        resolved_text = resolve_input_sources(req.inputs)
        if not resolved_text or len(resolved_text.strip()) < 50:
            raise HTTPException(status_code=400, detail="Content too short or unextractable from sources.")
        chunks = deduplicate_text_chunks(resolved_text, embed_model)
        context = "\n\n".join(chunks[:6])
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

    print(f"")
    print(f"={'='*55}")
    print(f"  [PIPELINE] Starting 3-Agent Cognitive Generation Pipeline")
    print(f"  Target count: {total_count} questions | Flavors: {counts}")
    print(f"={'='*55}")
    print(f"")

    # 2. Executing Agent 1: Concept & Weight Analyzer
    concepts = run_agent1_analyzer(context, count=total_count)
    if not concepts:
        concepts = [{"concept_tag": "Syllabus Core Topic", "weight_score": 0.75, "anchor_citation": "Direct context"}]

    if req.topic_weights:
        for c in concepts:
            c_tag = c.get("concept_tag")
            if c_tag in req.topic_weights:
                c["weight_score"] = float(req.topic_weights[c_tag])
        concepts = [c for c in concepts if c.get("weight_score", 0.0) > 0.0]
        if not concepts:
            concepts = [{"concept_tag": "Syllabus Core Topic", "weight_score": 0.75, "anchor_citation": "Direct context"}]

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
        print(f"\n  --- Question {i+1}/{total_count} ({flavor.upper()}) ---")
        q_success = False
        
        # Initial Draft Generation by Agent 2
        for attempt in range(3):
            try:
                q_data = run_agent2_generator(concept, flavor, context, generated_so_far, req.difficulty)
                
                # Validation by Agent 3
                critic_res = run_agent3_critic(q_data, context, flavor)
                
                # Self-Correction Loop if failed
                if critic_res["status"] == "fail":
                    for repair_pass in range(2):
                        print(f"  [AGENT 3] Forcing self-correction repair pass {repair_pass+1}/2...")
                        q_data = run_agent2_repair(q_data, critic_res["issues"], context)
                        critic_res = run_agent3_critic(q_data, context, flavor)
                        if critic_res["status"] == "pass":
                            break
                
                if critic_res["status"] == "pass":
                    pt = q_data.get("prompt_text", "")
                    cs = q_data.get("code_snippet")
                    
                    if cs and isinstance(cs, str) and len(cs.strip()) > 0:
                        cs_clean = cs.strip()
                        if "```" not in cs_clean:
                            cs_clean = f"```\n{cs_clean}\n```"
                        pt = f"{pt}\n\n{cs_clean}"

                    # Conforming to structured blueprint format
                    q_final = {
                        "id": f"q_id_{str(i+1).zfill(3)}",
                        "type": flavor,
                        "concept_tag": q_data.get("concept_tag", concept.get("concept_tag")),
                        "weight_score": float(concept.get("weight_score", 0.75)),
                        "prompt_text": pt,
                        "code_snippet": cs or None,
                        "options": q_data.get("options", []),
                        "correct_answer": q_data.get("correct_answer") or q_data.get("correctAnswer"),
                        "explanation": q_data.get("explanation")
                    }
                    questions.append(q_final)
                    generated_so_far += f" [{q_final['prompt_text']}] "
                    print(f"  [ACCEPT] Question {i+1} accepted ✓")
                    q_success = True
                    break
                else:
                    print(f"  [REJECT] Attempt {attempt+1} failed QA validation: {critic_res['issues']}")
            except Exception as e:
                print(f"  [WARN] Attempt {attempt+1} execution error: {e}")

        if not q_success:
            print(f"  [FAIL] Failed to generate a clean {flavor} question after 3 attempts.")

    # Conforming to structured blueprint output JSON
    payload_response = {
        "quiz_metadata": {
            "source_material_id": req.source_material_id or "kmit_dynamic_gen",
            "total_questions": len(questions),
            "target_ratios": ratios
        },
        "questions": questions
    }
    
    print(f"")
    print(f"={'='*55}")
    print(f"  [PIPELINE] Done! Generated {len(questions)}/{total_count} questions.")
    print(f"={'='*55}")
    print(f"")

    if not questions:
        raise HTTPException(status_code=500, detail="AI failed to generate any questions.")

    return payload_response

if __name__ == "__main__":
    print(f"AI Service starting on port 8000 using local model: {MODEL_NAME}")
    uvicorn.run(app, host="0.0.0.0", port=8000)

