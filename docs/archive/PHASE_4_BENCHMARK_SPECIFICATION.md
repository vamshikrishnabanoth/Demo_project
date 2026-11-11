# Phase 4 Golden Benchmark Specification: Teacher Instructional Intent & Relative Difficulty Calibration

## 1. Executive Summary & Core Scientific Philosophy

In Phases 2 and 3, we solved:
1. **Decoupled Pedagogical Richness**: Voice instructional substance is evaluated independently from uploaded document inflation (19 modalities verified, 0 PDF inflation vulnerabilities).
2. **Concept–Evidence Graph & Semantic Cross-Source Linkage**: Dense embedding retrieval combined with generic concept anchoring and conflict reasoning (100% accuracy on unseen holdout cases, feature-flagged).

**Phase 4 targets the core pedagogical assessment engine**:
Currently, the pipeline treats difficulty as a **fixed mathematical quota** ($\lfloor N/3 \rfloor$ Easy, $\lfloor N/3 \rfloor$ Hard) mapped to **rigid Bloom's Taxonomy tiers** (Easy = Recall, Medium = Understand, Hard = Apply/Diagnose), where "Hard" requires procedural or algorithmic action keywords (`compute`, `calculate`, `allocate`, `schedule`). If absent, it either falsely declares `INSUFFICIENT_EVIDENCE_FOR_HARD` or forces an LLM to hallucinate un-taught code or advanced mathematical trivia.

