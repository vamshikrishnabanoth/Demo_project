/**
 * Short Topic & Small Description Expander (v3.3.0)
 * Allows teachers to input short terms (e.g., "OS", "Python", "Java", "C", "SQL", "HTML", "AI", "ML")
 * or short custom descriptions (e.g., "Python OS basics") by enriching them into rich academic context payloads.
 */

const DOMAIN_EXPANSION_MAP = {
  // Operating Systems
  "os": "Operating Systems (OS): Process Management, Process Scheduling (FCFS, Round Robin, SJF, Priority), Memory Management (Paging, Segmentation, Virtual Memory), Concurrency, Deadlocks, Inter-Process Communication (IPC), File Systems, System Calls, CPU Scheduling, and OS Security.",
  "operating system": "Operating Systems (OS): Process Management, Process Scheduling, Memory Management, Virtual Memory, Concurrency, Deadlocks, File Systems, System Calls, and CPU Scheduling.",
  "operating systems": "Operating Systems (OS): Process Management, Process Scheduling, Memory Management, Virtual Memory, Concurrency, Deadlocks, File Systems, System Calls, and CPU Scheduling.",

  // Programming Languages
  "python": "Python Programming Language: Variables, Data Types, Control Structures, Functions, Object-Oriented Programming (Classes, Inheritance, Polymorphism, Encapsulation), Data Structures (Lists, Dictionaries, Tuples, Sets), Asyncio & Concurrency, Decorators, Generators, Modules, and Exception Handling.",
  "java": "Java Programming Language: Object-Oriented Programming (Classes, Objects, Inheritance, Polymorphism, Abstraction, Encapsulation), Java Virtual Machine (JVM), Bytecode, Interfaces, Exception Handling, Collections Framework, Multithreading, Memory Management, and Garbage Collection.",
  "c": "C Programming Language: Pointers, Memory Allocation (malloc, free), Data Structures (Structs, Unions), Functions, Pointers to Functions, Arrays, Command-Line Arguments, Compilers, and Header Files.",
  "cpp": "C++ Programming Language: Object-Oriented Programming, Pointers, References, Constructors, Destructors, Templates, Standard Template Library (STL), Memory Management (new, delete), Operator Overloading, and Exception Handling.",
  "c++": "C++ Programming Language: Object-Oriented Programming, Pointers, References, Constructors, Destructors, Templates, Standard Template Library (STL), Memory Management (new, delete), Operator Overloading, and Exception Handling.",
  "javascript": "JavaScript Programming Language: Async/Await, Promises, Event Loop, DOM Manipulation, Functions, Closures, Prototypes, ES6+ Features, Modules, and Object-Oriented/Functional Paradigms.",
  "js": "JavaScript Programming Language: Async/Await, Promises, Event Loop, DOM Manipulation, Functions, Closures, Prototypes, ES6+ Features, Modules, and Object-Oriented/Functional Paradigms.",

  // Databases & SQL
  "sql": "Structured Query Language (SQL) & Databases: Relational Database Management Systems (RDBMS), SELECT Queries, INNER/LEFT/RIGHT JOINs, GROUP BY, HAVING, WHERE Clauses, Subqueries, Transactions (ACID Properties), Indexes (B-Trees), and Normalization (1NF, 2NF, 3NF).",
  "dbms": "Database Management Systems (DBMS): Relational Data Model, ER Diagrams, SQL Queries, Transactions, Concurrency Control, Indexing Strategies, Normalization, Primary/Foreign Keys, and Query Optimization.",
  "db": "Database Systems: Relational & Non-Relational Databases, Data Modeling, SQL Queries, Indexing, Transactions, Normalization, and Query Optimization.",
  "mongodb": "MongoDB NoSQL Database: BSON Documents, Aggregation Pipelines ($match, $group, $lookup, $project), Indexing Strategies (IXSCAN vs COLLSCAN), Collection Operations, Replica Sets, and Sharding.",

  // Web & Cloud
  "html": "HTML5 Web Development: HyperText Markup Language, Semantic Elements (header, nav, article, section, footer), Forms, Attributes, DOM Structure, Accessibility, and Media Elements.",
  "css": "CSS3 Styling: Cascading Style Sheets, Selectors, Box Model, Flexbox, Grid Layout, Responsive Design, Animations, Media Queries, and Specificity.",
  "react": "React Web Framework: Components, JSX, Props, State Management, Hooks (useState, useEffect, useMemo, useCallback), Virtual DOM, Component Lifecycle, and Context API.",
  "node": "Node.js Server Runtime: Event-Driven Architecture, Event Loop, Asynchronous I/O, Express Framework, Middleware, NPM Modules, Streams, and REST APIs.",
  "express": "Express.js Backend Framework: Routing, Middleware Functions, Request/Response Lifecycle, RESTful API Endpoints, Error Handling, and Authentication.",
  "docker": "Docker Containerization: Containers, Images, Dockerfile, Docker Compose, Volume Mounting, Port Forwarding, Networking, and Container Registry.",
  "git": "Git Version Control System: Commits, Branching, Merging, Rebase, Remote Repositories, Pull Requests, Merge Conflicts, and Staging Area.",

  // Fundamentals & AI
  "ai": "Artificial Intelligence (AI): Search Algorithms, Knowledge Representation, Expert Systems, Machine Learning Foundations, Neural Networks, Natural Language Processing, Computer Vision, and Problem Solving.",
  "ml": "Machine Learning (ML): Supervised Learning, Unsupervised Learning, Classification, Regression, Decision Trees, Neural Networks, Model Training, Overfitting, Loss Functions, and Hyperparameter Tuning.",
  "ds": "Data Structures & Algorithms: Arrays, Linked Lists, Stacks, Queues, Binary Trees, B-Trees, Hash Tables, Graphs, Sorting Algorithms, Searching Algorithms, and Big O Complexity Analysis.",
  "dsa": "Data Structures & Algorithms: Arrays, Linked Lists, Stacks, Queues, Binary Trees, Hash Tables, Graphs, Sorting Algorithms, Searching Algorithms, and Time/Space Complexity Analysis.",
  "networking": "Computer Networks: OSI Model, TCP/IP Protocol Suite, IP Addressing (IPv4, IPv6), Subnetting, Routing, Switching, DNS, HTTP/HTTPS, Sockets, and Network Security.",
  "cn": "Computer Networks: OSI Model 7 Layers, TCP/IP Suite, IP Addressing, Routing Algorithms, Subnetting, Transport Protocols (TCP, UDP), DNS, and HTTP.",
  "coa": "Computer Organization & Architecture: CPU Architecture, Registers, ALUs, Instruction Set Architecture (ISA), Pipeline Processing, Memory Hierarchy, Cache Memory, and Bus Systems."
};

