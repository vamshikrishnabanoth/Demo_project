import os
import zipfile
from PIL import Image, ImageDraw

def main():
    test_dir = os.path.join(os.path.dirname(__file__), 'test_materials')
    os.makedirs(test_dir, exist_ok=True)

    # 1. Create academic_table.docx
    base_docx = os.path.join(os.path.dirname(__file__), 'node_modules', 'mammoth', 'test', 'test-data', 'tables.docx')
    out_docx = os.path.join(test_dir, 'academic_table.docx')

    doc_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
  <w:p><w:r><w:t>Relational Database Indexing and Storage Structures</w:t></w:r></w:p>
  <w:p><w:r><w:t>Introduction to Database Indexing</w:t></w:r></w:p>
  <w:p><w:r><w:t>A database index is a data structure that improves the speed of data retrieval operations on a database table at the cost of additional storage space and write-time overhead. Without an index, querying a table requires a full table scan, i.e., the database engine reads every row sequentially until matching rows are found. For large tables this is prohibitively expensive, often O(N). An index creates a separate auxiliary structure keyed on one or more columns that allows the engine to jump directly to relevant rows, reducing search time to O(log N) for balanced tree structures or O(1) for hash-based structures in the average case.</w:t></w:r></w:p>
  <w:p><w:r><w:t>Types of Database Indexes</w:t></w:r></w:p>
  <w:p><w:r><w:t>The two most widely deployed index structures in relational database management systems are B-Tree indexes and Hash indexes. Each structure is optimised for a different class of queries and carries distinct trade-offs with respect to storage utilisation, insertion cost, and supported predicate types.</w:t></w:r></w:p>
  <w:p><w:r><w:t>B-Tree Index: A B-Tree (Balanced Tree) index organises index entries in a balanced, multi-level tree where every path from the root to a leaf node has equal length. Internal nodes store separator keys that guide search traversal, while leaf nodes store the actual indexed key values and pointers to the corresponding heap tuples. Because the tree is always balanced, search, insertion, and deletion all execute in O(log N) time. B-Trees natively support equality predicates (WHERE col = value), range predicates (WHERE col BETWEEN a AND b), and ORDER BY operations on the indexed column without a separate sort step. PostgreSQL, MySQL InnoDB, Oracle, and SQL Server all default to B-Tree for general-purpose indexes.</w:t></w:r></w:p>
  <w:p><w:r><w:t>Hash Index: A Hash index applies a hash function to the indexed column value to compute a bucket address, then stores the (hash, row pointer) pair in that bucket. Point-equality lookups execute in O(1) average time because the engine hashes the query value and probes exactly one bucket. However, because hashing destroys ordering information, Hash indexes cannot satisfy range predicates or ORDER BY clauses. Hash indexes are most beneficial for columns used exclusively in equality joins or WHERE col = value predicates, such as primary-key lookups by UUID.</w:t></w:r></w:p>
  <w:tbl>
    <w:tr>
      <w:tc><w:p><w:r><w:t>Index Type</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>Search Complexity</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>Insert Complexity</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>Supported Query Operations</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>Range Queries</w:t></w:r></w:p></w:tc>
    </w:tr>
    <w:tr>
      <w:tc><w:p><w:r><w:t>B-Tree Index</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>O(log N)</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>O(log N)</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>Equality, range, ORDER BY, LIKE prefix</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>Yes</w:t></w:r></w:p></w:tc>
    </w:tr>
    <w:tr>
      <w:tc><w:p><w:r><w:t>Hash Index</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>O(1) average</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>O(1) average</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>Equality only</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>No</w:t></w:r></w:p></w:tc>
    </w:tr>
    <w:tr>
      <w:tc><w:p><w:r><w:t>GiST / GIN Index</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>O(log N)</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>O(log N)</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>Full-text search, geometric, JSONB containment</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>Partial (type-dependent)</w:t></w:r></w:p></w:tc>
    </w:tr>
  </w:tbl>
  <w:p><w:r><w:t>Clustered vs Non-Clustered Indexes</w:t></w:r></w:p>
  <w:p><w:r><w:t>A clustered index determines the physical order in which rows are stored on disk. Because a table can only be physically sorted in one way, each table can have at most one clustered index. In SQL Server and MySQL InnoDB, the primary key is automatically the clustered index. Row reads that follow the clustered index order benefit from sequential I/O, minimising disk seeks. A non-clustered index is a separate structure that stores index keys and row pointers but does not affect physical storage order. A table may have many non-clustered indexes, each accelerating different query patterns at the cost of extra storage and additional write amplification on insert, update, and delete operations.</w:t></w:r></w:p>
  <w:p><w:r><w:t>Index Selectivity and the Query Planner</w:t></w:r></w:p>
  <w:p><w:r><w:t>Index selectivity measures the fraction of distinct values in an indexed column relative to total row count. High-selectivity columns (e.g., a UUID primary key) have many distinct values; the index filters the result set down to a very small number of rows, making index access highly efficient. Low-selectivity columns (e.g., a boolean flag) have few distinct values; scanning via the index may actually be slower than a sequential heap scan because of the overhead of jumping between scattered row locations. The query planner (also called the optimiser) in modern RDBMS systems uses table statistics — maintained by commands such as ANALYZE in PostgreSQL or UPDATE STATISTICS in SQL Server — to estimate selectivity and decide whether to use an index or perform a sequential scan.</w:t></w:r></w:p>
  <w:p><w:r><w:t>Composite Indexes and Column Order</w:t></w:r></w:p>
  <w:p><w:r><w:t>A composite index (also called a multi-column or concatenated index) is built on two or more columns. The column order within the index is critical: the index can accelerate queries that filter on a prefix of the indexed columns, but it cannot satisfy queries that skip leading columns. For example, an index on (last_name, first_name, birth_year) efficiently serves queries filtering on last_name alone, or last_name plus first_name, or all three columns. A query filtering only on first_name or only on birth_year cannot use this index. This rule is known as the leftmost prefix rule and is fundamental to designing effective multi-column indexes.</w:t></w:r></w:p>
  <w:p><w:r><w:t>Storage and Maintenance Overhead</w:t></w:r></w:p>
  <w:p><w:r><w:t>Every index consumes additional disk storage proportional to the number of indexed rows and the size of the indexed columns. More importantly, every DML operation (INSERT, UPDATE, DELETE) that affects an indexed column must update all associated indexes in addition to the heap table. This write amplification means that over-indexing a write-heavy table can severely degrade throughput. Database administrators must balance read acceleration against write overhead when designing index strategies, regularly reviewing index usage statistics to drop unused or redundant indexes.</w:t></w:r></w:p>
