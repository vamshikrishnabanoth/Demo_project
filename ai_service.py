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
    
    if not source_text or len(source_text) < 10:
        raise HTTPException(status_code=400, detail="Content too short or file unreadable.")

    query = "Important core concepts" if req.type != 'topic' else req.content[:100]
    context = get_relevant_context(source_text, query, top_k=5)

    prompt = f"""
    CONTEXT: {context}
    
    TASK: Based on the context above, create {req.count} high-quality Multiple Choice Questions (MCQs).
    DIFFICULTY: {req.difficulty}
    
    FORMAT: You must respond with a JSON array of objects. 
    Each object must have: "questionText", "options" (array of 4 strings), and "correctAnswer" (must be one of the options).
    
    Example Output:
    [
      {{"questionText": "What is...?", "options": ["A", "B", "C", "D"], "correctAnswer": "A"}}
    ]
    """

    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": MODEL_NAME,
                "prompt": prompt,
                "stream": False,
                "format": "json" # Force JSON output if Ollama supports it
            },
            timeout=110 # Slightly less than Node's 120s
        )
        response_json = response.json()
        raw_text = response_json.get("response", "")
        
        # Parse the JSON response
        try:
            questions = json.loads(raw_text)
            if not isinstance(questions, list):
                # If it returned a single object instead of a list
                questions = [questions]
            
            # Normalize for the frontend
            for q in questions:
                if "question" in q and "questionText" not in q: q["questionText"] = q["question"]
                if "answer" in q and "correctAnswer" not in q: q["correctAnswer"] = q["answer"]
                q["points"] = 10
                q["type"] = "multiple-choice"
                
            return {"questions": questions[:req.count]}
        except Exception as json_err:
            print(f"JSON Parse Error: {json_err}\nRaw text: {raw_text}")
            # Fallback extraction
            json_match = re.search(r'\[.*\]', raw_text, re.DOTALL)
            if json_match:
                questions = json.loads(json_match.group())
                return {"questions": questions[:req.count]}
            raise HTTPException(status_code=500, detail="AI returned invalid JSON format.")

    except Exception as e:
        print(f"Ollama Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print(f"AI Service starting on port 8000 using local model: {MODEL_NAME}")
    uvicorn.run(app, host="0.0.0.0", port=8000)

