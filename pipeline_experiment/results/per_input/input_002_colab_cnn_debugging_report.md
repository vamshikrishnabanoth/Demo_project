# Level 1 Report: PyTorch CNN Layer Building & Shape Mismatch Debugging
**Input ID**: `input_002_colab_cnn_debugging` | **Input Type**: `COLAB` | **Content Style**: `DEBUGGING`

## 1. Quantitative Metrics Comparison

| Evaluation Dimension | Pipeline A (Summary) | Pipeline B (Blueprint) | Metric Interpretation |
| :--- | :---: | :---: | :--- |
| **Source Grounding** | 37.6% | 27.9% | Grounding in source chunks |
| **Source Answerability** | 26.3% | 24.4% | Answerable from provided material |
| **Average Bloom's Level** | 2.0 / 6.0 | 3.67 / 6.0 | Cognitive depth demand |
| **Material Specificity** | 2.8 / 5.0 | 2.4 / 5.0 | Reflection of specific treatment |
| **Genericness Index** | 1.0 / 5.0 | 1.0 / 5.0 | Lower = More uniquely tailored |
| **Question Diversity** | 0.971 | 0.844 | Intra-suite conceptual variety |
| **Composite Quality (Q)** | **0.419** | **0.448** | Standardized Quality Score |

### **DECISION: EQUIVALENT / INCONCLUSIVE**
> Both representations achieved comparable quality scores within the predefined threshold margin (Q_A=0.419, Q_B=0.448, delta=0.029).

## 2. Experiment B1: Blueprint Validity Assessment
- **Topics Grounded in Source**: 75.0%
- **Salience Alignment Score**: 4.5 / 5.0
- **Instructional Act Accuracy**: 100.0%
- **Overall Blueprint Validity**: **62.7%**

## 3. Actual Generated Questions

### Pipeline A Questions (Summary)
**Q1 (UNDERSTAND)**: What is the output shape of a torch.nn.Conv2d layer with kernel_size=3, padding=1, stride=1 applied to an input tensor of shape (B, C_in, H, W)?
- A: (B, C_out, H, W)
- B: (B, C_out, H-2, W-2)
- C: (B, C_out, H+2, W+2)
- D: (B, C_out, H/2, W/2)
- *Correct*: **A** | *Explanation*: With kernel size 3, stride 1 and padding 1, the spatial dimensions are preserved, so the height and width remain H and W. The channel dimension changes to the number of output filters C_out, while the batch dimension B is unchanged. Option B incorrectly subtracts 2, Option C adds 2, and Option D describes the effect of a 2×2 pooling operation, not convolution.

**Q2 (UNDERSTAND)**: If a tensor of shape (B, 32, 16, 16) is passed through torch.nn.MaxPool2d(kernel_size=2, stride=2), what will be the resulting shape?
- A: (B, 32, 8, 8)
- B: (B, 32, 32, 32)
- C: (B, 64, 8, 8)
- D: (B, 32, 16, 16)
- *Correct*: **A** | *Explanation*: MaxPool2d with kernel 2 and stride 2 halves each spatial dimension, so 16 → 8 while keeping the batch and channel dimensions unchanged. Option B incorrectly enlarges the spatial size, Option C incorrectly doubles the channel count, and Option D leaves the shape unchanged, which would be true only for a stride of 1.

**Q3 (UNDERSTAND)**: Why did the original Linear layer definition nn.Linear(1024, 10) raise a RuntimeError in the SimpleCNN model?
- A: The in_features (1024) did not match the flattened tensor size (2048).
- B: The out_features (10) were too small for the classification task.
- C: The Linear layer was missing a bias term.
- D: The activation function after the Linear layer was omitted.
- *Correct*: **A** | *Explanation*: After the second pooling operation the tensor shape is (B, 32, 8, 8), which flattens to 32 × 8 × 8 = 2048 features per sample. The Linear layer expects an input size of 1024, causing a matrix‑multiplication size mismatch. The other options describe unrelated issues: out_features=10 is appropriate for a 10‑class problem, bias is optional and defaults to True, and the presence of an activation function does not affect the shape compatibility.

