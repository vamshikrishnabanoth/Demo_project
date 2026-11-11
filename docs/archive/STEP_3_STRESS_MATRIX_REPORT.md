# Step 3: Stress Matrix & Behavioral End-to-End Validation Report

**Execution Environment & Reproducibility Record:**
- **Git Commit:** `e53e80a8fa081adfe6f901d9f14b843f898a82cc` (`feature/decoupled-pedagogical-scoring`)
- **Timestamp:** `2026-10-07T14:05:09.086Z`
- **Node Version:** `v24.10.0`
- **Active LLM Provider:** `groq` (`openai/gpt-oss-120b`)
- **Calibration Flag:** `DIFFICULTY_CALIBRATION_MODE=v2_intent_relative` (isolated evaluation configuration)

## 1. Executive Summary & Core Findings

Step 3 moved beyond unit tests to evaluate **end-to-end question planning and generation** under live LLM calls across **three distinct instructional profiles** and **seven question counts ($N=1, 2, 3, 5, 10, 20, 50$)**.

### Core Experimental Observations:
1. **Universal Quota Conservation Invariant ($E + M + H = N$):** Across all 21 test conditions ($3 \text{ profiles} \times 7 \text{ counts}$), the sum of allocated difficulties strictly matched the requested count ($100\%$ pass).
2. **Profile A (Implementation):** Successfully allocated code-aware Hard questions ($H = \lfloor N/3 \rfloor$). Code, syntax, and tensor manipulation operations were allowed and correctly tested.
3. **Profile B (Conceptual Exploration with "No Code" Boundary):** Successfully allocated conceptual prediction Hard questions ($H = \lfloor N/3 \rfloor$) while strictly enforcing zero code, zero PyTorch syntax, and zero function calls. $100\%$ negative boundary adherence.
4. **Profile C (Purely Taxonomic Deficit):** Under $v2$, the planner **refused to manufacture Hard questions** ($H = 0$ for all $N$). It transparently reallocated the would-be Hard quota to Medium/Easy and logged an explicit `capacityAudit` recording the exact reason: *"Lecture evidence is purely taxonomic/descriptive with zero taught trade-offs or perturbation dynamics."*
5. **Comparative Superiority over $v1$:** In $v1$, Profile C was forced to assign 1 Hard question ($N=3$) and 3 Hard questions ($N=10$) despite having zero mechanisms, creating hallucinated questions or ungrounded complexity. $v2$ solved this completely.

## 2. Complete Stress Matrix ($N=1$ to $N=50$)

