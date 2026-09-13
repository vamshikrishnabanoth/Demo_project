# Level 1 Report: MongoDB CRUD Operations: Amazon Product Management System Queries
**Input ID**: `input_05_assignment_mongodb_crud` | **Input Type**: `ASSIGNMENT` | **Content Style**: `PROBLEM_SOLVING`

## 1. Quantitative Metrics Comparison

| Evaluation Dimension | Pipeline A (Summary) | Pipeline B (Blueprint) | Metric Interpretation |
| :--- | :---: | :---: | :--- |
| **Source Grounding** | 50.0% | 24.9% | Grounding in source chunks |
| **Source Answerability** | 28.7% | 14.6% | Answerable from provided material |
| **Average Bloom's Level** | 2.4 / 6.0 | 2.0 / 6.0 | Cognitive depth demand |
| **Material Specificity** | 3.19 / 5.0 | 2.34 / 5.0 | Reflection of specific treatment |
| **Genericness Index** | 1.0 / 5.0 | 1.0 / 5.0 | Lower = More uniquely tailored |
| **Question Diversity** | 0.886 | 0.935 | Intra-suite conceptual variety |
| **Composite Quality (Q)** | **0.501** | **0.328** | Standardized Quality Score |

### **DECISION: SUMMARY**
> Summary produced higher composite quality (Q_A=0.501 vs Q_B=0.328, delta=-0.173) on static/factual content.

## 2. Experiment B1: Blueprint Validity Assessment
- **Topics Grounded in Source**: 50.0%
- **Salience Alignment Score**: 3.0 / 5.0
- **Instructional Act Accuracy**: 100.0%
- **Overall Blueprint Validity**: **52.5%**

## 3. Actual Generated Questions

### Pipeline A Questions (Summary)
**Q1 (UNDERSTAND)**: In the context of the Amazon Product Management System, which MongoDB query operation is primarily used to retrieve only the Product ID, Name, Stock, and Brand fields for products with a stock level less than 20?
- A: Sorting
- B: Projection
- C: Aggregation
- D: Indexing
- *Correct*: **B** | *Explanation*: The correct option is B (Projection). Projection is the mechanism used in MongoDB to restrict the output to specific fields, preventing the return of the entire document. In this scenario, the requirement to display only 'Product ID, Name, Stock, and Brand' explicitly calls for projection. Option A (Sorting) is incorrect because sorting arranges documents in a specific order (e.g., ascending/descending) but does not limit which fields are displayed. Option C (Aggregation) is incorrect as it involves processing data records through a pipeline for calculations or transformations, which is not the primary goal here. Option D (Indexing) is incorrect because it is a performance optimization technique for faster data retrieval, not a method for selecting specific fields in the output.

**Q2 (APPLY)**: When filtering products in the Amazon system to find items with a price greater than 10,000 and displaying them from most to least expensive, which combination of operations is required?
- A: Filtering with < operator and Sorting in ascending order
- B: Filtering with > operator and Sorting in descending order
- C: Filtering with > operator and Sorting in ascending order
- D: Filtering with < operator and Sorting in descending order
- *Correct*: **B** | *Explanation*: The correct option is B. The condition 'price greater than 10,000' requires the use of the greater than (>) comparison operator. The requirement to display items 'from most to least expensive' necessitates sorting the results in descending order. Option A is incorrect because it uses the less than (<) operator and ascending sort, which would find cheap items and list them from lowest to highest price. Option C is incorrect because while it uses the correct operator, ascending sort would list the most expensive items last. Option D is incorrect because it uses the wrong operator (<) for the price condition.

**Q3 (UNDERSTAND)**: To retrieve restaurant records where the name starts with the letter 'P', which string matching technique is most appropriately applied in MongoDB?
- A: Numeric comparison using the > operator
- B: Regex or prefix matching
- C: Full document equality check
- D: Sorting by name in ascending order
- *Correct*: **B** | *Explanation*: The correct option is B (Regex or prefix matching). The material explicitly states that string matching utilizes regex or prefix matching to find documents where a string field begins with a specific character. Option A is incorrect because numeric operators cannot be applied to string fields for pattern matching. Option C is incorrect because an equality check would only find names that are exactly 'P', not those starting with 'P'. Option D is incorrect because sorting organizes data but does not filter it based on a specific pattern.

**Q4 (REMEMBER)**: In the Hospital Management System scenario, which fields are specifically projected when filtering patient records by age greater than 40?
- A: Patient ID, Address, and Phone Number
- B: Name, Age, Disease, and Doctor details
- C: All available fields in the patient document
- D: Age and Bill amount only
- *Correct*: **B** | *Explanation*: The correct option is B. The factual summary and examples explicitly state that for senior patients (age > 40), the projection includes the patient's name, age, disease, and doctor details. Option A is incorrect as these fields are not mentioned in the context of the age > 40 query. Option C is incorrect because the exercise emphasizes using projection to limit output, not returning the entire document. Option D is incorrect because it omits the name, disease, and doctor details which are part of the specified projection.

