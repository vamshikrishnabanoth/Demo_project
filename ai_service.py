import torch
import json
import re
import random
import os
import base64
import tempfile
import numpy as np
import faiss
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
from sentence_transformers import SentenceTransformer
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Extractors
import easyocr
import docx
from pptx import Presentation
from PyPDF2 import PdfReader

# -----------------------------
# 1. MODEL CONFIGURATION (PHASE 2 BRAIN)
# -----------------------------
# We load the base Llama-3 brain and then attach your custom knowledge adapter
BASE_MODEL = "unsloth/llama-3-8b-bnb-4bit" 
ADAPTER_PATH = "./llama_quiz_expert" 

print(f"Loading Base Brain from {BASE_MODEL}...")
tokenizer = AutoTokenizer.from_pretrained(ADAPTER_PATH)
tokenizer.pad_token = tokenizer.eos_token

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4"
)

# 1. Load the base model
model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    device_map="auto",
    quantization_config=bnb_config
)

# 2. Attach your Specialist Knowledge (LoRA Adapter)
print(f"Attaching Fine-Tuned Adapter from {ADAPTER_PATH}...")
from peft import PeftModel
model = PeftModel.from_pretrained(model, ADAPTER_PATH)
model.eval() # Set to evaluation mode

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
    """The Phase 3 RAG Engine: Finds the best chunks using Vector Search"""
    # 1. Split into paragraphs/chunks
    paragraphs = [p.strip() for p in text.split('\n\n') if len(p.strip()) > 100]
    if not paragraphs: # Fallback if no double newlines
        paragraphs = [text[i:i+1000] for i in range(0, len(text), 800)]
    
    if len(paragraphs) <= top_k:
        return " ".join(paragraphs)

    # 2. Create Embeddings
    embeddings = embed_model.encode(paragraphs)
    dimension = embeddings.shape[1]
    
    # 3. Create FAISS Index
    index = faiss.IndexFlatL2(dimension)
    index.add(np.array(embeddings).astype('float32'))
    
    # 4. Search for the query
    query_emb = embed_model.encode([query])
    distances, indices = index.search(np.array(query_emb).astype('float32'), top_k)
    
    # 5. Return the best chunks
    relevant_chunks = [paragraphs[i] for i in indices[0]]
    return " ".join(relevant_chunks)

# -----------------------------
# 3. PROMPT LOGIC (ALPACA TEMPLATE)
# -----------------------------
def build_alpaca_prompt(context):
    return f"""Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.

### Instruction:
You are an expert Computer Science Educator. Create a high-quality Multiple Choice Question (MCQ) based on the input text provided. The output MUST be in a valid JSON format.

### Input:
{context}

### Response:
{{"""

# -----------------------------
# 4. FASTAPI SERVICE
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
    content: str # Can be raw text OR a local file path
    count: int = 5
    difficulty: str = "Medium"

@app.post("/generate")
async def generate_questions(req: GeneratorRequest):
    source_text = req.content
    
    # 1. Handle File Extractions
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
                print(f"Base64 processing error: {e}")
                raise HTTPException(status_code=400, detail="Invalid base64 file content.")
    
    if not source_text or len(source_text) < 10:
        raise HTTPException(status_code=400, detail="Content too short or file unreadable.")

    # 2. Apply Phase 3 RAG (Find best context using Semantic Search)
    query = req.content if req.type == 'topic' else "Important core concepts and technical details"
    context = get_relevant_context(source_text, query, top_k=2)

    questions = []
    # 3. Generate questions one by one for better quality
    for _ in range(req.count):
        prompt = build_alpaca_prompt(context)
        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)

        with torch.no_grad():
            output = model.generate(
                **inputs,
                max_new_tokens=300,
                temperature=0.7,
                do_sample=True,
                pad_token_id=tokenizer.eos_token_id
            )

        decoded = tokenizer.decode(output[0], skip_special_tokens=True)
        try:
            # Extract JSON from the assistant's response
            json_str = "{" + decoded.split("### Response:")[-1].split("{")[-1].strip()
            # Clean trailing text if AI hallucinated after JSON
            json_str = json_str[:json_str.rfind('}')+1]
            q_data = json.loads(json_str)
            
            # Add metadata for Kahoot frontend
            q_data["points"] = 10
            q_data["type"] = "multiple-choice"
            questions.append(q_data)
        except Exception as e:
            print(f"Parsing error in one question: {e}")
            continue

    if not questions:
        raise HTTPException(status_code=500, detail="AI failed to generate valid JSON.")

    return {"questions": questions}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