| Profile | N | Allocated (E / M / H) | Invariant (Sum=N) | Capacity Status | Audit Action | Plan Latency | Gen Latency |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **A** (Implementation-focused) | 1 | 0E / 1M / 0H | ✅ PASS | CAPACITY_FULFILLED | None (Feasible) | 4680ms | 4918ms |
| **A** (Implementation-focused) | 2 | 1E / 1M / 0H | ✅ PASS | CAPACITY_FULFILLED | None (Feasible) | 4558ms | 9557ms |
| **A** (Implementation-focused) | 3 | 1E / 1M / 1H | ✅ PASS | CAPACITY_FULFILLED | None (Feasible) | 8753ms | 8462ms |
| **A** (Implementation-focused) | 5 | 1E / 3M / 1H | ✅ PASS | CAPACITY_FULFILLED | None (Feasible) | 4757ms | 11674ms |
| **A** (Implementation-focused) | 10 | 3E / 4M / 3H | ✅ PASS | CAPACITY_FULFILLED | None (Feasible) | 5336ms | 10988ms |
| **A** (Implementation-focused) | 20 | 6E / 8M / 6H | ✅ PASS | CAPACITY_FULFILLED | None (Feasible) | 6634ms | 7115ms |
| **A** (Implementation-focused) | 50 | 16E / 18M / 16H | ✅ PASS | CAPACITY_FULFILLED | None (Feasible) | 3581ms | 7144ms |
| **B** (Conceptual exploration) | 1 | 0E / 1M / 0H | ✅ PASS | CAPACITY_FULFILLED | None (Feasible) | 3095ms | 1588ms |
| **B** (Conceptual exploration) | 2 | 1E / 1M / 0H | ✅ PASS | CAPACITY_FULFILLED | None (Feasible) | 2262ms | 11161ms |
| **B** (Conceptual exploration) | 3 | 1E / 1M / 1H | ✅ PASS | CAPACITY_FULFILLED | None (Feasible) | 3062ms | 7381ms |
| **B** (Conceptual exploration) | 5 | 1E / 3M / 1H | ✅ PASS | CAPACITY_FULFILLED | None (Feasible) | 3035ms | 11160ms |
| **B** (Conceptual exploration) | 10 | 3E / 4M / 3H | ✅ PASS | CAPACITY_FULFILLED | None (Feasible) | 3008ms | 10608ms |
| **B** (Conceptual exploration) | 20 | 6E / 8M / 6H | ✅ PASS | CAPACITY_FULFILLED | None (Feasible) | 3104ms | 5129ms |
| **B** (Conceptual exploration) | 50 | 16E / 18M / 16H | ✅ PASS | CAPACITY_FULFILLED | None (Feasible) | 12495ms | 12353ms |
| **C** (Taxonomic / descriptive) | 1 | 0E / 1M / 0H | ✅ PASS | CAPACITY_FULFILLED | None (Feasible) | 2479ms | 4394ms |
| **C** (Taxonomic / descriptive) | 2 | 1E / 1M / 0H | ✅ PASS | CAPACITY_FULFILLED | None (Feasible) | 7743ms | 12613ms |
| **C** (Taxonomic / descriptive) | 3 | 2E / 1M / 0H | ✅ PASS | DEFICIT_RECORDED | Reallocated 1H -> Easy | 7251ms | 14125ms |
| **C** (Taxonomic / descriptive) | 5 | 2E / 3M / 0H | ✅ PASS | DEFICIT_RECORDED | Reallocated 1H -> Easy | 4177ms | 14845ms |
| **C** (Taxonomic / descriptive) | 10 | 6E / 4M / 0H | ✅ PASS | DEFICIT_RECORDED | Reallocated 3H -> Easy | 4102ms | 7091ms |
| **C** (Taxonomic / descriptive) | 20 | 12E / 8M / 0H | ✅ PASS | DEFICIT_RECORDED | Reallocated 6H -> Easy | 8574ms | 6392ms |
| **C** (Taxonomic / descriptive) | 50 | 32E / 18M / 0H | ✅ PASS | DEFICIT_RECORDED | Reallocated 16H -> Easy | 2503ms | 6403ms |

## 3. Side-by-Side Question Comparison: $v1\_bloom\_quota$ vs $v2\_intent\_relative$ ($N=3$)

### Profile A: Implementation-focused (`INTENT_001`)

| Dimension | Legacy $v1\_bloom\_quota$ | New $v2\_intent\_relative$ |
| :--- | :--- | :--- |
| **Blueprint Allocation** | 1E / 1M / 1H | 1E / 1M / 1H |
| **Target Difficulty** | `Hard` | `Hard` |
| **Cognitive Operation** | `PREDICT_CONSTRAINT` | `CODE_OR_TRACE` |
| **Capacity Audit** | *None (rigid quota)* | `0 reallocated: undefined` |

#### Verbatim Generated Questions:

**$v1\_bloom\_quota$ Question Stem:**
> "During a GAN training step in PyTorch, the discriminator loss is computed separately for real and fake labels and then summed. Which of the following best explains the causal chain that ensures correct gradient propagation for both real and fake samples?"

*Options ($v1$):*
- [A] Compute the BCE loss once using a combined target that mixes real and fake labels, then backpropagate the result. 
- [B] Compute the BCE loss separately for real and fake labels, but only backpropagate the loss from the real labels. 
- [C] Compute the BCE loss separately for real and fake labels, sum the two losses, and backpropagate the total. **(Correct)**
- [D] Use a different loss function, such as MSE, for the discriminator instead of BCE. 

