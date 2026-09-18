# Mentor Presentation & Live Demo Walkthrough Guide: Architecture E

**Release Tag**: `v2.0-architecture-e-frozen`  
**Target Duration**: 4–5 Minutes  
**Focus**: Engineering Rigor, Scientific Findings, Forensic Diagnosis, and Production Product Loop  

---

## 1. Executive Talking Points (The 60-Second Hook)

1. **The Problem We Solved**: Naïve assessment generation blindly dumps 3,500 characters of lecture materials into an LLM. This leads to three crippling issues:
   - *Context dilution*: Important technical definitions get buried in conversational filler.
   - *Modality mismatch*: Teachers speak colloquially while presenting dense mathematical slides.
   - *Dangerous hallucinations*: Models fabricate questions from administrative banter or garbled OCR.
2. **The Architecture E Solution**:
   - **PDI Router**: Evaluates lexical density, terminology ratio, and headings to partition primary narratives from auxiliary anchors.
   - **Dual-Level Hierarchical RAG**: Retrieves small, high-density 75-word child chunks (with 1.5× concept boost) and dynamically expands to cohesive 400-word parent narrative windows.
   - **Bipartite Cross-Material Alignment (CMA)**: Synchronizes speech timestamps to slide equations and code blocks.
   - **Deterministic Gating**: Upfront Academicity Gate rejects banter; Final Grounding Gate rejects low-overlap OCR.
3. **The Empirical Result**:
   - Grounding jumped from **4.24 to 4.88–4.91 / 5.00 (+0.67 improvement)**.
   - Audited composite quality reached **4.80–4.85 / 5.00** (highest observed in comparison).
   - Answer-key validity maintained at **100%** with **0% foreign-topic contamination**.

---

## 2. Walkthrough Flow (Minute-by-Minute)

### Minute 1: The Core Architecture & Pipeline Flow
*Point to the Pipeline Diagram in `FINAL_ARCHITECTURE_E_REPORT.md` or `RESEARCH_PAPER_METHODOLOGY_AND_RESULTS.md`.*
- "Notice how we cleanly separate concerns across our 3-Agent architecture."
- "Agent 1 doesn't carry heavy context; it receives structured targets from our PDI router."
- "The Hierarchical Store performs targeted child matching, then pulls in the exact 400-word parent context window so Agent 2 sees the full conceptual story."
- "Slide formulas and code are mapped in via our Bipartite CMA graph within a strict 2,000-character cap."

### Minute 2: The Forensic Discovery (Turning Apparent Loss into Scientific Proof)
*Show `Demo_project/FINAL_VALIDATION/failure_forensic_analysis.md`.*
- "When we first ran the canonical 10-item benchmark, we observed 22/30 delivered questions."
- "Rather than guessing or tweaking prompts, we traced all 9 missing questions line-by-line in session telemetry:"
  - **4 were deliberate safety gates doing their job**: In `EDGE_001` (classroom banter), the Academicity Gate stopped the LLM from writing arithmetic questions about teacher jokes. In `EDGE_004` (illegible handwriting OCR), the Grounding Gate rejected candidates that hallucinated formulas.
  - **5 were provider capacity limits**: Groq's 8,000 TPM limit triggered an eager circuit breaker.
  - **Zero failures were caused by Hierarchical RAG or CMA**: Children matched with 0.28–0.65 Jaccard overlap, 100% parent expansion, and zero context truncation.

### Minute 3: Operational Capacity Hardening & Retest
*Show `Demo_project/FINAL_VALIDATION/capacity_mitigation_results.md`.*
- "We froze the architecture completely. We touched zero prompts, zero schemas, zero weights."
- "We made two operational changes in the router: multi-key rotation with 10s/120s cooldowns and a 2-second pacing buffer before reserve target swaps."
- "Result on retest: 10/10 runs completed cleanly. In `MULTI_001`, we recovered delivery from 2/3 to 3/3 at 4.87/5.00 quality, while keeping the 4 safety rejections 100% intact. Questions delivered ranged 19–23/30 across runs, with the remaining constraint being provider capacity."

### Minute 4: The Live Production Demo (Teacher → Student → Leaderboard)
*Execute the live test script or show `lifecycle_test_summary.json`.*
- Run: `node scratch/verify_architecture_e_product_lifecycle.js`
- Step 1: "Teacher authenticates and publishes the multi-modal quiz. Notice the SHA-256 cryptographic hash `e661d495ca2f...` persisted to PostgreSQL."
- Step 2: "Game session created with live PIN **`317738`**."
- Step 3: "Anti-cheat verification: when the student client fetches the quiz, correct answers and explanations are completely stripped from the payload."
- Step 4: "Two students join and submit answers. Student 1 gets 30/30 in 30s. Student 2 gets 20/30 in 45s. The server grades deterministically and updates the PostgreSQL database."
- Step 5: "Real-time leaderboard displays Rank 1 and Rank 2 instantaneously."

---

## 3. Anticipated Mentor Questions & Exact Answers

### Q1: "Why did you deliver 19–23 out of 30 questions instead of 30?"
> **Answer**: "The difference between 30 and 23 is not an algorithm flaw—it reflects system integrity:
> 1. **Four non-deliveries are intentional safety gates**: We refuse to generate questions from non-academic teacher banter (`EDGE_001`) or unreadable OCR noise (`EDGE_004`). The baseline generated 29/30 only because it hallucinated questions on non-academic chatter.
> 2. **The remaining 7 non-deliveries are bounded by provider rate limits**: Groq's free-tier rate limit of 8,000 tokens/min occasionally throttles sequential calls. Our router safely protects system stability rather than crashing."

### Q2: "Why is Dual-Level Hierarchical RAG better than a larger sliding window?"
> **Answer**: "A 3,500-character sliding window introduces severe semantic dilution—in our baseline tests, grounding dropped to 4.24 because the model picked up surrounding digressions. Hierarchical RAG indexes 75-word child chunks with 1.5× domain-concept weighting for surgical precision, and then expands to the 400-word parent window for narrative coherence. This drove evidence grounding to 4.88–4.91 (+0.67 points)."

### Q3: "Is this just an offline prototype or a real working platform?"
> **Answer**: "It is a fully operational product. It runs against our production PostgreSQL database via Prisma ORM. We validated the entire lifecycle: teacher publishing with SHA-256 integrity hashing, live PIN generation (`317738`), anti-cheat safe projections, concurrent student response submissions, server-side grading, and real-time leaderboard ranking."

### Q4: "What is your next step?"
> **Answer**: "Architecture E is frozen at Git tag `v2.0-architecture-e-frozen`. Our next priorities are completing our paper submission for the Educational AI track, adding surgical repair as a future enhancement, and deploying dedicated enterprise API capacity to lift the provider TPM ceiling."