function expandShortTopicDescription(input) {
  if (!input || typeof input !== 'string') return input;

  const trimmed = input.trim();
  const lower = trimmed.toLowerCase().replace(/[^a-z0-9+#\s-]/g, '');

  // 1. Direct Keyword Match
  if (DOMAIN_EXPANSION_MAP[lower]) {
    return DOMAIN_EXPANSION_MAP[lower];
  }

  // 2. Contains Keyword Match (e.g., "Python OS basics", "Java OOP")
  for (const [key, expansion] of Object.entries(DOMAIN_EXPANSION_MAP)) {
    const wordBoundary = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (wordBoundary.test(trimmed)) {
      return `Educational Study Topic: ${trimmed}\n${expansion}\nDetailed Study Focus: Practical implementation, fundamental definitions, key mechanisms, syntax rules, and domain application of ${trimmed}.`;
    }
  }

  // 3. Custom Short Description Expansion (Fallback for any short prompt < 100 chars)
  return `Educational Study Topic: ${trimmed}\nCore Curriculum Specification: Comprehensive overview of essential concepts, operational mechanisms, core definitions, practical applications, architectural principles, syntax, and execution strategies regarding ${trimmed}.`;
}

module.exports = {
  DOMAIN_EXPANSION_MAP,
  expandShortTopicDescription
};
