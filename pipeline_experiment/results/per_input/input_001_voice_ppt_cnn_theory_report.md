# Level 1 Report: CNN Foundations: Inductive Biases, Receptive Fields & Spatial Math
**Input ID**: `input_001_voice_ppt_cnn_theory` | **Input Type**: `VOICE_PLUS_PPT` | **Content Style**: `THEORY`

## 1. Quantitative Metrics Comparison

| Evaluation Dimension | Pipeline A (Summary) | Pipeline B (Blueprint) | Metric Interpretation |
| :--- | :---: | :---: | :--- |
| **Source Grounding** | 39.6% | 32.7% | Grounding in source chunks |
| **Source Answerability** | 21.0% | 19.3% | Answerable from provided material |
| **Average Bloom's Level** | 2.0 / 6.0 | 3.67 / 6.0 | Cognitive depth demand |
| **Material Specificity** | 2.88 / 5.0 | 2.62 / 5.0 | Reflection of specific treatment |
| **Genericness Index** | 1.0 / 5.0 | 1.0 / 5.0 | Lower = More uniquely tailored |
| **Question Diversity** | 0.987 | 0.944 | Intra-suite conceptual variety |
| **Composite Quality (Q)** | **0.415** | **0.461** | Standardized Quality Score |

### **DECISION: EQUIVALENT / INCONCLUSIVE**
> Both representations achieved comparable quality scores within the predefined threshold margin (Q_A=0.415, Q_B=0.461, delta=0.046).

## 2. Experiment B1: Blueprint Validity Assessment
- **Topics Grounded in Source**: 100.0%
- **Salience Alignment Score**: 4.5 / 5.0
- **Instructional Act Accuracy**: 100.0%
- **Overall Blueprint Validity**: **74.0%**

## 3. Actual Generated Questions

### Pipeline A Questions (Summary)
**Q1 (REMEMBER)**: Using the output dimension formula O = floor((W - K + 2P) / S) + 1, what is the output width when W = 32, K = 5, P = 2, and S = 1?
- A: 28
- B: 30
- C: 32
- D: 34
- *Correct*: **C** | *Explanation*: Plugging the values into the formula: O = floor((32 - 5 + 2*2) / 1) + 1 = floor((32 - 5 + 4) / 1) + 1 = floor(31 / 1) + 1 = 31 + 1 = 32. Therefore option C is correct. Option A (28) and B (30) result from mistakenly omitting the padding term or mis‑applying the floor operation. Option D (34) would require adding padding twice or using a larger stride, which is not the case.

**Q2 (UNDERSTAND)**: Which combination of inductive biases in a CNN guarantees translation equivariance?
- A: Local connectivity only
- B: Weight sharing only
- C: Both local connectivity and weight sharing
- D: Neither; translation equivariance is learned automatically
- *Correct*: **C** | *Explanation*: Translation equivariance arises because each filter (weight sharing) is applied to every spatial location (local connectivity). Neither bias alone is sufficient: local connectivity without weight sharing would treat each location differently, and weight sharing without restricting the receptive field would not enforce locality. Hence option C is correct. Options A and B isolate one bias and miss the synergy required. Option D is incorrect because equivariance is a built‑in property of the convolution operation, not something that must be learned.

**Q3 (ANALYZE)**: Compared to a single 7×7 convolutional filter, three stacked 3×3 filters require:
- A: Fewer parameters
- B: More parameters
- C: The same number of parameters
- D: Cannot be determined without knowing the number of channels
- *Correct*: **A** | *Explanation*: A single 7×7 filter uses 49·C² parameters (C = number of channels). Three 3×3 filters use 3·9·C² = 27·C² parameters, which is fewer. Therefore option A is correct. Option B is the opposite of the true relationship. Option C would be true only if the kernel sizes were equal. Option D is unnecessary because the factor C² appears in both expressions and cancels out when comparing relative sizes.

