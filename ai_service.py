import json
import re
import random
import os
import base64
import tempfile
import numpy as np
import faiss
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

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

    query = "Important core concepts" if req.type != 'topic' else req.content[:100]
    context = get_relevant_context(source_text, query, top_k=5)

    questions = []
    print(f"🚀 Starting sequential generation for {req.count} questions...")

    for i in range(req.count):
        try:
            # Tell the AI which question number this is to help it differentiate
            short_topic = req.content[:100].replace('\n', ' ') + "..." if len(req.content) > 100 else req.content
            prompt = f"Topic: {short_topic}\nContext: {context[:1500]}\nTask: Create question #{i+1} of {req.count}. Return a SINGLE JSON object with keys: questionText, options (list of 4), correctAnswer."
            
            response = requests.post(
                OLLAMA_URL,
                json={
                    "model": MODEL_NAME,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json" # Back to JSON mode for single objects (more stable)
                },
                timeout=120 # Increased timeout for heavy document reading
            )
            raw_text = response.json().get("response", "")
            data = json.loads(raw_text)
            
            # Normalize
            q_text = data.get("questionText") or data.get("question")
            q_opts = data.get("options") or data.get("choices")
            q_ans = data.get("correctAnswer") or data.get("answer")
            
            if q_text and q_opts:
                questions.append({
                    "questionText": str(q_text),
                    "options": [str(o) for o in q_opts[:4]],
                    "correctAnswer": str(q_ans),
                    "points": 10,
                    "type": "multiple-choice"
                })
                print(f"✅ Generated question {len(questions)}/{req.count}")
            
        except Exception as e:
            print(f"⚠️ Error on question {i+1}: {e}")
            continue

    if not questions:
        raise HTTPException(status_code=500, detail="AI failed to generate any questions.")

    return {"questions": questions}

if __name__ == "__main__":
    print(f"AI Service starting on port 8000 using local model: {MODEL_NAME}")
    uvicorn.run(app, host="0.0.0.0", port=8000)