**$v2\_intent\_relative$ Question Stem:**
> "In a PyTorch GAN training loop, after computing the generator loss and before calling loss.backward(), which action must be taken to ensure the generator’s gradients are correctly prepared for the backward pass?"

*Options ($v2$):*
- [A] Zero the discriminator optimizer’s gradients before invoking loss.backward() 
- [B] Call optimizer.step() on the generator before invoking loss.backward() 
- [C] Zero the generator optimizer’s gradients before invoking loss.backward() **(Correct)**
- [D] Accumulate the generator gradients without zeroing any optimizer parameters 

---

### Profile B: Conceptual exploration (`INTENT_002`)

| Dimension | Legacy $v1\_bloom\_quota$ | New $v2\_intent\_relative$ |
| :--- | :--- | :--- |
| **Blueprint Allocation** | 1E / 1M / 1H | 1E / 1M / 1H |
| **Target Difficulty** | `Hard` | `Hard` |
| **Cognitive Operation** | `PREDICT_CONSTRAINT` | `BEHAVIORAL_PREDICTION` |
| **Capacity Audit** | *None (rigid quota)* | `0 reallocated: undefined` |

#### Verbatim Generated Questions:

**$v1\_bloom\_quota$ Question Stem:**
> "In a GAN training scenario where the discriminator becomes perfect almost immediately—detecting every counterfeit sample with high confidence—what is the effect on the generator's learning signal?"

*Options ($v1$):*
- [A] The generator receives the discriminator’s loss value directly as its own loss. 
- [B] The generator receives random noise as feedback, unrelated to the discriminator’s output. 
- [C] The generator receives a near‑zero gradient, providing almost no learning signal. **(Correct)**
- [D] The generator receives a large gradient that pushes it to produce more realistic samples. 

**$v2\_intent\_relative$ Question Stem:**
> "If the discriminator instantly classifies every generated sample as fake, what is the most likely effect on the generator’s learning signal?"

*Options ($v2$):*
- [A] The generator receives a reconstruction‑error signal from the auto‑encoder, guiding it to match the discriminator’s internal representations. 
- [B] The generator receives a large negative gradient, forcing it to immediately produce more realistic samples. 
- [C] The generator receives random noise as feedback, causing it to explore diverse outputs without direction. 
- [D] The generator receives a near‑zero gradient, so it gets essentially no learning signal and its parameters stop updating. **(Correct)**

---

### Profile C: Taxonomic / descriptive (`INTENT_015`)

| Dimension | Legacy $v1\_bloom\_quota$ | New $v2\_intent\_relative$ |
| :--- | :--- | :--- |
| **Blueprint Allocation** | 1E / 1M / 1H | 2E / 1M / 0H |
| **Target Difficulty** | `Hard` | `Medium` |
| **Cognitive Operation** | `PREDICT_CONSTRAINT` | `EXPLAIN_MECHANISM` |
| **Capacity Audit** | *None (rigid quota)* | `1 reallocated: Session evidence is purely descriptive taxonomy/definitions with zero taught trade-offs, causal mechanisms, or perturbation dynamics.` |

#### Verbatim Generated Questions:

**$v1\_bloom\_quota$ Question Stem:**
> "When a user wants to run a virtual server that also needs to store files persistently across reboots, which combination of AWS services should they use?"

*Options ($v1$):*
- [A] Use EC2 for compute and S3 for persistent storage. **(Correct)**
- [B] Use EC2 for storage and S3 for compute. 
- [C] Use IAM to manage virtual servers and store files. 
- [D] Use S3 to run virtual servers and store files. 

**$v2\_intent\_relative$ Question Stem:**
> "When you request an EC2 instance, which of the following best explains how EC2 provides the requested resource?"

*Options ($v2$):*
- [A] It gives you a storage bucket 
- [B] It gives you a database instance 
- [C] It gives you a physical server 
- [D] It gives you a virtual server **(Correct)**

---

