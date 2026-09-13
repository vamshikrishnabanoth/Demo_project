# Level 1 Report: MongoDB Multi-Stage Aggregation Pipeline Query Assignment
**Input ID**: `input_005_assignment_mongodb` | **Input Type**: `ASSIGNMENT` | **Content Style**: `PROBLEM_SOLVING`

## 1. Quantitative Metrics Comparison

| Evaluation Dimension | Pipeline A (Summary) | Pipeline B (Blueprint) | Metric Interpretation |
| :--- | :---: | :---: | :--- |
| **Source Grounding** | 45.2% | 29.3% | Grounding in source chunks |
| **Source Answerability** | 24.7% | 25.1% | Answerable from provided material |
| **Average Bloom's Level** | 2.0 / 6.0 | 3.0 / 6.0 | Cognitive depth demand |
| **Material Specificity** | 3.06 / 5.0 | 2.45 / 5.0 | Reflection of specific treatment |
| **Genericness Index** | 1.0 / 5.0 | 1.0 / 5.0 | Lower = More uniquely tailored |
| **Question Diversity** | 0.946 | 0.855 | Intra-suite conceptual variety |
| **Composite Quality (Q)** | **0.45** | **0.423** | Standardized Quality Score |

### **DECISION: EQUIVALENT / INCONCLUSIVE**
> Both representations achieved comparable quality scores within the predefined threshold margin (Q_A=0.45, Q_B=0.423, delta=-0.027).

## 2. Experiment B1: Blueprint Validity Assessment
- **Topics Grounded in Source**: 80.0%
- **Salience Alignment Score**: 3.0 / 5.0
- **Instructional Act Accuracy**: 100.0%
- **Overall Blueprint Validity**: **67.3%**

## 3. Actual Generated Questions

### Pipeline A Questions (Summary)
**Q1 (UNDERSTAND)**: Which aggregation stage should be placed first to achieve optimal performance in the described pipeline?
- A: $match
- B: $unwind
- C: $lookup
- D: $group
- *Correct*: **A** | *Explanation*: Placing $match first filters documents using indexed fields (status and orderDate) before any expensive operations, minimizing the amount of data processed downstream. $unwind would deconstruct arrays before filtering, leading to unnecessary work. $lookup and $group also operate on larger data sets if placed before $match, reducing efficiency.

**Q2 (REMEMBER)**: What expression correctly computes total_revenue in the $group stage?
- A: { $sum: { $multiply: [ '$items.quantity', '$items.unit_price' ] } }
- B: { $avg: { $multiply: [ '$items.quantity', '$items.unit_price' ] } }
- C: { $sum: { $subtract: [ '$items.unit_price', '$productInfo.cost' ] } }
- D: { $count: {} }
- *Correct*: **A** | *Explanation*: total_revenue is defined as the sum of quantity multiplied by unit_price for each item, which matches option A. Option B uses $avg instead of $sum, yielding an average rather than total. Option C subtracts cost from unit_price, which calculates margin, not revenue. Option D simply counts documents and does not perform any arithmetic.

**Q3 (UNDERSTAND)**: Why is placing $unwind before $match considered an anti‑pattern in this pipeline?
- A: It forces the pipeline to unwind all array elements before filtering, consuming unnecessary memory.
- B: It creates duplicate documents that cannot be de‑duplicated later.
- C: It prevents the use of indexes on the fields used in $match.
- D: It changes the natural order of the documents, affecting $sort results.
- *Correct*: **A** | *Explanation*: When $unwind precedes $match, every array element is expanded even for orders that will later be discarded, leading to extra memory and CPU usage. Option B is incorrect because duplicates are not the primary issue. Option C is inaccurate; indexes are still usable in $match but are applied later, reducing their benefit. Option D is irrelevant; $unwind does not affect ordering relative to $sort.

**Q4 (APPLY)**: Which fields should be indexed to optimize the initial $match stage that selects delivered orders from 2024?
- A: status only
- B: orderDate only
- C: status and orderDate
- D: items.product_id
- *Correct*: **C** | *Explanation*: The $match filters on both status and orderDate, so a compound index on these two fields allows the query planner to quickly locate relevant documents. Indexing only one field (options A or B) would not be as efficient. Indexing items.product_id (option D) is useful for $lookup but does not help the initial $match.

**Q5 (UNDERSTAND)**: In the final $project stage, how is the total_revenue field formatted before being returned?
- A: It is rounded to two decimal places using $round.
- B: It is converted to a string with $toString.
- C: It is left unchanged, preserving full precision.
- D: It is truncated to an integer using $trunc.
- *Correct*: **A** | *Explanation*: The specification states that total_revenue should be rounded to two decimal places, which is achieved with the $round operator. Converting to string (B) or truncating to an integer (D) would not meet the rounding requirement. Leaving it unchanged (C) would retain more than two decimal places, violating the formatting rule.

### Pipeline B Questions (Blueprint)
**Q1 (UNDERSTAND)**: Which statement best describes how documents are processed in a MongoDB aggregation pipeline?
- A: Each stage applies a filter similar to a find query and returns a new collection.
- B: Documents pass through a sequence of stages where each stage transforms the documents and passes the result to the next stage.
- C: The pipeline runs all stages in parallel on the original collection.
- D: Only the final stage determines which documents are returned; earlier stages are ignored.
- *Correct*: **B** | *Explanation*: Option B is correct because an aggregation pipeline is a linear sequence of stages; each stage receives the output of the previous stage, transforms it, and forwards it. Option A confuses pipeline stages with find filters and suggests a new collection is created at each stage, which is inaccurate. Option C incorrectly describes parallel execution; stages are executed sequentially. Option D ignores the cumulative effect of earlier stages, which is essential to the pipeline's operation.

**Q2 (APPLY)**: You need to return only product categories whose total sales exceed 1,000 units. Which pipeline order will correctly produce this result?
- A: $group the documents by category, then $match on the aggregated total.
- B: $match on sales > 1,000, then $group by category, then another $match on the aggregated total.
- C: $group by category, $project the total, then $match on the projected total.
- D: $match on sales > 1,000, then $group by category, then $project the total.
- *Correct*: **A** | *Explanation*: Option A is correct because $match can be placed after $group to filter aggregated results; this is the standard way to keep only groups meeting a condition. Option B adds an unnecessary pre‑filter that would exclude individual sales records needed for the total. Option C works but adds an extra $project that is not required for the filter. Option D filters before grouping, which would miss sales that individually are below 1,000 but contribute to a category total above 1,000.

**Q3 (ANALYZE)**: A pipeline starts with $unwind on a large "items" array, followed by $match on the field "items.type" which is indexed. Which modification is most likely to improve performance?
- A: Move the $match stage before the $unwind stage.
- B: Add another $match stage after $unwind to further filter documents.
- C: Replace $unwind with $project to reshape the document.
- D: Insert a $sort stage before the $match stage.
- *Correct*: **A** | *Explanation*: Option A is correct because placing $match before $unwind allows MongoDB to use the index on "items.type" to eliminate many documents early, reducing the number of array elements that need to be unwound. Option B adds filtering after the expensive $unwind, offering little benefit. Option C does not address the need to deconstruct the array for aggregation. Option D introduces sorting, which adds overhead and does not help index utilization for the match condition.