</w:body>
</w:document>"""

    with zipfile.ZipFile(base_docx, 'r') as zin:
        with zipfile.ZipFile(out_docx, 'w') as zout:
            for item in zin.infolist():
                if item.filename == 'word/document.xml':
                    zout.writestr(item.filename, doc_xml.encode('utf-8'))
                else:
                    zout.writestr(item.filename, zin.read(item.filename))
    print(f"[OK] Created: {out_docx}")

    # 2. Create scanned_paging.png
    out_png = os.path.join(test_dir, 'scanned_paging.png')
    img = Image.new('RGB', (900, 350), color=(255, 255, 255))
    d = ImageDraw.Draw(img)
    text = (
        "Operating Systems Memory Management\n\n"
        "Paging divides logical memory into fixed-size blocks called pages.\n"
        "Physical memory is partitioned into blocks of identical size called frames.\n"
        "The page table maps logical page numbers to physical frame numbers in memory."
    )
    d.text((25, 30), text, fill=(0, 0, 0))
    img.save(out_png)
    print(f"[OK] Created: {out_png}")

    # 3. Create corrupt/empty PDF for controlled failure testing
    out_empty_pdf = os.path.join(test_dir, 'blank_corrupt.pdf')
    with open(out_empty_pdf, 'wb') as f:
        # Valid PDF header (%PDF) so magic bytes pass, but with 0 readable text objects
        f.write(b"%PDF-1.4\n%Empty document containing no text blocks\n%%EOF\n")
    print(f"[OK] Created: {out_empty_pdf}")

if __name__ == '__main__':
    main()