**Q5 (ANALYZE)**: Which of the following best describes the primary purpose of the 'Read' operations demonstrated in the Amazon and Hospital management system exercises?
- A: To insert new product and patient records into the database
- B: To modify existing stock levels and patient ages
- C: To retrieve specific subsets of data based on numeric and string criteria
- D: To delete obsolete product and patient records
- *Correct*: **C** | *Explanation*: The correct option is C. The material focuses on 'Read' queries, which involve filtering documents based on numeric comparisons (stock, price, age) and string patterns (names). This process retrieves specific subsets of data. Option A describes 'Create' operations. Option B describes 'Update' operations. Option D describes 'Delete' operations. The exercises do not involve modifying or removing data, only querying it.

### Pipeline B Questions (Blueprint)
**Q1 (UNDERSTAND)**: In an Amazon product management system, a document contains a top-level field `price` and a nested field `dimensions.weight`. Which of the following statements correctly describes how MongoDB resolves these fields during a query?
- A: Both `price` and `dimensions.weight` are treated as top-level keys in the index, requiring separate index entries for each.
- B: `price` is accessed directly, while `dimensions.weight` is resolved using dot notation to traverse the embedded document structure.
- C: `dimensions.weight` must be accessed via array indexing (e.g., `dimensions[0].weight`) regardless of whether `dimensions` is an object or array.
- D: Nested fields like `dimensions.weight` cannot be queried directly and must be flattened into top-level fields before querying.
- *Correct*: **B** | *Explanation*: Option B is correct because MongoDB uses dot notation to access fields within embedded documents. `price` is a top-level field, while `dimensions.weight` requires traversing the `dimensions` object to reach `weight`. Option A is incorrect because nested fields are not automatically top-level keys; they are part of the parent document's structure. Option C is incorrect because dot notation works for both objects and arrays without requiring explicit array indexing unless specific element access is needed. Option D is incorrect because MongoDB natively supports querying nested fields without flattening.

**Q2 (UNDERSTAND)**: A product document has an array field `tags` containing ["electronics", "sale", "new"]. Which statement accurately describes the behavior of the query `{ tags: { $gt: "electronics" } }`?
- A: The query compares the entire array object to the string "electronics" and returns no results.
- B: The query matches if any element in the `tags` array is lexicographically greater than "electronics".
- C: The query requires explicit array element indexing (e.g., `tags.0`) to compare individual elements.
- D: The query performs a substring match and returns documents where "electronics" is a substring of any tag.
- *Correct*: **B** | *Explanation*: Option B is correct because comparison operators like `$gt` on array fields in MongoDB match if any element in the array satisfies the condition. Option A is incorrect because MongoDB does not compare the entire array object to a scalar value in this context. Option C is incorrect because explicit indexing is not required for general array element matching. Option D is incorrect because `$gt` performs a comparison, not a substring match.

**Q3 (UNDERSTAND)**: To find products in the categories "electronics" or "books", which of the following queries is most appropriate and efficient in MongoDB?
- A: `{ category: { $in: ["electronics", "books"] } }`
- B: `{ category: "electronics" }` followed by a separate query for `{ category: "books" }` and merging results.
- C: `{ $or: [{ category: "electronics" }, { category: "books" }] }`
- D: `{ category: { $regex: "electronics|books" } }`
- *Correct*: **A** | *Explanation*: Option A is correct because the `$in` operator is specifically designed to match any value in a list, making it more concise and often more efficient than chaining `$or` conditions. Option B is incorrect because it requires multiple queries, which is less efficient. Option C is functionally equivalent but less concise and may have higher overhead. Option D is incorrect because `$regex` performs substring matching, which is not the intended behavior for exact category matches.

**Q4 (UNDERSTAND)**: In an Amazon-like system, why might it be preferable to embed product reviews within the product document rather than storing them in a separate collection?
- A: Embedding ensures that all related data is normalized, avoiding duplication.
- B: Embedding reduces the need for joins, improving read performance for high-read, low-write scenarios.
- C: Embedding allows for easier scaling of the review collection independently from the product collection.
- D: Embedding is required by MongoDB to maintain referential integrity.
- *Correct*: **B** | *Explanation*: Option B is correct because embedding reviews in the product document reduces the need for joins, which improves read performance, especially in high-read, low-write scenarios. Option A is incorrect because embedding does not normalize data; it denormalizes it. Option C is incorrect because embedding does not allow independent scaling of reviews. Option D is incorrect because MongoDB does not enforce referential integrity through embedding.

**Q5 (UNDERSTAND)**: Why is a flexible schema (schema-less) advantageous for storing product attributes like 'color', 'size', and 'material' in MongoDB?
- A: It ensures that all products have identical fields, preventing data inconsistency.
- B: It allows for sparse documents, accommodating varying product types without requiring all fields to be present.
- C: It enforces strict data types for all attributes, ensuring data integrity.
- D: It reduces the storage size of the database by compressing all documents.
- *Correct*: **B** | *Explanation*: Option B is correct because a flexible schema allows for sparse documents, where different products can have different attributes without requiring all fields to be present. Option A is incorrect because a flexible schema does not enforce identical fields. Option C is incorrect because a flexible schema does not enforce strict data types. Option D is incorrect because a flexible schema does not inherently reduce storage size through compression.
