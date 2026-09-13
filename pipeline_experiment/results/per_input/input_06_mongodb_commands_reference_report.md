# Level 1 Report: MongoDB Command Reference: MongoImport, Indexing & Aggregation Syntax
**Input ID**: `input_06_mongodb_commands_reference` | **Input Type**: `NOTES` | **Content Style**: `CODE`

## 1. Quantitative Metrics Comparison

| Evaluation Dimension | Pipeline A (Summary) | Pipeline B (Blueprint) | Metric Interpretation |
| :--- | :---: | :---: | :--- |
| **Source Grounding** | 48.9% | 39.6% | Grounding in source chunks |
| **Source Answerability** | 37.0% | 25.5% | Answerable from provided material |
| **Average Bloom's Level** | 2.2 / 6.0 | 2.5 / 6.0 | Cognitive depth demand |
| **Material Specificity** | 3.18 / 5.0 | 2.86 / 5.0 | Reflection of specific treatment |
| **Genericness Index** | 1.0 / 5.0 | 1.0 / 5.0 | Lower = More uniquely tailored |
| **Question Diversity** | 0.935 | 0.946 | Intra-suite conceptual variety |
| **Composite Quality (Q)** | **0.508** | **0.451** | Standardized Quality Score |

### **DECISION: SUMMARY**
> Summary produced higher composite quality (Q_A=0.508 vs Q_B=0.451, delta=-0.057) on static/factual content.

## 2. Experiment B1: Blueprint Validity Assessment
- **Topics Grounded in Source**: 100.0%
- **Salience Alignment Score**: 4.5 / 5.0
- **Instructional Act Accuracy**: 70.0%
- **Overall Blueprint Validity**: **59.5%**

## 3. Actual Generated Questions

### Pipeline A Questions (Summary)
**Q1 (APPLY)**: A developer needs to import a large CSV file into a MongoDB Atlas collection. The file contains a header row with column names. Which `mongoimport` command configuration is correct?
- A: mongoimport --uri="mongodb+srv://..." --collection=products --type=csv --headerline data.csv
- B: mongoimport --uri="mongodb+srv://..." --collection=products --type=csv --jsonArray data.csv
- C: mongoimport --uri="mongodb+srv://..." --collection=products --type=json --headerline data.csv
- D: mongoimport --uri="mongodb+srv://..." --collection=products --type=csv --noHeaderLine data.csv
- *Correct*: **A** | *Explanation*: Option A is correct because the material specifies using `--type=csv` and `--headerline` for CSV files that contain column names in the first row. Option B is incorrect because `--jsonArray` is used for JSON files, not CSV. Option C is incorrect because the file type is CSV, not JSON. Option D is incorrect because `--noHeaderLine` (or lack of `--headerline`) implies the first row is data, not column names.

**Q2 (UNDERSTAND)**: In a MongoDB Aggregation Pipeline, what is the primary function of the `$lookup` stage?
- A: To filter documents based on specific conditions before grouping.
- B: To perform a left outer join between collections by matching localField to foreignField.
- C: To sort the documents in ascending or descending order.
- D: To reshape the output documents by including or excluding specific fields.
- *Correct*: **B** | *Explanation*: Option B is correct as the material defines `$lookup` as performing a left outer join between collections. Option A describes `$match`. Option C describes `$sort`. Option D describes `$project`.

**Q3 (APPLY)**: A database administrator wants to verify if a query is utilizing a specific compound index on `category` and `price`. Which method should they use?
- A: Use .explain("executionStats") to analyze the query plan.
- B: Use .count() to check the number of documents returned.
- C: Use .find() with a limit of 1 to inspect the first document.
- D: Use .aggregate() with a $match stage to filter the data.
- *Correct*: **A** | *Explanation*: Option A is correct because the material explicitly states that `.explain("executionStats")` is used to analyze query plans and verify index utilization. Options B, C, and D are standard query operations that do not provide execution plan details or index usage statistics.

**Q4 (REMEMBER)**: Which update operator is used to remove a specific field from a document in MongoDB?
- A: $set
- B: $unset
- C: $push
- D: $inc
- *Correct*: **B** | *Explanation*: Option B is correct as the material lists `$unset` as the operator to remove fields. Option A (`$set`) modifies or adds fields. Option C (`$push`) adds elements to arrays. Option D (`$inc`) increments numeric values.

**Q5 (UNDERSTAND)**: In the context of MongoDB schema validation, what is the purpose of defining `bsonType` rules?
- A: To encrypt sensitive data fields within the document.
- B: To enforce data structure and types on collection documents to ensure data integrity.
- C: To automatically index all fields defined in the schema.
- D: To convert documents from JSON to BSON format upon insertion.
- *Correct*: **B** | *Explanation*: Option B is correct because the material defines Schema Validation as enforcing data structure and types (e.g., bsonType) to ensure data integrity. Option A is incorrect as validation does not handle encryption. Option C is incorrect as validation does not create indexes. Option D is incorrect as BSON conversion is a storage layer detail, not a validation rule.

