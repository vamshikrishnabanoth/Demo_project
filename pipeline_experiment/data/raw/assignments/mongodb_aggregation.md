# Assignment: MongoDB Multi-Stage Aggregation Pipeline

## Problem Statement
Given an e-commerce database with collections `orders`, `products`, and `users`, construct multi-stage aggregation queries to produce business metrics.

### Stage Constraints and Operators
1. `$match`: Filter completed orders with status `DELIVERED` placed within year 2024.
2. `$unwind`: Deconstruct the `items` array to process individual product records.
3. `$lookup`: Join with `products` collection matching `items.product_id` to `_id` to fetch product categories and unit costs.
4. `$group`: Group by `product.category` and compute:
   - `total_revenue`: `$sum: { $multiply: ["$items.quantity", "$items.unit_price"] }`
   - `average_item_margin`: `$avg: { $subtract: ["$items.unit_price", "$products.cost"] }`
5. `$sort`: Sort descending by `total_revenue`.
6. `$project`: Restructure output suppressing `_id` and formatting revenue to 2 decimal places.

### Important Anti-Patterns to Avoid
- Never place `$unwind` before `$match` because unwinding the entire collection before filtering explodes memory usage.
- Ensure indexing on fields utilized in the initial `$match` stage for pipeline optimization.