**Q4 (UNDERSTAND)**: What is the effective receptive field size after stacking three convolutional layers each with a 3×3 kernel (stride = 1, no padding)?
- A: 3×3
- B: 5×5
- C: 7×7
- D: 9×9
- *Correct*: **C** | *Explanation*: Each 3×3 layer expands the receptive field by 2 pixels in each dimension. After three layers, the total expansion is 2 + 2 + 2 = 6, giving a receptive field of (3 + 6) = 7 pixels per side, i.e., 7×7. Hence option C is correct. Option A ignores stacking, option B corresponds to two layers, and option D would require four layers or larger kernels.

**Q5 (REMEMBER)**: What is a primary drawback of using a standard Multilayer Perceptron (MLP) on a high‑resolution image such as 256×256?
- A: The MLP would have too few parameters to learn useful features
- B: Spatial relationships between pixels are lost after flattening
- C: Both the excessive parameter count and loss of spatial relationships
- D: MLPs are actually well‑suited for high‑resolution images; there is no drawback
- *Correct*: **C** | *Explanation*: Flattening a 256×256 image creates a vector of length 65,536. Connecting this to even a modest hidden layer yields on the order of 200,000+ parameters, which is computationally expensive (option A). Moreover, flattening destroys the 2‑D spatial structure, preventing the network from exploiting locality (option B). Therefore both issues together constitute the main drawback, making option C correct. Option D contradicts the well‑documented limitations described in the material.

### Pipeline B Questions (Blueprint)
**Q1 (ANALYZE)**: Which of the following best explains why a convolutional neural network is not perfectly translation‑invariant, especially near image borders?
- A: Weight sharing guarantees identical responses for any spatial shift, so borders have no effect.
- B: Zero‑padding or other border handling introduces edge effects that break full translation invariance.
- C: Local receptive fields limit the network to only small translations, making it invariant only locally.
- D: Pooling layers destroy all translation information, preventing any invariance.
- *Correct*: **B** | *Explanation*: Option B is correct because the way CNNs handle borders (e.g., zero‑padding) creates artificial values that differ from interior pixels, so a feature shifted to the edge is processed differently. Option A is wrong: weight sharing promotes invariance but does not eliminate border effects. Option C confuses locality with invariance; locality enables translation invariance but does not restrict it to small shifts. Option D misstates the role of pooling: pooling provides some robustness to small shifts but does not eliminate translation invariance altogether.

**Q2 (APPLY)**: A 32×32 input feature map is processed by a convolutional layer with kernel size 5×5, stride 2, and padding 1. What is the spatial size of the output feature map?
- A: 13×13
- B: 14×14
- C: 15×15
- D: 16×16
- *Correct*: **C** | *Explanation*: The output dimension formula is floor((N+2p‑k)/s)+1. Substituting N=32, p=1, k=5, s=2 gives floor((32+2‑5)/2)+1 = floor(29/2)+1 = 14+1 = 15. Therefore the output is 15×15. Option A (13) and B (14) result from forgetting the +1 or mis‑handling the floor operation. Option D (16) comes from adding instead of dividing or using ceiling. The correct answer is C.

**Q3 (ANALYZE)**: Consider two design choices that produce a receptive field of size 5×5 on the input image: (i) a single 5×5 convolution (no padding, stride 1) and (ii) two consecutive 3×3 convolutions (no padding, stride 1). Which statement about their receptive fields is true?
- A: The stacked 3×3 convolutions have a larger receptive field than the single 5×5 convolution.
- B: The single 5×5 convolution has a larger receptive field than the stacked 3×3 convolutions.
- C: Both designs result in the same 5×5 receptive field.
- D: The receptive field depends on the number of channels, not the kernel sizes.
- *Correct*: **C** | *Explanation*: Two 3×3 convolutions expand the receptive field by (3‑1)+(3‑1)=4 pixels in each dimension, yielding a 5×5 field, exactly the same as a single 5×5 kernel. Option A is a common misconception that stacking always enlarges the field beyond the equivalent large kernel. Option B ignores the additive effect of stacking. Option D is irrelevant; receptive field size is determined by kernel size, stride, and stacking, not channel count. Hence C is correct.