### Pipeline B Questions (Blueprint)
**Q1 (REMEMBER)**: A developer needs to import a JSON file named `data.json` into the `users` collection of the `app` database. The JSON file contains a single array of objects (e.g., `[{"name": "Alice"}, {"name": "Bob"}]`). If the file contains documents with `_id` values that already exist in the collection, the developer wants to skip those duplicates rather than failing the import. Which command correctly achieves this?
- A: mongoimport --db app --collection users --file data.json --jsonArray --ignoreBlanks
- B: mongoimport --db app --collection users --file data.json --jsonArray --mode upsert
- C: mongoimport --db app --collection users --file data.json --jsonArray --mode insert --ignoreBlanks
- D: mongoimport --db app --collection users --file data.json --jsonArray --mode insert --ignoreBlanks --stopOnError=false
- *Correct*: **D** | *Explanation*: Option D is correct because `--jsonArray` is required to parse a JSON array file, `--mode insert` is the default but explicitly stated, and `--stopOnError=false` allows the import to continue past duplicate key errors (skipping them) instead of aborting. Option A is incorrect because `--ignoreBlanks` ignores empty fields, not duplicate keys, and the import would fail on the first duplicate. Option B is incorrect because `--mode upsert` would update existing documents with the same `_id` rather than skipping them. Option C is incorrect because without `--stopOnError=false`, the import process terminates immediately upon encountering the first duplicate key error.

**Q2 (APPLY)**: Consider the following MongoDB document: `{ "_id": 1, "tags": ["tech", "news"] }`. A developer executes the following update command: `db.collection.updateOne({ _id: 1 }, { $push: { tags: "tech" } })`. What is the resulting state of the `tags` array in the document?
- A: ["tech", "news"]
- B: ["tech", "news", "tech"]
- C: ["news", "tech"]
- D: The operation fails because "tech" already exists in the array.
- *Correct*: **B** | *Explanation*: Option B is correct because the `$push` operator appends the specified value to the end of the array regardless of whether it already exists. Since "tech" was already in the array, it is added again, resulting in `["tech", "news", "tech"]`. Option A is incorrect because it assumes the behavior of `$addToSet`, which prevents duplicates. Option C is incorrect because `$push` appends to the end, it does not reorder or replace existing elements. Option D is incorrect because `$push` does not check for uniqueness; it always succeeds in appending the value.

**Q3 (APPLY)**: A collection contains documents with a field `categories` that is an array of strings. You need to find all documents where the `categories` array contains at least one of the following values: "electronics", "books", or "toys". Which query operator and syntax correctly implements this logic?
- A: db.collection.find({ categories: { $all: ["electronics", "books", "toys"] } })
- B: db.collection.find({ categories: { $in: ["electronics", "books", "toys"] } })
- C: db.collection.find({ categories: { $eq: ["electronics", "books", "toys"] } })
- D: db.collection.find({ categories: ["electronics", "books", "toys"] })
- *Correct*: **B** | *Explanation*: Option B is correct because `$in` matches documents where the field value is equal to any of the values specified in the array. For array fields, it checks if any element in the field's array matches any element in the `$in` array. Option A is incorrect because `$all` requires the document's array to contain ALL of the specified values. Option C is incorrect because `$eq` with an array checks for exact array equality (order and content), not containment. Option D is incorrect because specifying an array directly in the query without an operator checks for exact array match, not partial containment.

**Q4 (APPLY)**: A document in the `products` collection has the structure: `{ "_id": 1, "name": "Laptop", "specs": ["16GB RAM", "512GB SSD", "Intel i7"] }`. You want to create an aggregation pipeline that outputs one document for each specification, where each output document contains the product name and a single specification string. Which stage must be included in the pipeline to achieve this transformation?
- A: { $project: { name: 1, specs: 1 } }
- B: { $unwind: "$specs" }
- C: { $group: { _id: "$specs", name: { $first: "$name" } } }
- D: { $match: { specs: { $exists: true } } }
- *Correct*: **B** | *Explanation*: Option B is correct because `$unwind` deconstructs an array field into separate documents. Applying `{ $unwind: "$specs" }` to the input document will produce three output documents: `{ "_id": 1, "name": "Laptop", "specs": "16GB RAM" }`, `{ "_id": 1, "name": "Laptop", "specs": "512GB SSD" }`, and `{ "_id": 1, "name": "Laptop", "specs": "Intel i7" }`. Option A is incorrect because `$project` only reshapes the document but keeps `specs` as an array. Option C is incorrect because `$group` aggregates documents based on a key; while it might group by spec, it doesn't inherently deconstruct the array in the same way and requires careful handling of the `_id` to achieve the desired output structure, but `$unwind` is the standard and direct method for this specific transformation. Option D is incorrect because `$match` only filters documents; it does not change the structure of the `specs` field.