### The Scientific Shift in Phase 4
$$\text{Difficulty} \neq \text{Fixed Bloom Level / Rigid Code Requirement}$$
$$\text{Difficulty} = \text{Depth of reasoning required within the teacher's demonstrated scope and instructional intent.}$$

A lecture where a teacher explores conceptual interaction dynamics without writing code **can and must support genuine Hard questions**—questions that test "what happens if...", behavioral consequence prediction, and trade-offs within the taught concepts—without inventing un-taught code implementations or mathematical derivations.

---

## 2. Formal Behavioral Dimensions

Phase 4 defines five orthogonal behavioral dimensions that must govern assessment planning:

### Dimension A: Teacher Instructional Intent
The primary cognitive mode the instructor modeled during the lecture:
* **`EXPLORATION`**: Teacher asks students to contemplate perturbations (*"Explore what happens if...", "What if we change this?", "Observe how it reacts"*).
* **`CAUSAL_ANALYSIS`**: Teacher models underlying reasons (*"Why does this fail?", "What causes the deadlock?", "Understand the root cause"*).
* **`COMPARATIVE_TRADEOFF`**: Teacher compares competing philosophies or designs (*"Why choose X over Y?", "Observe the trade-off between latency and consistency"*).
* **`IMPLEMENTATION_PRACTICE`**: Teacher emphasizes concrete code, APIs, and syntax (*"Focus on writing the code", "Understand the function parameters", "Practice the implementation"*).
* **`PROCEDURAL_TRACE`**: Teacher walks step-by-step through execution transitions (*"Follow the pointer", "Trace the packet", "Step through the loop"*).
* **`FOUNDATIONAL_UNDERSTANDING`**: Teacher delivers an introductory structural overview of components and definitions.

### Dimension B: Explicit Negative Boundaries (Hard Anti-Hallucination Constraints)
Explicit instructor directives that forbid specific categories of assessment questions:
* **`NO_CODE_IMPLEMENTATION`**: Teacher explicitly states: *"Don't worry about coding", "We won't write code for this", "No syntax needed"*. (Hard questions must **NEVER** ask for language syntax, API calls, or coding snippets).
* **`NO_MATHEMATICAL_DERIVATION`**: Teacher explicitly states: *"Don't worry about the formal proof", "We skip the derivation", "No formulas on the exam"*. (Hard questions must **NEVER** require formula derivations or calculus proofs).
* **`STRICT_SUBSYSTEM_SCOPE`**: Teacher explicitly states: *"We are looking strictly at phase 1", "Disregard clustering for now"*. (Hard questions must **NEVER** test un-taught adjacent systems).

### Dimension C: Concept Emphasis (Focal vs Peripheral)
The relative instructional weight allocated by the teacher:
* **`HIGH_EMPHASIS`**: Subject of extensive discussion, analogies, or repeated focus. (Primary source for Medium and Hard questions).
* **`MEDIUM_EMPHASIS`**: Standard supporting mechanisms or components.
* **`LOW_EMPHASIS` / `PERIPHERAL`**: Mentioned in passing or tangential remarks. (Prohibited from receiving Hard-tier cognitive demand).

### Dimension D: Teacher-Relative Difficulty Tiers

| Intent Paradigm | Easy Tier (Foundational) | Medium Tier (Mechanism / Relationship) | Hard Tier (Deep Reasoning / Consequence) |
| :--- | :--- | :--- | :--- |
| **Exploration / Dynamics**<br>*(e.g. Conceptual GAN)* | Identify primary component roles (Generator vs Discriminator). | Explain the feedback loop between the two components. | **Predict system behavior under perturbation** (*"If discriminator becomes near-perfect early, what happens to generator gradient updates?"*). **Zero code.** |
| **Implementation / Practice**<br>*(e.g. Code GAN)* | Identify API calls or tensor dimension roles. | Explain how data flows through layers in the forward pass. | **Trace hyperparameter impact or diagnose runtime fault** (*"If learning rate is 10x too high, which layer diverges first?"*). |
| **Comparative / Trade-off**<br>*(e.g. Consistency Models)* | Define terms (Strong vs Eventual consistency). | Contrast latency vs synchronization cost. | **Evaluate conflicting system requirements** (*"Under high network partition frequency, which invariant must degrade to preserve availability?"*). |
| **Purely Descriptive Overview**<br>*(e.g. Cloud Service Taxonomy)* | Name service categories (Compute vs Storage). | Identify standard use cases. | **FEASIBILITY: FALSE (CAPACITY DEFICIT)**. System must report transparent limitation rather than fabricating un-taught mechanics. |

---

## 3. The 5 Benchmark Categories & Case Matrix

The benchmark is organized into 5 behavioral categories specifically designed to expose previous failure modes:

```
Category 1: Paired Same-Topic, Contrasting-Intent Cases (Style & Focus Divergence)
Category 2: Negative Boundary Adherence & Anti-Hallucination
Category 3: Conceptual-Hard Feasibility (Zero Procedural Keywords)
Category 4: Genuine Hard Infeasibility (True Capacity Deficits)
Category 5: Instructional Intent & Meta-Discourse Marker Extraction
```

---

### Category 1: Paired Same-Topic, Contrasting-Intent Cases (6 Cases / 3 Pairs)

This category evaluates whether the system generates **fundamentally different, style-appropriate Hard questions** for identical topics taught with different intents.

#### Pair 1: Generative Adversarial Networks (GANs)
* **`INTENT_001` (GAN - Lecturer A: Implementation & Code)**:
  * *Voice*: "Today we are implementing GANs in PyTorch. Focus on the training loop code. Notice how we compute the BCE loss separately for the discriminator on real labels and fake labels, and then zero the generator gradients before calling backward."
  * *Doc*: "Section 4: PyTorch GAN Implementation. Generator class, Discriminator class, Adam optimizer configurations, BCEWithLogitsLoss."
  * *Expected Intent*: `IMPLEMENTATION_PRACTICE`
  * *Expected Boundaries*: Code expected and permitted.
  * *Expected Hard Style*: Code trace, gradient zeroing requirement, loss backward sequencing.
  * *Current System Failure*: Treats as generic keyword match or Bloom "Apply" without checking training loop sequencing.
* **`INTENT_002` (GAN - Lecturer B: Conceptual Dynamics & Exploration)**:
  * *Voice*: "Don't worry about coding or PyTorch today; we want to explore the conceptual game between the generator and discriminator. Think of it as a counterfeiter and a detective. Explore what happens if the discriminator gets too good too fast—if the detective catches everything immediately, what feedback does the counterfeiter actually receive?"
  * *Doc*: "Adversarial Training Dynamics. Minimax objective, zero-sum game, discriminator loss saturation."
  * *Expected Intent*: `EXPLORATION`
  * *Expected Boundaries*: `NO_CODE_IMPLEMENTATION` (Hard Constraint).
  * *Expected Hard Style*: Behavioral prediction: "What happens to the generator if the discriminator achieves near-zero loss early in training?" (Vanishing gradients / loss saturation). **Zero code or syntax allowed.**
  * *Current System Failure*: Flags `INSUFFICIENT_EVIDENCE_FOR_HARD` (no code/mechanism words), or LLM hallucinates PyTorch questions.

#### Pair 2: Database Isolation & Concurrency Control
* **`INTENT_003` (Concurrency - Lecturer A: SQL Syntax & Lock Primitives)**:
  * *Voice*: "Look at the SQL script on slide 3. We issue `SELECT ... FOR UPDATE` on table accounts. Pay attention to the syntax and lock flags. Practice writing the exact lock acquisition query."
  * *Doc*: "SQL syntax: `SELECT ... FOR UPDATE [NOWAIT | SKIP LOCKED]`. Row-level exclusive lock syntax."
  * *Expected Intent*: `IMPLEMENTATION_PRACTICE`
  * *Expected Boundaries*: Syntax required.
  * *Expected Hard Style*: Query syntax behavior, `NOWAIT` flag error handling.
* **`INTENT_004` (Concurrency - Lecturer B: ACID Anomalies & Trade-off Philosophy)**:
  * *Voice*: "Forget about SQL syntax today. We are exploring the philosophical trade-off between performance and anomalies. What happens if a banking system allows non-repeatable reads? Why did the database architects decide that Read Committed should tolerate phantom rows? Think about the trade-off."
  * *Doc*: "ANSI SQL Isolation Levels. Dirty read, non-repeatable read, phantom read anomaly taxonomy."
  * *Expected Intent*: `COMPARATIVE_TRADEOFF`
  * *Expected Boundaries*: `NO_CODE_IMPLEMENTATION` (Hard Constraint).
  * *Expected Hard Style*: Scenario trade-off: evaluate throughput gain vs anomaly risk in concurrent schedules. **Zero SQL syntax questions allowed.**

#### Pair 3: Distributed Systems Consensus
* **`INTENT_005` (Consensus - Lecturer A: Packet Tracing & Wire Formats)**:
  * *Voice*: "Trace the exact RequestVote RPC packet. Bytes 0 to 3 are term number, bytes 4 to 7 are candidate ID. Follow the wire trace when a network packet drops."
  * *Doc*: "Raft RPC wire protocol specifications. RequestVote arguments and return values."
  * *Expected Intent*: `PROCEDURAL_TRACE`
  * *Expected Hard Style*: Byte-level trace and packet drop state tracking.
* **`INTENT_006` (Consensus - Lecturer B: Split-Brain & Quorum Dynamics)**:
  * *Voice*: "Don't memorize packet formats. Explore what happens during a network partition. If three nodes are in London and two in New York, what happens if both sides attempt to elect a leader? Why can the majority continue while the minority must pause?"
  * *Doc*: "Quorum intersection property: any two majorities of size $(N/2)+1$ must share at least one node."
  * *Expected Intent*: `EXPLORATION` / `BEHAVIOR_PREDICTION`
  * *Expected Boundaries*: `NO_CODE_IMPLEMENTATION`, `NO_PACKET_FORMAT_TRIVIA`.
  * *Expected Hard Style*: Partition dynamics: predict cluster behavior and log divergence during network split.

---

### Category 2: Negative Boundary Adherence & Anti-Hallucination (4 Cases)

This category tests whether explicit instructor exclusions are strictly respected by Agent 1 and Agent 2, preventing the generation of un-taught trivia.

* **`INTENT_007` (Explicit Exclusion: No Coding)**:
  * *Voice*: "We will study the Fast Fourier Transform algorithm, but I want to make one thing completely clear: do not write Python code, do not worry about NumPy implementations, and there will be zero coding questions on this exam. We only care about the divide-and-conquer butterfly concept."
  * *Doc*: "FFT algorithm: Cooley-Tukey butterfly operations, $O(N \log N)$ recurrence relation."
  * *Expected Boundary*: `NO_CODE_IMPLEMENTATION` (Confidence: 100%).
  * *Failure Mode to Catch*: Generator asking: *"Which NumPy function computes a 2D FFT?"* or *"Fill in the missing line in the Python FFT function"*.
* **`INTENT_008` (Explicit Exclusion: No Math Proof/Derivations)**:
  * *Voice*: "The textbook gives a 5-page mathematical proof deriving the regularity condition of Master Theorem Case 3. Skip that proof entirely! I will not ask you to derive $af(n/b) \le c f(n)$. You only need to recognize which case matches the recurrence."
  * *Doc*: "Theorem 4.1 Master Theorem Case 3 Proof with regularity condition derivation."
  * *Expected Boundary*: `NO_MATHEMATICAL_DERIVATION` (Confidence: 100%).
  * *Failure Mode to Catch*: Generator asking students to calculate constant $c < 1$ or derive intermediate epsilon bounds.
* **`INTENT_009` (Explicit Exclusion: Strict Subsystem Scope)**:
  * *Voice*: "Today we are looking strictly at CPU instruction decode stages. We are not covering memory caching, we are not covering branch prediction, and we are not covering out-of-order execution today. Keep your attention strictly on 5-stage classic RISC decode."
  * *Doc*: "Pipelined Processors: Fetch, Decode, Execute, Memory, Writeback."
  * *Expected Boundary*: `STRICT_SUBSYSTEM_SCOPE` (Exclude Branch Prediction, Cache, Tomasulo).
  * *Failure Mode to Catch*: Hard question asking about branch target buffers or Tomasulo reservation stations.
* **`INTENT_010` (Explicit Exclusion: No Vendor-Specific Tools)**:
  * *Voice*: "In this container security overview, don't worry about specific Docker CLI flags or AWS ECS configurations. Focus purely on Linux kernel cgroups and namespaces as isolation mechanisms."
  * *Doc*: "Container isolation: cgroups v2 resource limits, pid/net namespaces."
  * *Expected Boundary*: `NO_VENDOR_SPECIFIC_CLI` (Exclude Docker flags, AWS).
  * *Failure Mode to Catch*: Generator asking *"Which flag for `docker run` sets memory limits?"*

---

### Category 3: Conceptual-Hard Feasibility (No Procedural Keywords) (4 Cases)

This category tests lectures that contain rich, deep reasoning, trade-offs, and causal interactions, but **zero procedural/algorithmic keywords** (`compute`, `calculate`, `allocate`, `schedule`). The system must generate valid Hard questions without flagging false deficits.

* **`INTENT_011` (CAP Theorem Trade-off Dynamics)**:
  * *Voice*: "In distributed storage, you cannot have both linearizable consistency and 100% availability during network partitions. Think about why: if a network cable is cut between two datacenters, you must make a fundamental philosophical choice: do you reject incoming writes to keep data consistent, or accept writes and allow data to diverge?"
  * *Doc*: "Brewer's CAP Theorem: In the presence of a network partition, a distributed system must choose between Consistency and Availability."
  * *Taught Depth*: Deep causal trade-off, zero procedural calculations.
  * *Expected System Behavior*: Hard question allowed! Question style: evaluate architectural trade-offs under partition. **NO false capacity deficit.**
* **`INTENT_012` (Microservices vs. Monolith Organizational Trade-offs)**:
  * *Voice*: "Microservices are not a silver bullet. You trade operational simplicity for team autonomy. With a monolith, you have one deployment artifact and zero distributed transaction issues, but teams step on each other's toes. With microservices, teams deploy independently, but you introduce eventual consistency, network latency, and distributed tracing nightmares."
  * *Doc*: "Software Architecture Styles: Monolithic vs Service-Oriented vs Microservices."
  * *Taught Depth*: Multi-variable architectural reasoning, zero code.
  * *Expected System Behavior*: Hard question allowed! Question style: diagnose which architecture fits a specific organizational constraint.
* **`INTENT_013` (Zero-Knowledge Proofs Intuition)**:
  * *Voice*: "Imagine the Ali Baba cave with a secret door. How can Peggy prove to Victor that she knows the secret passphrase without revealing the passphrase to Victor? Observe how repeated trials of choosing paths reduce Victor's doubt exponentially."
  * *Doc*: "Zero-Knowledge Interactive Proofs: Completeness, Soundness, Zero-Knowledge properties."
  * *Taught Depth*: High conceptual and probabilistic intuition, zero code or modular arithmetic equations.
  * *Expected System Behavior*: Hard question allowed! Question style: predict soundness breakdown if the verifier can predict prover's path choice.
* **`INTENT_014` (Public Key Cryptography Trust Models)**:
  * *Voice*: "Why do we need Certificate Authorities? If Alice sends her public key over an untrusted network, Bob has no way of knowing whether the key belongs to Alice or to Mallory performing a man-in-the-middle attack. Explore why encryption without authentication is meaningless."
  * *Doc*: "Public Key Infrastructure: Digital Certificates, X.509, Root CAs, Man-in-the-Middle attack."
  * *Taught Depth*: Security threat modeling and causal attack reasoning, zero RSA math.
  * *Expected System Behavior*: Hard question allowed! Question style: diagnose vulnerability in a flawed key-exchange scenario.

---

### Category 4: Genuine Hard Infeasibility (True Capacity Deficits) (3 Cases)

This category tests lectures that are genuinely descriptive or introductory, with no mechanisms, trade-offs, or perturbation dynamics. The system **must declare a capacity limitation** and refuse to fabricate un-taught complexity.

* **`INTENT_015` (Cloud Service Catalog Overview - Pure Definitions)**:
  * *Voice*: "Welcome to Cloud 101. Amazon EC2 stands for Elastic Compute Cloud; it gives you virtual servers. S3 stands for Simple Storage Service; it stores files as objects. IAM stands for Identity and Access Management; it manages users and passwords."
  * *Doc*: "AWS Services Overview: EC2, S3, IAM, RDS."
  * *Taught Depth*: Level 1 Definitions only. Zero mechanisms, zero trade-offs, zero configuration parameters.
  * *Expected System Behavior*: **`INSUFFICIENT_EVIDENCE_FOR_HARD` capacity deficit recorded.** Hard count = 0. System must refuse to invent scenario debugging questions about VPC CIDR blocks or IAM JSON policy evaluation.
* **`INTENT_016` (Physical Network Media Overview)**:
  * *Voice*: "Network cables come in three common types: twisted pair copper cables like Cat 6, coaxial cables with copper shielding, and fiber optic cables made of glass strands that transmit pulses of light."
  * *Doc*: "Physical Layer Media: UTP, STP, Coaxial, Single-mode and Multi-mode Fiber."
  * *Taught Depth*: Taxonomic descriptions only.
  * *Expected System Behavior*: **`INSUFFICIENT_EVIDENCE_FOR_HARD` capacity deficit recorded.** System must refuse to invent un-taught optical attenuation dB calculations.
* **`INTENT_017` (Software Engineering Roles Definitions)**:
  * *Voice*: "In modern tech companies, Product Managers define what to build, UX Designers create the wireframes and user journeys, Software Engineers write the software, and QA Engineers test for bugs."
  * *Doc*: "Agile Development Team Roles and Responsibilities."
  * *Taught Depth*: Pure role definitions.
  * *Expected System Behavior*: **`INSUFFICIENT_EVIDENCE_FOR_HARD` capacity deficit recorded.** System must refuse to fabricate un-taught project management conflict scenarios.

---

### Category 5: Instructional Intent & Meta-Discourse Marker Extraction (5 Cases)

This category evaluates the system's ability to extract explicit instructional markers from unstructured conversational speech without domain-specific dictionary hardcoding.

* **`INTENT_018` (Marker: "Explore what happens if...")**:
  * *Voice*: "Explore what happens if we double the batch size during stochastic gradient descent. Does the training trajectory become smoother, and what happens to the generalization gap on test data?"
  * *Expected Intent*: `EXPLORATION` / `BEHAVIOR_PREDICTION`
* **`INTENT_019` (Marker: "Why does this happen?")**:
  * *Voice*: "Why does a 2-phase locking protocol prevent cascading aborts in Strict 2PL, whereas standard 2PL permits them? Think carefully about the exact point where exclusive locks are released."
  * *Expected Intent*: `CAUSAL_ANALYSIS`
* **`INTENT_020` (Marker: "Compare the difference...")**:
  * *Voice*: "Compare the difference between optimistic concurrency control and pessimistic locking. When the collision probability is under 1%, which one yields higher system throughput?"
  * *Expected Intent*: `COMPARATIVE_TRADEOFF`
* **`INTENT_021` (Marker: "Follow each step / Trace")**:
  * *Voice*: "Follow each step as a packet travels through a NAT router. First it modifies the source IP, then it writes to the translation table, then it recomputes the checksum."
  * *Expected Intent*: `PROCEDURAL_TRACE`
* **`INTENT_022` (Marker: "Focus on writing / coding")**:
  * *Voice*: "Focus on writing the recursive helper function. Make sure your base case checks for null pointers before you access left and right children."
  * *Expected Intent*: `IMPLEMENTATION_PRACTICE`

---

## 4. Benchmark Summary & Verification Metrics

```
================================================================================
          PHASE 4 GOLDEN BENCHMARK COMPOSITION (22 TOTAL CASES)
================================================================================
Category 1: Paired Same-Topic, Contrasting-Intent Cases   : 6 cases (3 pairs)
Category 2: Negative Boundary Adherence & Anti-Hallucination: 4 cases
Category 3: Conceptual-Hard Feasibility (No Code/Keywords): 4 cases
Category 4: Genuine Hard Infeasibility (True Deficits)    : 3 cases
Category 5: Intent & Meta-Discourse Marker Extraction     : 5 cases
================================================================================
```

### Verification Metrics & Success Targets

| Metric | Target | Definition |
| :--- | :---: | :--- |
| **Negative Boundary Adherence** | **100% (0 violations)** | Zero code questions, zero formula proofs, zero out-of-scope trivia generated when teacher explicitly excludes them. |
| **Contrasting Style Differentiation** | **100% (3/3 pairs)** | Lecturer A and Lecturer B on the same topic produce distinct, style-appropriate Hard questions (Implementation vs Behavioral). |
| **Conceptual-Hard Recall** | **$\ge 90\%$** | Rich conceptual lectures without procedural keywords successfully generate valid Hard questions without false deficits. |
| **Deficit Precision** | **100% (3/3 cases)** | Genuinely descriptive definition-only lectures are flagged as capacity deficits without hallucinating advanced questions. |
| **Intent Extraction Accuracy** | **$\ge 85\%$** | Spoken discourse markers correctly mapped to canonical intents (`EXPLORATION`, `CAUSAL`, `COMPARATIVE`, `PRACTICE`, `TRACE`). |

---

## 5. Next Steps

1. **Step 1 (Approved)**: Save this formal specification and compile the 22-case dataset into `evaluation_dataset/golden_benchmarks/intent_difficulty_benchmark.json`.
2. **Step 2**: Execute the **current production pipeline** against these 22 cases to establish the **Phase 4 baseline metrics** (capturing code hallucination rate, style collision rate, and false deficit rate).
3. **Step 3**: Design the generalized intent-relative model and evaluate it against the baseline before touching production code.