**Q4 (UNDERSTAND)**: Which statement correctly describes the effect of the call x.view(x.size(0), -1) in the forward method?
- A: It flattens all dimensions except the batch dimension into a single vector.
- B: It flattens the entire tensor, including the batch dimension, into a 1‑D vector.
- C: It reshapes the tensor to have shape (batch_size, 1) without changing the data.
- D: It swaps the batch dimension with the channel dimension.
- *Correct*: **A** | *Explanation*: x.size(0) returns the batch size B. Using -1 tells PyTorch to infer the product of the remaining dimensions, effectively collapsing channels, height, and width into one dimension while preserving B. Option B would lose the batch separation, Option C does not perform flattening, and Option D describes a transpose operation, not a view.

**Q5 (UNDERSTAND)**: Which optimizer is used in the training loop and what is its distinguishing characteristic?
- A: Adam; it adapts learning rates for each parameter using estimates of first and second moments.
- B: SGD; it uses a fixed learning rate and momentum.
- C: RMSprop; it only adapts learning rates based on a moving average of squared gradients.
- D: Adagrad; it accumulates squared gradients to adjust learning rates.
- *Correct*: **A** | *Explanation*: The summary specifies torch.optim.Adam as the optimizer. Adam combines momentum (first‑moment) and RMSprop‑like (second‑moment) adaptive learning rates, making it distinct from plain SGD, RMSprop, or Adagrad. Options B‑D describe other optimizers that are not used in the provided code.

### Pipeline B Questions (Blueprint)
**Q1 (APPLY)**: You have an input feature map of size 32×32 and you want a Conv2d layer that produces an output of size 28×28 using kernel_size=5, stride=1. What padding value should you set?
- A: 0
- B: 1
- C: 2
- D: 3
- *Correct*: **A** | *Explanation*: The Conv2d output size formula is (W‑K+2P)/S + 1. Plugging in W=32, K=5, S=1 and desired output 28 gives (32‑5+2P)/1 + 1 = 28 → 32‑5+2P+1 = 28 → 2P = 0 → P = 0. Therefore padding 0 yields the required 28×28 output. Option B (padding 1) would give (32‑5+2)/1+1 = 30, option C gives 32, and option D gives 34, all incorrect.

**Q2 (ANALYZE)**: Consider the following sequence: Conv2d(in_channels=3, out_channels=16, kernel_size=3, stride=1, padding=1) → MaxPool2d(kernel_size=2, stride=2) → Conv2d(16, 32, kernel_size=5, stride=1, padding=0) → MaxPool2d(kernel_size=3, stride=2). If the input image is 32×32, what is the spatial size (height × width) of the final feature map?
- A: 5×5
- B: 6×6
- C: 8×8
- D: 4×4
- *Correct*: **A** | *Explanation*: First Conv preserves size because padding=1: 32→32. First MaxPool halves it: 32→16. Second Conv reduces size: (16‑5)/1+1 = 12. Second MaxPool with kernel 3 and stride 2 gives floor((12‑3)/2)+1 = floor(9/2)+1 = 4+1 = 5. Hence the final spatial dimensions are 5×5. Options B, C, and D result from common misconceptions: forgetting that pooling changes size when stride ≠ kernel (B), assuming pooling does not change size (C), or mis‑applying floor vs ceil (D).

**Q3 (ANALYZE)**: A convolutional block outputs a tensor of shape (batch_size, 64, 8, 8). Which of the following statements correctly flattens the tensor for a subsequent Linear layer?
- A: x = x.view(-1, 64*8*8)
- B: x = x.view(batch_size, -1)
- C: x = x.view(-1, 64*8)
- D: x = x.view(64, -1)
- *Correct*: **A** | *Explanation*: Flattening must preserve the batch dimension and collapse the remaining dimensions into a single feature vector. x.view(-1, 64*8*8) lets PyTorch infer the batch size (the first dimension) and creates a second dimension of 64*8*8 = 4096 features, which is correct. Option B is ambiguous because the variable batch_size is not defined inside the view call; it would raise a NameError. Option C drops one spatial dimension, yielding 512 features, which is too small. Option D swaps dimensions and loses the batch axis entirely.
