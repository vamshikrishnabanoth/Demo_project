/**
 * server/engine/evidence/depthAnalyzer.js
 *
 * Pedagogy-Aware Ingestion & Teaching-Value Classification Engine (v4.5).
 * 
 * Implements a Robust Multi-Tier Pedagogy-Aware Evaluation:
 * 
 * 1. Multi-Label Content Type Taxonomy:
 *    - CORE_EXPLANATION: Fundamental theoretical definitions, axioms, principles, core operational mechanisms, code/technical specs, syllabus topics.
 *    - EXAMPLE: Concrete code, worked traces, sample calculations, step-by-step illustrations.
 *    - ANALOGY: Metaphors comparing technical mechanisms to intuitive real-world models.
 *    - REAL_WORLD_APPLICATION: Practical / industry deployments explaining why/how concepts are applied.
 *    - TEACHER_EXPERIENCE: Practical stories, debugging tales, or past engineering experiences illustrating a concept.
 *    - TECHNICAL_HUMOR: Jokes, puns, or witty vignettes demonstrating an engineering/scientific pitfall or principle.
 *    - DEMONSTRATION: Walkthroughs of live tools, terminal outputs, UI interactions, code execution, or observational traces.
 *    - STRUCTURAL_METADATA: Course headers, document page numbers, chapter titles, copyright lines.
 *    - ADMINISTRATIVE: Classroom logistics, attendance, exam dates, submission deadlines, mic checks.
 *    - UNRELATED_STORY: Personal domestic anecdotes, gossip with zero educational concept link.
 *    - OFF_TOPIC: Animated cartoons, fictional movie scripts, entertainment drama without educational curriculum.
 * 
 * 2. Fine-Grained Value & Action Scoring:
 *    - TEACHING_VALUE: 0.00 -> 1.00
 *    - CONCEPT_LINKS: Array of grounded syllabus concepts (e.g. ['Operating System', 'CPU Scheduling', 'Deadlock'])
 *    - EVIDENCE_TEXT: Cleanly extracted technical evidence portion
 *    - RETENTION_ACTION: KEEP_WHOLE | KEEP_PARTIAL | DISCARD
 * 
 * 3. Fictional / Entertainment Guardrail vs Genuine Academic Distinction:
 *    - Identifies animated cartoons (e.g., Chhota Bheem, Shinchan, Doraemon) and movie dialogues.
 *    - Rejects pure entertainment/fictional narratives before question generation.
 *    - Full support for all academic formats: PDFs, PPTs, slides, Word docs, code snippets, math formulas, syllabus outlines, and audio lectures.
 */

'use strict';

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Comprehensive Academic & Curricular Domain Lexicon across STEM, Computer Science, Engineering, Business, Law, Humanities
const ACADEMIC_DOMAIN_TERMS = new Set([
  // Computer Science, Operating Systems, Systems Architecture & Hardware
  'operating system', 'operating systems', 'kernel', 'microkernel', 'monolithic kernel',
  'process', 'processes', 'process control block', 'pcb', 'thread', 'threads', 'thread control block', 'tcb',
  'multithreading', 'concurrency', 'deadlock', 'deadlocks', 'resource allocation graph',
  'semaphore', 'semaphores', 'mutex', 'mutexes', 'spinlock', 'mutex lock', 'database lock',
  'critical section', 'race condition', 'race conditions', 'starvation', 'aging', 'priority inversion',
  'cpu scheduling', 'scheduling algorithm', 'scheduling algorithms', 'fcfs', 'sjf', 'srtf', 'round robin',
  'priority scheduling', 'multilevel queue', 'multilevel feedback queue', 'gantt chart',
  'turnaround time', 'waiting time', 'response time', 'throughput', 'cpu utilization',
  'banker\'s algorithm', 'bankers algorithm', 'safety algorithm', 'resource request algorithm',
  'mutual exclusion', 'hold and wait', 'no preemption', 'circular wait',
  'memory management', 'virtual memory', 'paging', 'page table', 'page table entry', 'pte',
  'translation lookaside buffer', 'tlb', 'tlb hit', 'tlb miss', 'page fault', 'page fault rate',
  'demand paging', 'page replacement', 'page replacement algorithm', 'fifo', 'lru', 'optimal page replacement',
  'belady\'s anomaly', 'beladys anomaly', 'thrashing', 'working set model', 'segmentation', 'segment table',
  'inter-process communication', 'ipc', 'named pipe', 'ipc pipe', 'fifo queue', 'message queue',
  'shared memory', 'socket', 'sockets', 'system call', 'system calls',
  'interrupt', 'interrupts', 'interrupt handler', 'isr', 'direct memory access', 'dma',
  'user space', 'user mode', 'kernel space', 'kernel mode', 'dual mode execution', 'context switch', 'context switching',
  'file system', 'file systems', 'inode', 'inodes', 'directory structure', 'file allocation table', 'fat32',
  'ntfs', 'ext4', 'journaling file system', 'virtual file system', 'disk scheduling',
  'sstf', 'scan algorithm', 'c-scan', 'look algorithm', 'c-look', 'raid', 'raid 0', 'raid 1', 'raid 5',
  'virtualization', 'hypervisor', 'type 1 hypervisor', 'type 2 hypervisor', 'container', 'containers', 'docker',
  'posix', 'unix', 'linux', 'shell', 'bash', 'command line', 'cli',

  // Data Structures, Algorithms & Computational Theory
  'algorithm', 'algorithms', 'data structure', 'data structures', 'array', 'arrays', 'linked list', 'doubly linked list',
  'circular linked list', 'stack', 'stacks', 'queue', 'queues', 'deque', 'priority queue',
  'tree', 'trees', 'binary tree', 'binary search tree', 'bst', 'avl tree', 'red-black tree', 'b-tree', 'b+ tree',
  'trie', 'segment tree', 'fenwick tree', 'heap', 'min-heap', 'max-heap', 'heapify',
  'graph', 'graphs', 'directed graph', 'undirected graph', 'adjacency matrix', 'adjacency list',
  'hash table', 'hash map', 'hash function', 'hashing', 'collision resolution', 'chaining', 'open addressing',
  'recursion', 'recursive', 'base case', 'memoization', 'tabulation', 'dynamic programming',
  'greedy algorithm', 'greedy approach', 'divide and conquer', 'backtracking', 'branch and bound',
  'sorting', 'bubble sort', 'selection sort', 'insertion sort', 'merge sort', 'quick sort', 'heap sort', 'radix sort', 'counting sort',
  'searching', 'linear search', 'binary search', 'breadth first search', 'bfs', 'depth first search', 'dfs',
  'dijkstra', 'dijkstra\'s algorithm', 'bellman ford', 'floyd warshall', 'kruskal', 'kruskal\'s algorithm', 'prim', 'prim\'s algorithm',
  'topological sort', 'strongly connected components', 'tarjan', 'kosaraju', 'disjoint set', 'union find',
  'time complexity', 'space complexity', 'big-o', 'big-omega', 'big-theta', 'asymptotic notation',
  'recurrence relation', 'master theorem', 'amortized analysis', 'p vs np', 'np-complete', 'np-hard',

  // Databases & Information Management
  'database', 'databases', 'relational database', 'rdbms', 'sql', 'nosql', 'mongodb', 'postgresql', 'mysql', 'sqlite', 'redis',
  'table', 'tables', 'schema', 'relation', 'relations', 'attribute', 'attributes', 'tuple', 'tuples',
  'primary key', 'foreign key', 'candidate key', 'super key', 'composite key', 'surrogate key',
  'normalization', '1nf', '2nf', '3nf', 'bcnf', '4nf', '5nf', 'functional dependency', 'multivalued dependency',
  'acid properties', 'atomicity', 'consistency', 'isolation', 'durability', 'transaction', 'transactions',
  'concurrency control', 'two-phase locking', '2pl', 'timestamp ordering', 'serializability',
  'view serializability', 'conflict serializability', 'deadlock detection', 'recovery system',
  'write-ahead logging', 'wal', 'checkpoint', 'checkpointing', 'indexing', 'b-tree index', 'hash index',
  'query optimization', 'query execution plan', 'relational algebra', 'selection', 'projection', 'join', 'joins',
  'inner join', 'outer join', 'left join', 'right join', 'cross join', 'aggregate function', 'group by', 'having',
  'stored procedure', 'trigger', 'triggers', 'view', 'views',

  // Computer Networks & Distributed Systems
  'computer network', 'computer networks', 'osi model', 'tcp/ip model',
  'physical layer', 'data link layer', 'network layer', 'transport layer', 'session layer', 'presentation layer', 'application layer',
  'mac address', 'ip address', 'ipv4', 'ipv6', 'subnetting', 'cidr', 'default gateway',
  'routing', 'routing algorithm', 'distance vector', 'link state', 'ospf', 'bgp', 'routing information protocol',
  'tcp', 'transmission control protocol', 'udp', 'user datagram protocol', 'three-way handshake',
  'flow control', 'sliding window protocol', 'stop-and-wait', 'go-back-n', 'selective repeat',
  'congestion control', 'slow start', 'congestion avoidance', 'fast retransmit', 'fast recovery',
  'http', 'https', 'ftp', 'smtp', 'pop3', 'imap', 'dns', 'domain name system', 'dhcp', 'arp', 'rarp', 'icmp',
  'nat', 'network address translation', 'firewall', 'vpn', 'ssl', 'tls', 'cryptography',
  'symmetric encryption', 'asymmetric encryption', 'rsa', 'aes', 'des', 'diffie-hellman', 'digital signature',
  'hash algorithm', 'sha-256', 'md5', 'public key infrastructure', 'pki', 'certificate authority',
  'client-server', 'peer-to-peer', 'p2p', 'microservices', 'load balancer', 'reverse proxy', 'api gateway',
  'rest api', 'restful', 'graphql', 'grpc', 'websocket', 'web sockets', 'rpc', 'remote procedure call',
  'distributed systems', 'cap theorem', 'eventual consistency', 'raft consensus', 'paxos',

  // Software Engineering, Object-Oriented Design & Programming
  'software engineering', 'software development life cycle', 'sdlc', 'waterfall model', 'agile', 'scrum', 'kanban',
  'object-oriented', 'oop', 'class', 'classes', 'object', 'objects', 'inheritance', 'polymorphism',
  'encapsulation', 'abstraction', 'interface', 'interfaces', 'abstract class', 'method overriding', 'method overloading',
  'constructor', 'destructor', 'design pattern', 'design patterns', 'singleton', 'factory pattern', 'observer pattern',
  'strategy pattern', 'adapter pattern', 'decorator pattern', 'mvc', 'model view controller',
  'solid principles', 'dry principle', 'unit testing', 'integration testing', 'system testing', 'tdd', 'test-driven development',
  'git', 'version control', 'repository', 'commit', 'branch', 'merge', 'pull request', 'ci/cd', 'continuous integration',
  'compiler', 'compilers', 'interpreter', 'interpreters', 'lexical analysis', 'lexer', 'syntax analysis', 'parser',
  'semantic analysis', 'intermediate code generation', 'code optimization', 'code generator', 'symbol table',
  'pointer', 'pointers', 'memory allocation', 'malloc', 'free', 'garbage collection', 'memory leak', 'segmentation fault',
  'exception handling', 'try-catch', 'type casting', 'generic programming', 'templates', 'lambda function',

  // AI, Machine Learning, Deep Learning & Data Science
  'artificial intelligence', 'machine learning', 'deep learning', 'neural network', 'neural networks',
  'perceptron', 'multi-layer perceptron', 'mlp', 'convolutional neural network', 'cnn',
  'recurrent neural network', 'rnn', 'lstm', 'gru', 'transformer', 'transformers', 'attention mechanism',
  'autoencoder', 'autoencoders', 'generative adversarial network', 'gan', 'large language model', 'llm',
  'supervised learning', 'unsupervised learning', 'reinforcement learning', 'semi-supervised learning',
  'classification', 'regression', 'clustering', 'k-means', 'hierarchical clustering', 'dbscan',
  'decision tree', 'random forest', 'gradient boosting', 'xgboost', 'lightgbm', 'support vector machine', 'svm',
  'naive bayes', 'k-nearest neighbors', 'knn', 'linear regression', 'logistic regression',
  'principal component analysis', 'pca', 'dimensionality reduction', 'feature extraction', 'feature selection',
  'gradient descent', 'stochastic gradient descent', 'sgd', 'adam optimizer', 'learning rate',
  'backpropagation', 'loss function', 'cost function', 'mean squared error', 'mse', 'cross-entropy',
  'activation function', 'relu', 'sigmoid', 'tanh', 'softmax', 'overfitting', 'underfitting',
  'bias-variance tradeoff', 'regularization', 'l1 regularization', 'l2 regularization', 'dropout',
  'batch normalization', 'confusion matrix', 'precision', 'recall', 'f1-score', 'roc-auc',

  // Mathematics, Statistics & Logic
  'mathematics', 'calculus', 'derivative', 'derivatives', 'integral', 'integrals', 'differential equation',
  'linear algebra', 'matrix', 'matrices', 'determinant', 'eigenvalue', 'eigenvalues', 'eigenvector', 'eigenvectors',
  'vector space', 'linear transformation', 'rank of matrix', 'dot product', 'cross product',
  'probability', 'conditional probability', 'bayes theorem', 'random variable', 'probability distribution',
  'normal distribution', 'gaussian distribution', 'binomial distribution', 'poisson distribution',
  'variance', 'standard deviation', 'mean', 'median', 'mode', 'hypothesis testing', 'p-value', 'null hypothesis',
  'discrete mathematics', 'set theory', 'propositional logic', 'predicate logic', 'boolean algebra',
  'combinatorics', 'permutation', 'permutations', 'combination', 'combinations',
  'graph theory', 'eulerian path', 'hamiltonian cycle', 'tree traversal', 'isomorphism',

  // Electronics & Physical Sciences
  'physics', 'mechanics', 'thermodynamics', 'electromagnetism', 'voltage', 'current', 'resistance', 'impedance',
  'capacitance', 'inductance', 'semiconductor', 'semiconductors', 'transistor', 'transistors', 'bjt', 'mosfet',
  'diode', 'diodes', 'logic gate', 'logic gates', 'and gate', 'or gate', 'not gate', 'nand gate', 'nor gate', 'xor gate',
  'flip-flop', 'flip-flops', 'multiplexer', 'demultiplexer', 'encoder', 'decoder', 'counter', 'shift register',
  'combinational circuit', 'sequential circuit', 'k-map', 'karnaugh map', 'boolean simplification',
  'signal processing', 'fourier transform', 'fft', 'laplace transform', 'frequency response',

  // Academic General, Education & Syllabus Headers
  'computer science', 'information technology', 'engineering', 'curriculum', 'syllabus',
  'course material', 'lecture notes', 'learning objectives', 'textbook'
]);

// Precompiled Regexes with Word Boundaries for ultra-fast and precise matching
const ACADEMIC_TERM_REGEXES = Array.from(ACADEMIC_DOMAIN_TERMS).map(term => {
  return new RegExp(`\\b${escapeRegex(term)}s?\\b`, 'i');
});

// Fictional Cartoon Tropes & Character Names (Strict Non-Academic Detection)
const FICTIONAL_CARTOON_PATTERNS = [
  /\b(chhota\s+bheem|bheem|kalia|dholu|bholu|chutki|jaggu|indumati|dholakpur|dhoomketu|prof(?:essor)?\s+dhoomketu|kirmada)\b/i,
  /\b(shinchan|nobita|doraemon|shizuka|gian|suneo|dekisugi|ninja\s+hattori|oggy|cockroaches)\b/i,
  /\b(tom\s+and\s+jerry|mickey\s+mouse|donald\s+duck|bugs\s+bunny|ben\s+10|omnitrix|pokemon|pikachu|ash\s+ketchum)\b/i,
  /\b(goku|vegeta|dragon\s+ball|naruto|sasuke|sakura|luffy|zoro|one\s+piece|anime\s+episode)\b/i,
  /\b(lava\s+car|flying\s+carpet|magic\s+wand|magic\s+spell|magic\s+potion|enchanted|superpowers|evil\s+sorcerer)\b/i,
  /\b(wizard|witchcraft|goblin|superhero\s+costume|mystical\s+amulet|crystal\s+ball|alien\s+invasion)\b/i,
  /\b(defeat\s+the\s+monster|save\s+the\s+village|save\s+the\s+kingdom|destroy\s+the\s+evil|king\s+indraverma)\b/i
];

// Entertainment Drama / Soap Script / Casual Non-Educational Dialogue Patterns
const ENTERTAINMENT_DRAMA_PATTERNS = [
  /\b(accidentally (?:sewed|ripped|dropped|cut|broke)|sewed the (?:sleeve|hem|dress|shirt)|ripped it out)\b/i,
  /\b(need to deliver this tomorrow|half of it is done|boss will kill me|deadline tomorrow|dress is ruined)\b/i,
  /\b(boyfriend|girlfriend|ex-boyfriend|ex-girlfriend|dating him|dating her|fell in love|broke my heart)\b/i,
  /\b(kiss me|kissed (?:him|her)|hugged (?:him|her)|sleeping with|cheated on)\b/i,
  /\b(honey|darling|sweetheart|babe|shut up|get out of here|what the hell)\b/i,
  /\b(police officer|detective|drop the gun|put your hands up|gunshot|hostage|murderer|serial killer)\b/i,
  /\b(went to the party|drinking beer|at the club|hangover|getting drunk|shots of tequila)\b/i,
  /\b(shopping at the mall|bought a dress|delicious dinner|cooked dinner|washed the dishes|laundry)\b/i,
  /\b(movie was (?:awesome|terrible)|favorite actor|hollywood|pop star|celebrity gossip)\b/i,
  /\b(screamed loudly|started crying|tears in (?:his|her) eyes|whispered softly)\b/i
];

class DepthAnalyzer {
  /**
   * Split raw text into semantic segments (sentences/clauses/bullet points).
   */
  segmentText(text) {
    if (!text) return [];
    const cleaned = text.replace(/\r\n/g, '\n').replace(/\t/g, ' ');
    const rawSegments = cleaned.split(/(?<=[.?!;])\s+|\n+/);
    return rawSegments
      .map(s => s.trim())
      .filter(s => s.length > 3);
  }

  /**
   * Check if a segment is pure fictional/cartoon storytelling.
   */
  _isFictionalOrCartoonNarrative(lower, cleanSeg = '') {
    // 1. Direct cartoon/fictional character/trope matches
    for (const pat of FICTIONAL_CARTOON_PATTERNS) {
      if (pat.test(lower)) return true;
    }

    // 2. Entertainment drama patterns (only if no technical code or strong academic terms)
    const matchesDrama = ENTERTAINMENT_DRAMA_PATTERNS.some(p => p.test(lower));
    if (matchesDrama) {
      const hasAcademic = this._hasAcademicDomainWord(lower) || this._isCodeOrTechnicalSnippet(cleanSeg);
      if (!hasAcademic) return true;
    }

    return false;
  }

  /**
   * Detect code snippet, programming syntax, or formulas in text.
   */
  _isCodeOrTechnicalSnippet(seg) {
    if (!seg) return false;
    const codePatterns = [
      /\b(?:#include\s*<|#define\s+|import\s+[\w.]+|from\s+[\w.]+\s+import|def\s+\w+\s*\(|public\s+class\s+|class\s+\w+|function\s+\w+\s*\(|void\s+\w+\s*\(|int\s+main\s*\(|pid_t\s+|fork\s*\(\)|pthread_|malloc\s*\(|free\s*\(|printf\s*\(|cout\s*<<|cin\s*>>|System\.out\.println|console\.log|SELECT\s+.*\s+FROM|CREATE\s+TABLE|INSERT\s+INTO|ALTER\s+TABLE|UPDATE\s+.*\s+SET|DELETE\s+FROM)\b/i,
      /[{}][\s\S]*[;{}]|=>|\b(?:return|const|let|var|sizeof|typedef|struct|enum)\b\s*[\w*&]+/i,
      /\b(?:[A-Za-z0-9_]+\s*=\s*[A-Za-z0-9_+\-*/()]+;|\b(?:if|while|for)\s*\([^)]+\)\s*\{?)/i
    ];
    return codePatterns.some(p => p.test(seg));
  }

  /**
   * Detect course syllabus, unit outline, or university handout structure.
   */
  _isSyllabusOrCourseHeader(lower) {
    const syllabusPatterns = [
      /\b(?:unit\s*(?:[0-9]+|[ivxlcdm]+)|chapter\s*(?:[0-9]+|[ivxlcdm]+)|module\s*(?:[0-9]+|[ivxlcdm]+)|subject\s*:|course\s*:|syllabus\s*:|curriculum\s*:|lecture\s*(?:[0-9]+|[ivxlcdm]+))\b/i,
      /\b(?:department\s+of\s+(?:computer|information|electrical|electronics|mechanical|civil|engineering|science)|course\s+material|academic\s+year|learning\s+objectives?|table\s+of\s+contents?|review\s+questions?)\b/i
    ];
    return syllabusPatterns.some(p => p.test(lower));
  }

  /**
   * Detect document pagination, confidentiality, or structural copyright lines.
   */
  _isDocumentStructuralMetadata(lower) {
    const metaPatterns = [
      /\b(?:page\s+\d+\s+of\s+\d+|page\s+\d+|confidential|internal\s+use\s+only|all\s+rights\s+reserved|copyright\s+\d{4}|prepared\s+by\s*:|regulation\s*:\s*[a-z0-9]+|date\s*:\s*\w+)\b/i
    ];
    return metaPatterns.some(p => p.test(lower));
  }

  /**
   * Detect Teacher Practical Experience / Debugging Tale / Real-World Case.
   */
  _matchTeacherExperience(seg, lower) {
    const experienceMarkers = [
      /\b(?:when\s+i\s+(?:was\s+working|worked|was\s+building|was\s+deploying|was\s+at)|in\s+my\s+(?:previous|last|past)\s+(?:company|job|role|project)|in\s+(?:production|real\s+life|industry))\b/i,
      /\b(?:i\s+once\s+(?:had|faced|debugged|saw|encountered)|we\s+(?:had|faced|hit|saw|encountered)\s+this\s+(?:bug|issue|incident|outage|problem|deadlock|race\s+condition|leak))\b/i,
      /\b(?:(?:deploying|deployed|woke\s+up|debugging|fixed|alerted)\s+at\s+\d+\s*(?:am|pm)|production\s+(?:server|database|cluster|outage|incident))\b/i,
      /\b(?:customer\s+(?:traffic|complaints|database)|production\s+environment|live\s+traffic|scale\s+issue)\b/i
    ];

    const hasExpMarker = experienceMarkers.some(p => p.test(lower));
    if (!hasExpMarker) return null;

    const concepts = this._extractConceptsFromSegment(seg);
    const hasAcademicTerm = concepts.length > 0 || this._hasAcademicDomainWord(lower);

    if (hasAcademicTerm) {
      const cleanEvidence = this._extractTechnicalPortion(seg);
      return {
        type: 'TEACHER_EXPERIENCE',
        teaching_value: 0.92,
        concept_links: concepts.length > 0 ? concepts : ['Real-World System Implementation'],
        action: cleanEvidence.isPartial ? 'KEEP_PARTIAL' : 'KEEP_WHOLE',
        evidence_text: cleanEvidence.text,
        reason: `Teacher describes real-world industry experience / production incident illustrating ${concepts.join(', ') || 'system principles'}.`
      };
    }

    return null;
  }

  /**
   * Detect Conceptual Analogy / Metaphor.
   */
  _matchAnalogy(seg, lower) {
    const analogyMarkers = [
      /\b(?:imagine\s+(?:a|an|that|if)|think\s+of\s+(?:it|this)\s+(?:like|as)|analogous\s+to|similar\s+to\s+how|like\s+a\s+(?:traffic|restaurant|library|conveyor|post\s+office|queue|bucket|pipe|highway))\b/i,
      /\b(?:to\s+give\s+you\s+an\s+analogy|take\s+an\s+analogy|metaphorically\s+speaking|mental\s+model)\b/i
    ];

    const hasAnalogyMarker = analogyMarkers.some(p => p.test(lower));
    if (!hasAnalogyMarker) return null;

    const concepts = this._extractConceptsFromSegment(seg);
    const hasAcademic = concepts.length > 0 || this._hasAcademicDomainWord(lower);

    if (hasAcademic || lower.includes('deadlock') || lower.includes('process') || lower.includes('memory') || lower.includes('thread') || lower.includes('queue') || lower.includes('buffer') || lower.includes('lock')) {
      return {
        type: 'ANALOGY',
        teaching_value: 0.88,
        concept_links: concepts.length > 0 ? concepts : ['Conceptual Mechanism'],
        action: 'KEEP_WHOLE',
        evidence_text: seg.trim(),
        reason: `Conceptual analogy explaining mechanism or behavioral dynamics of ${concepts.join(', ') || 'the topic'}.`
      };
    }

    return null;
  }

  /**
   * Detect Technical Humor / Conceptual Joke.
   */
  _matchTechnicalHumor(seg, lower) {
    const humorMarkers = [
      /\b(?:walks\s+into\s+a\s+bar|there\s+are\s+10\s+types\s+of\s+people|that's\s+why\s+we\s+(?:never|always)\s+(?:drop\s+table|use\s+goto)|classic\s+joke|programmer's\s+nightmare|funny\s+thing\s+about\s+(?:recursion|threading|pointers))\b/i,
      /\b(?:joke\s+about|funny\s+analogy|humorous\s+way\s+to\s+remember)\b/i
    ];

    const hasHumorMarker = humorMarkers.some(p => p.test(lower));
    if (!hasHumorMarker) return null;

    const concepts = this._extractConceptsFromSegment(seg);
    const hasAcademic = concepts.length > 0 || this._hasAcademicDomainWord(lower);

    if (hasAcademic) {
      return {
        type: 'TECHNICAL_HUMOR',
        teaching_value: 0.82,
        concept_links: concepts.length > 0 ? concepts : ['Technical Principle'],
        action: 'KEEP_WHOLE',
        evidence_text: seg.trim(),
        reason: `Pedagogical humor / conceptual joke reinforcing key technical concept: ${concepts.join(', ')}.`
      };
    }

    return null;
  }

  /**
   * Detect Real-World Application / Case Study.
   */
  _matchRealWorldApplication(seg, lower) {
    const appMarkers = [
      /\b(?:in\s+real-world\s+applications?|in\s+industry|in\s+production\s+systems?|how\s+(?:google|netflix|amazon|uber|meta|apple)\s+(?:uses?|handles?|implements?))\b/i,
      /\b(?:applied\s+in|practical\s+application|real-life\s+use\s+case|used\s+by\s+e-commerce|used\s+in\s+autonomous|used\s+in\s+banking)\b/i,
      /\b(?:industry\s+standard|production\s+best\s+practice|enterprise\s+architecture)\b/i
    ];

    const hasAppMarker = appMarkers.some(p => p.test(lower));
    if (!hasAppMarker) return null;

    const concepts = this._extractConceptsFromSegment(seg);
    const hasAcademic = concepts.length > 0 || this._hasAcademicDomainWord(lower);

    if (hasAcademic) {
      return {
        type: 'REAL_WORLD_APPLICATION',
        teaching_value: 0.95,
        concept_links: concepts.length > 0 ? concepts : ['Practical System Application'],
        action: 'KEEP_WHOLE',
        evidence_text: seg.trim(),
        reason: `Real-world industrial application and practical deployment of ${concepts.join(', ') || 'the concept'}.`
      };
    }

    return null;
  }

  /**
   * Extract technical core from mixed discourse.
   */
  _extractTechnicalPortion(seg) {
    const raw = seg.trim();
    const splitRegex = /(?:,\s*(?:and\s+then|suddenly|and|where|because|so|when)\s+)|(?:\.\s+)/i;
    const parts = raw.split(splitRegex);

    if (parts.length > 1) {
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        const partLower = part.toLowerCase();
        if (this._hasAcademicDomainWord(partLower) || this._extractConceptsFromSegment(part).length > 0) {
          const remainingText = parts.slice(i).join(', ').trim();
          return {
            text: remainingText.length > 10 ? remainingText : raw,
            isPartial: i > 0
          };
        }
      }
    }

    return { text: raw, isPartial: false };
  }

  /**
   * Pedagogy-Aware Classification for a single segment.
   */
  classifySegment(seg, prevSeg = null) {
    if (!seg || typeof seg !== 'string' || seg.trim().length === 0) {
      return {
        type: 'OFF_TOPIC',
        teaching_value: 0.0,
        concept_links: [],
        evidence_text: '',
        action: 'DISCARD',
        reason: 'Empty segment',
        confidence: 'HIGH'
      };
    }

    const cleanSeg = seg.trim();
    const lower = cleanSeg.toLowerCase();

    // ──────────────────────────────────────────────────────────────────────────
    // Step 1: Detect Fictional Entertainment / Cartoons / Pop Culture (DISCARD)
    // ──────────────────────────────────────────────────────────────────────────
    if (this._isFictionalOrCartoonNarrative(lower, cleanSeg)) {
      return {
        type: 'OFF_TOPIC',
        teaching_value: 0.0,
        concept_links: [],
        evidence_text: '',
        action: 'DISCARD',
        reason: 'Fictional cartoon narrative, movie dialogue, or personal entertainment banter without educational curriculum.',
        confidence: 'HIGH'
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Step 2: Detect Administrative / Classroom Logistics / Pure Noise (DISCARD)
    // ──────────────────────────────────────────────────────────────────────────
    const adminPatterns = [
      /\b(close your (?:lips|lapels|mouth|laptops|books|eyes))\b/i,
      /\b(stop talking|settle down|be quiet|silence in the (?:class|back))\b/i,
      /\b(roll number(?:s)?|stand up|sit down|attendance|absent|present)\b/i,
      /\b(exam will be (?:held|conducted)|mid-term examination|bring your (?:id|hall tickets|identity cards|calculator))\b/i,
      /\b(had lunch|cafeteria|traffic was|metro station|weather is nice|yesterday movie|funny haha|party|shopping)\b/i,
      /\b(listen carefully|pay attention in the back|benches|can you hear me|mic check|am i audible|silence your phones)\b/i,
      /\b(submit (?:your\s+)?(?:[\w-]+\s+)?assignments?|assignment\s+submission|deadline\s+is\s+(?:tomorrow|friday|monday|tonight|\w+)|next\s+class\s+we\s+will)\b/i
    ];
    for (const pat of adminPatterns) {
      if (pat.test(lower)) {
        return {
          type: 'ADMINISTRATIVE',
          teaching_value: 0.05,
          concept_links: [],
          evidence_text: '',
          action: 'DISCARD',
          reason: 'Classroom governance, attendance, logistics, or casual greeting banter.',
          confidence: 'HIGH'
        };
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Step 3: Code Snippets & Programming Syntax (KEEP_WHOLE)
    // ──────────────────────────────────────────────────────────────────────────
    if (this._isCodeOrTechnicalSnippet(cleanSeg)) {
      const extractedConcepts = this._extractConceptsFromSegment(cleanSeg);
      return {
        type: 'CORE_EXPLANATION',
        teaching_value: 0.96,
        concept_links: extractedConcepts.length > 0 ? extractedConcepts : ['Code Implementation'],
        evidence_text: cleanSeg,
        action: 'KEEP_WHOLE',
        substanceType: 'CODE_IMPLEMENTATION',
        matchedTerms: extractedConcepts,
        reason: 'Programming code, system calls, syntax, or algorithmic implementation.',
        confidence: 'HIGH'
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Step 4: Syllabus, Course Units & Curricular Headers (KEEP_WHOLE)
    // ──────────────────────────────────────────────────────────────────────────
    if (this._isSyllabusOrCourseHeader(lower)) {
      const extractedConcepts = this._extractConceptsFromSegment(cleanSeg);
      return {
        type: 'CORE_EXPLANATION',
        teaching_value: 0.85,
        concept_links: extractedConcepts.length > 0 ? extractedConcepts : ['Curriculum Syllabus'],
        evidence_text: cleanSeg,
        action: 'KEEP_WHOLE',
        substanceType: 'CURRICULAR_OUTLINE',
        matchedTerms: extractedConcepts,
        reason: 'Course curriculum header, syllabus unit outline, or topic structure.',
        confidence: 'HIGH'
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Step 5: Document Structural Metadata & Pagination (KEEP_PARTIAL)
    // ──────────────────────────────────────────────────────────────────────────
    if (this._isDocumentStructuralMetadata(lower)) {
      return {
        type: 'STRUCTURAL_METADATA',
        teaching_value: 0.25,
        concept_links: [],
        evidence_text: cleanSeg,
        action: 'KEEP_PARTIAL',
        substanceType: 'DOCUMENT_STRUCTURE',
        reason: 'Document pagination, confidentiality marker, or header structure.',
        confidence: 'HIGH'
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Step 6: Pedagogy-Aware Rich Contextual Classification
    // ──────────────────────────────────────────────────────────────────────────
    const expResult = this._matchTeacherExperience(cleanSeg, lower);
    if (expResult) {
      return { ...expResult, substanceType: 'REAL_WORLD_CASE', confidence: 'HIGH' };
    }

    const analogyResult = this._matchAnalogy(cleanSeg, lower);
    if (analogyResult) {
      return { ...analogyResult, substanceType: 'CONCEPTUAL_ANALOGY', confidence: 'HIGH' };
    }

    const humorResult = this._matchTechnicalHumor(cleanSeg, lower);
    if (humorResult) {
      return { ...humorResult, substanceType: 'TECHNICAL_HUMOR', confidence: 'HIGH' };
    }

    const appResult = this._matchRealWorldApplication(cleanSeg, lower);
    if (appResult) {
      return { ...appResult, substanceType: 'REAL_WORLD_APPLICATION', confidence: 'HIGH' };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Step 7: Pedagogical Meta-Speech / Motivation / Study Guidance
    // ──────────────────────────────────────────────────────────────────────────
    const pedagogicalMetaPatterns = [
      /\b(are you having any (?:issues|doubts|problems)|are you (?:people )?able to understand me)\b/i,
      /\b(especially (?:girls|boys)|last girl|last boy)\b/i,
      /\b(comfortable with the pace|teaching pace|medium gear|top gear|first gear|comfort level)\b/i,
      /\b(75|80|75-80)% of (?:students|class|people)\b/i,
      /\b(believe in yourself|crack any interview|do not be afraid of exams|study hard and stay confident)\b/i,
      /\b(do not be (?:nervous|afraid|worried)|keep your spirits high|everyone finds it hard at first|be patient with yourselves)\b/i,
      /\b(important for (?:google|technical)? ?interviews|asked in (?:top|product) companies)\b/i,
      /\b(you will master this with practice|takes time to master)\b/i
    ];
    for (const pat of pedagogicalMetaPatterns) {
      if (pat.test(lower)) {
        return {
          type: 'PEDAGOGICAL_GUIDANCE',
          teaching_value: 0.40,
          concept_links: [],
          evidence_text: cleanSeg,
          action: 'KEEP_WHOLE',
          reason: 'Instructional reassurance, teaching process, comfort feedback, or interview motivation.',
          confidence: 'HIGH'
        };
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Step 8: Core Instructional / Academic Explanations, Rules, Mechanisms
    // ──────────────────────────────────────────────────────────────────────────
    const hasDefRelation = /\b(is an?|are(?: words)?|means|defined as|refers to|represents|stands for|consists of|composed of|characterized by|types of|known as|named as|classified into|provides an?|acts as|serves as|used (?:to|as|in))\b/i.test(lower);
    const hasMechRelation = /\b(works by|applies|extract(?:s|ed|ing)?|transform(?:s|ed|ing)?|comput(?:es|ed|ing)?|divid(?:es|ed|ing)?|multiplie(?:s|d)?|calculat(?:es|ed|ing)?|connect(?:s|ed|ing)?|execut(?:es|ed|ing)?|process(?:es|ed|ing)?|generat(?:es|ed|ing)?|allocat(?:es|ed|ing)?|modifie(?:s|d|ying)?|conduc(?:ts|ted|ting)?|converts?|eliminat(?:es|ed|ing)?|reduc(?:es|ed|ing)?|increas(?:es|ed|ing)?|decreas(?:es|ed|ing)?|stores?|retrieves?|passes?|takes?|outputs?|returns?|handles?|implements?|travers(?:es|ed|ing)?|select(?:s|ed|ing)?|partition(?:s|ed|ing)?|discard(?:s|ed|ing)?)\b/i.test(lower);
    const hasRuleRelation = /\b(whenever|therefore|in order to|leads to|results in|prevents|causes|so that|guarantees?|ensures?|requires?|depends on|condition|conditions|properties|invariants?|safe and idempotent|idempotent|greater than|less than|equal to|temporarily changes)\b/i.test(lower);
    const hasComparisonRelation = /\b(in contrast|compared to|difference between|neither .* nor|whereas|while|faster than|slower than|preferred over|differs? from|unlike|similar to)\b/i.test(lower);
    const hasDemonstrative = /\b(look at|notice (?:what happens|that|how)|observe (?:that|how)|see (?:what happens|that|how)|here we (?:see|have|notice)|consider (?:this|the|an?)|suppose (?:we|that)|let us (?:see|examine|trace|look)|trace (?:through|the)|given (?:an?|the)|for example|for instance)\b/i.test(lower);
    const hasTraceExample = /\[[0-9,\s]+\]|\b(pivot|example|trace|step|produces)\b/i.test(lower);
    const hasSocraticCurricular = /\b(what happens (?:to|if|when)|why does|why do we|how does|can the|what is the effect of)\b/i.test(lower);
    const hasProcRelation = /\b(first(?:ly)?,|second(?:ly)?,|third(?:ly)?,|finally,|next,|step \d+|in the (?:first|next|final) step|pauses?|saves?|transfers?|restor(?:es|ed|ing)?|resum(?:es|ed|ing)?|fetch(?:es|ed|ing)?)\b/i.test(lower);

    const words = cleanSeg.split(/\s+/).filter(Boolean);
    const hasSubstantiveLength = words.length >= 3;
    const hasInstructionalSignal = hasDefRelation || hasMechRelation || hasRuleRelation || hasComparisonRelation || hasDemonstrative || hasTraceExample || hasSocraticCurricular || hasProcRelation;

    const extractedConcepts = this._extractConceptsFromSegment(cleanSeg);
    const hasAcademicConcept = extractedConcepts.length > 0 || this._hasAcademicDomainWord(lower);

    if (hasInstructionalSignal && hasSubstantiveLength && hasAcademicConcept) {
      let contentType = 'CORE_EXPLANATION';
      let substanceType = 'DEFINITION_OR_FACT';
      let teachingValue = 0.95;

      if (hasTraceExample || hasDemonstrative) {
        contentType = 'EXAMPLE';
        substanceType = hasTraceExample ? 'WORKED_EXAMPLE' : 'OBSERVATION_DEMONSTRATION';
        teachingValue = 0.90;
      } else if (hasMechRelation) {
        contentType = 'CORE_EXPLANATION';
        substanceType = 'MECHANISM';
        teachingValue = 0.98;
      } else if (hasRuleRelation) {
        contentType = 'CORE_EXPLANATION';
        substanceType = 'RULE_OR_CONDITION';
        teachingValue = 0.94;
      } else if (hasComparisonRelation) {
        contentType = 'CORE_EXPLANATION';
        substanceType = 'COMPARISON';
        teachingValue = 0.92;
      } else if (hasProcRelation) {
        contentType = 'DEMONSTRATION';
        substanceType = 'PROCEDURAL_STEP';
        teachingValue = 0.90;
      } else if (hasSocraticCurricular) {
        contentType = 'CORE_EXPLANATION';
        substanceType = 'SOCRATIC_INSTRUCTION';
        teachingValue = 0.88;
      }

      return {
        type: contentType,
        teaching_value: teachingValue,
        concept_links: extractedConcepts.length > 0 ? extractedConcepts : ['Core Curriculum'],
        evidence_text: cleanSeg,
        action: 'KEEP_WHOLE',
        substanceType,
        matchedTerms: extractedConcepts,
        reason: `Presents assessable instructional content (${substanceType}) with verified curriculum concepts.`,
        confidence: 'HIGH'
      };
    }

    // Contextual continuity following demonstratives
    if (prevSeg && (prevSeg.toLowerCase().includes('look at') || prevSeg.toLowerCase().includes('notice') || prevSeg.toLowerCase().includes('observe')) && hasSubstantiveLength && hasAcademicConcept) {
      return {
        type: 'DEMONSTRATION',
        teaching_value: 0.85,
        concept_links: extractedConcepts,
        evidence_text: cleanSeg,
        action: 'KEEP_WHOLE',
        substanceType: 'OBSERVATION_DEMONSTRATION',
        matchedTerms: extractedConcepts,
        reason: 'Instructional continuity following demonstrative guidance.',
        confidence: 'MEDIUM'
      };
    }

    // Academic Lexicon Mention (Slide bullet points, concept mentions, lists)
    if (hasAcademicConcept) {
      return {
        type: 'CORE_EXPLANATION',
        teaching_value: 0.75,
        concept_links: extractedConcepts.length > 0 ? extractedConcepts : ['Academic Curriculum'],
        evidence_text: cleanSeg,
        action: 'KEEP_WHOLE',
        substanceType: 'FOUNDATIONAL_CONTEXT',
        matchedTerms: extractedConcepts,
        reason: 'Mentions academic domain concepts and syllabus keywords.',
        confidence: 'MEDIUM'
      };
    }

    // Conversational chatter fallback
    return {
      type: 'UNRELATED_STORY',
      teaching_value: 0.10,
      concept_links: [],
      evidence_text: '',
      action: 'DISCARD',
      reason: 'General conversational text without educational or curricular substance.',
      confidence: 'MEDIUM'
    };
  }

  _hasAcademicDomainWord(lowerText) {
    if (!lowerText) return false;
    for (let i = 0; i < ACADEMIC_TERM_REGEXES.length; i++) {
      if (ACADEMIC_TERM_REGEXES[i].test(lowerText)) return true;
    }
    return false;
  }

  /**
   * Helper to clean, strip leading prepositions/articles, and validate that a phrase
   * is a genuine academic/curricular concept rather than conversational clutter.
   */
  _cleanConceptPhrase(raw) {
    if (!raw) return '';
    const conversationalStopwords = new Set([
      'today', 'tomorrow', 'yesterday', 'quickly', 'through', 'understand', 'understanding',
      'know', 'knowing', 'let', 'lets', 'now', 'here', 'there', 'first', 'second', 'third',
      'step', 'sentence', 'example', 'look', 'looks', 'looking', 'going', 'talk', 'talking',
      'about', 'discuss', 'discussing', 'thing', 'things', 'stuff', 'really', 'actually',
      'basically', 'simply', 'maybe', 'probably', 'class', 'lecture', 'sir', 'maam', 'okay',
      'alright', 'everyone', 'everybody', 'student', 'students', 'teacher', 'we', 'you',
      'they', 'this', 'that', 'these', 'those', 'what', 'which', 'where', 'when', 'why',
      'how', 'come', 'coming', 'came', 'take', 'taking', 'took', 'give', 'giving', 'gave',
      'tell', 'telling', 'told', 'write', 'writing', 'wrote', 'make', 'making', 'made',
      'want', 'wanting', 'need', 'needing', 'feel', 'feeling', 'think', 'thinking', 'thought',
      'show', 'showing', 'seen', 'mean', 'means', 'meaning', 'case', 'cases', 'part', 'parts',
      'well', 'just', 'also', 'even', 'much', 'more', 'most', 'very', 'like', 'good', 'way',
      'yes', 'yeah', 'no', 'so', 'into', 'onto', 'from', 'with', 'by', 'some', 'our', 'your'
    ]);

    const genericSingleWords = new Set([
      'model', 'models', 'element', 'elements', 'input', 'inputs', 'output', 'outputs',
      'number', 'numbers', 'word', 'words', 'structure', 'structures', 'method', 'methods',
      'thing', 'things', 'way', 'ways', 'case', 'cases', 'part', 'parts', 'step', 'steps',
      'example', 'examples', 'time', 'times', 'type', 'types', 'item', 'items', 'value', 'values'
    ]);

    const weakModifiers = new Set([
      'smaller', 'larger', 'bigger', 'exact', 'same', 'different', 'original', 'entire', 'whole',
      'actual', 'given', 'certain', 'particular', 'single', 'multiple', 'final', 'initial'
    ]);

    let phrase = raw.trim().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
    
    // Strip conversational, prepositional, and auxiliary prefixes iteratively
    const prefixRegex = /^(?:the|a|an|about|to|in|for|of|and|or|but|if|then|so|yes|yeah|no|into|onto|from|with|by|some|our|your|let|lets|we|you|now|just|well|look|looks|see|what|which|when|where|why|how|this|that|these|those|there|here|i\s+think|you\s+know|is|are|was|were|be|been|being|have|has|had)\s+/i;
    while (prefixRegex.test(phrase)) {
      phrase = phrase.replace(prefixRegex, '').trim();
    }
    phrase = phrase.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').trim();
    if (phrase.length < 2) return '';

    const words = phrase.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 5) return '';

    // Reject if single generic word or single conversational stop word
    if (words.length === 1 && (genericSingleWords.has(words[0].toLowerCase()) || conversationalStopwords.has(words[0].toLowerCase()))) {
      return '';
    }

    if (words.length === 2 && weakModifiers.has(words[0].toLowerCase()) && genericSingleWords.has(words[1].toLowerCase())) {
      return '';
    }

    if (words.every(w => conversationalStopwords.has(w.toLowerCase()))) return '';
    if (conversationalStopwords.has(words[0].toLowerCase())) return '';
    if (conversationalStopwords.has(words[words.length - 1].toLowerCase())) return '';

    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  /**
   * Extract key subject nouns or domain concept entities from an instructional segment.
   */
  _extractConceptsFromSegment(seg) {
    if (!seg) return [];
    const concepts = [];

    // 1. Prominent Technical Acronyms (e.g., CPU, OS, RAM, ROM, TLB, PCB, TCB, FCFS, SJF, RR, LRU, FIFO, DAA, BST, AVL, ACID, TCP, IP, API, SQL)
    const nonConceptAcronyms = new Set([
      'THE', 'FOR', 'AND', 'ARE', 'THIS', 'THAT', 'WITH', 'NOT', 'BUT', 'FROM', 'CAN', 'ALL', 'OUT',
      'HOW', 'WHY', 'YES', 'NOW', 'WHAT', 'WHO', 'WHEN', 'AM', 'PM', 'PDF', 'PPT', 'DOC', 'TXT', 'JPG',
      'PNG', 'OK', 'FAQ', 'FYI', 'VS', 'ETC', 'HR', 'MIN', 'SEC'
    ]);
    const acronyms = seg.match(/\b[A-Z]{2,}\b/g) || [];
    acronyms.forEach(a => {
      if (!nonConceptAcronyms.has(a)) {
        concepts.push(a);
      }
    });

    // 2. Definitional Subject: "An operating system is..." or "CPU scheduling deals with..."
    const defMatch = seg.match(/(?:^|\b(?:a|an|the)\s+)([A-Za-z0-9\s\-]+?)\s+(?:is an?|are(?: words)?|means|refers to|stands for|provides|applies|consists of|differs from|deals with|manages)/i);
    if (defMatch && defMatch[1]) {
      const cleaned = this._cleanConceptPhrase(defMatch[1]);
      if (cleaned) concepts.push(cleaned);
    }

    // 3. Technical compound noun phrases
    const nounPhraseRegex = /\b([a-zA-Z]+(?:\s+[a-zA-Z]+)?)\s+(?:algorithm|algorithms|layers?|filters?|protocols?|numbers?|spaces?|functions?|methods?|structures?|models?|elements?|inputs?|outputs?|vectors?|graphs?|nodes?|trees?|complexity|matrices|arrays?|scheduling|management|allocation|replacement|prevention|avoidance|synchronization)/gi;
    let npMatch;
    while ((npMatch = nounPhraseRegex.exec(seg)) !== null) {
      if (npMatch[0] && npMatch[0].length > 3 && npMatch[0].length < 40) {
        const cleaned = this._cleanConceptPhrase(npMatch[0]);
        if (cleaned) concepts.push(cleaned);
      }
    }

    // 4. Prominent Quoted Terms
    const quoted = seg.match(/['"`](.*?)['"`]/g) || [];
    quoted.forEach(q => {
      const strip = q.replace(/['"`]/g, '').trim();
      const cleaned = this._cleanConceptPhrase(strip);
      if (cleaned) concepts.push(cleaned);
    });

    // 5. Direct domain lexicon scan with word boundary / plural matching
    for (const term of ACADEMIC_DOMAIN_TERMS) {
      if (term.length >= 3) {
        const termRegex = new RegExp(`\\b${escapeRegex(term)}s?\\b`, 'i');
        if (termRegex.test(seg)) {
          const titleCase = term.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          concepts.push(titleCase);
        }
      }
    }

    // Sort by length descending so specific terms come before generic terms
    concepts.sort((a, b) => b.length - a.length);

    // Deduplicate concepts with stem normalization and subphrase deduplication
    const deduped = [];
    const seenStems = new Set();
    for (const c of concepts) {
      const stem = c.toLowerCase().replace(/s$/, '');
      if (!seenStems.has(stem)) {
        const isSubpartOfExisting = deduped.some(existing => existing.toLowerCase().includes(c.toLowerCase()) && existing.length > c.length);
        if (!isSubpartOfExisting) {
          seenStems.add(stem);
          deduped.push(c);
        }
      }
    }

    return deduped.slice(0, 8);
  }

  /**
   * Analyze raw text or transcript for Pedagogy-Aware Teaching Value and Curricular Depth.
   * 
   * @param {String} text - Raw transcript or combined document text
   * @returns {Object} Pedagogy-aware analysis result
   */
  analyzeLecture(text = '') {
    const raw = (text || '').trim();
    if (raw.length < 10) {
      return {
        isAcademic: false,
        isCurricular: false,
        reason: 'INSUFFICIENT_CONTENT: The provided material is too short to evaluate.',
        teachingValueScore: 0,
        lectureDepth: {
          rating: 'Non-Academic',
          score: 0,
          characteristics: { conceptExplanation: 'None', reasoning: 'None', examples: 'None', procedures: 'None' }
        },
        detectedFocus: [],
        retainedSegments: [],
        curricularSegments: [],
        pedagogicalSegments: [],
        adminSegments: [],
        discardedSegments: []
      };
    }

    const segments = this.segmentText(raw);
    let prevSeg = null;
    const classifiedSegments = segments.map(seg => {
      const classification = this.classifySegment(seg, prevSeg);
      prevSeg = seg;
      return {
        text: seg,
        classification
      };
    });

    // Partition segments by Pedagogy Retention Action & Type
    const retainedSegments = classifiedSegments.filter(s => s.classification.action === 'KEEP_WHOLE' || s.classification.action === 'KEEP_PARTIAL');
    const discardedSegments = classifiedSegments.filter(s => s.classification.action === 'DISCARD');

    const curricularSegments = retainedSegments.filter(s => 
      ['CORE_EXPLANATION', 'EXAMPLE', 'ANALOGY', 'REAL_WORLD_APPLICATION', 'TEACHER_EXPERIENCE', 'TECHNICAL_HUMOR', 'DEMONSTRATION', 'PEDAGOGICAL_GUIDANCE'].includes(s.classification.type)
    );

    const pedagogicalSegments = classifiedSegments.filter(s => 
      s.classification.type === 'PEDAGOGICAL_GUIDANCE' || s.classification.type === 'TEACHER_EXPERIENCE' || s.classification.type === 'ANALOGY' || s.classification.type === 'TECHNICAL_HUMOR'
    );

    const adminSegments = classifiedSegments.filter(s => s.classification.type === 'ADMINISTRATIVE');
    const fictionalSegments = classifiedSegments.filter(s => s.classification.type === 'OFF_TOPIC');
    const offTopicSegments = classifiedSegments.filter(s => s.classification.type === 'OFF_TOPIC' || s.classification.type === 'UNRELATED_STORY');

    // Aggregate Teaching Value Score (0.0 to 100.0)
    let totalTeachingValue = 0;
    if (classifiedSegments.length > 0) {
      totalTeachingValue = classifiedSegments.reduce((sum, s) => sum + (s.classification.teaching_value || 0), 0) / classifiedSegments.length;
    }

    // Extract genuine curriculum concept links strictly from retained teaching segments
    const termFreq = new Map();
    curricularSegments.forEach(s => {
      (s.classification.concept_links || s.classification.matchedTerms || []).forEach(t => {
        const normKey = t.toLowerCase().replace(/\s+/g, ' ').replace(/s$/, '');
        const current = termFreq.get(normKey) || { term: t, count: 0 };
        current.count += 1;
        if (t.length > current.term.length) current.term = t;
        termFreq.set(normKey, current);
      });
    });

    let sortedTerms = Array.from(termFreq.values())
      .sort((a, b) => b.count - a.count)
      .map(entry => entry.term);

    // If frequency map yielded few terms, scan raw text directly for academic domain terms
    if (sortedTerms.length < 3) {
      const directConcepts = this._extractConceptsFromSegment(raw);
      directConcepts.forEach(dc => {
        if (!sortedTerms.some(st => st.toLowerCase() === dc.toLowerCase())) {
          sortedTerms.push(dc);
        }
      });
    }

    const detectedFocus = sortedTerms.slice(0, 6);

    // ──────────────────────────────────────────────────────────────────────────
    // Robust Curricular & Academic Verification:
    // ──────────────────────────────────────────────────────────────────────────
    const hasAcademicLexicon = this._hasAcademicDomainWord(raw.toLowerCase());
    const hasCodeOrTechnical = this._isCodeOrTechnicalSnippet(raw);
    const hasSyllabusHeader = this._isSyllabusOrCourseHeader(raw.toLowerCase());

    const isExplicitlyFictional = fictionalSegments.length > 0 && curricularSegments.length === 0;
    const isPredominantlyFictional = fictionalSegments.length >= 2 && fictionalSegments.length > curricularSegments.length && !hasAcademicLexicon && !hasCodeOrTechnical;
    const isPurelyAdmin = adminSegments.length > 0 && curricularSegments.length === 0 && !hasAcademicLexicon;

    // Academic validity check
    const hasAcademicSubstance = (curricularSegments.length >= 1 || detectedFocus.length >= 1 || hasAcademicLexicon || hasCodeOrTechnical || hasSyllabusHeader) && !isExplicitlyFictional && !isPredominantlyFictional;

    if (!hasAcademicSubstance) {
      let reason = 'NON_ACADEMIC_CONTENT: The provided material does not contain assessable educational subject matter or curriculum concepts.';
      if (isExplicitlyFictional || isPredominantlyFictional) {
        reason = 'NON_ACADEMIC_CONTENT: The uploaded audio/video appears to be an animated cartoon, fictional entertainment narrative, or personal conversation. As an educational assessment platform, questions are strictly generated from academic lectures, textbooks, and course curriculum.';
      } else if (isPurelyAdmin) {
        reason = 'INSUFFICIENT_CURRICULAR_CONTENT: Material contains administrative logistics or casual chatter without assessable teaching concepts.';
      }

      return {
        isAcademic: false,
        isCurricular: false,
        reason,
        teachingValueScore: Math.round(totalTeachingValue * 100),
        lectureDepth: {
          rating: 'Non-Academic',
          score: 10,
          characteristics: { conceptExplanation: 'None', reasoning: 'None', examples: 'None', procedures: 'None' },
          breakdown: {
            earnedRubric: [
              { category: 'Baseline Curricular Substance', earned: 10, max: 40, status: 'Failed', description: 'No assessable instructional curriculum detected.' },
              { category: 'Concept Definition & Explanation', earned: 0, max: 15, status: 'None', description: 'No concepts defined.' },
              { category: 'Causal Reasoning & Invariants', earned: 0, max: 15, status: 'None', description: 'No reasoning detected.' },
              { category: 'Concrete Examples & Traces', earned: 0, max: 15, status: 'None', description: 'No examples detected.' },
              { category: 'Procedural Sequencing', earned: 0, max: 15, status: 'None', description: 'No procedures detected.' }
            ],
            deductions: [
              {
                factor: 'Non-Curricular Content',
                lostPoints: 90,
                maxPoints: 100,
                earnedPoints: 10,
                reason,
                actionableTip: 'Ensure the speech or document contains assessable engineering, scientific, mathematical, or academic curriculum.'
              }
            ],
            totalLostPoints: 90,
            coveredAspects: [],
            missingAspects: ['Assessable subject matter curriculum', 'Academic Definitions', 'Reasoning', 'Examples'],
            actionableTips: ['Teach specific academic subject matter rather than conversational dialogue or entertainment.'],
            recommendedQuestionCount: 0,
            recommendedQuestionsRationale: 'Cannot generate questions: No curricular substance detected.'
          }
        },
        detectedFocus: [],
        retainedSegments: [],
        curricularSegments: [],
        pedagogicalSegments,
        adminSegments,
        discardedSegments
      };
    }

    // Curricular depth calculations
    const curricularText = curricularSegments.map(s => s.classification.evidence_text || s.text).join(' ');
    const lowerCurricular = (curricularText || raw).toLowerCase();

    const hasDef = curricularSegments.some(s => s.classification.substanceType === 'DEFINITION_OR_FACT') || /is an?|means|defined as/i.test(lowerCurricular);
    const hasMech = curricularSegments.some(s => s.classification.substanceType === 'MECHANISM') || hasCodeOrTechnical;
    const hasRule = curricularSegments.some(s => s.classification.substanceType === 'RULE_OR_CONDITION');
    const hasComp = curricularSegments.some(s => s.classification.substanceType === 'COMPARISON');
    const hasTrace = curricularSegments.some(s => s.classification.substanceType === 'WORKED_EXAMPLE' || s.classification.substanceType === 'OBSERVATION_DEMONSTRATION' || s.classification.substanceType === 'CODE_IMPLEMENTATION');
    const hasExp = curricularSegments.some(s => s.classification.type === 'TEACHER_EXPERIENCE' || s.classification.type === 'REAL_WORLD_APPLICATION');
    const hasAnalogy = curricularSegments.some(s => s.classification.type === 'ANALOGY' || s.classification.type === 'TECHNICAL_HUMOR');

    // Compute characteristic dimensions
    const conceptExp = (hasDef || hasMech || detectedFocus.length >= 2) ? (curricularSegments.length > 2 || raw.length > 200 ? 'Strong' : 'Moderate') : 'Developing';
    const reasonMarkers = ['because', 'therefore', 'why', 'in order to', 'leads to', 'results in', 'prevents', 'eliminates', 'so that'];
    const reasonCount = reasonMarkers.filter(m => lowerCurricular.includes(m)).length;
    const reasoning = reasonCount >= 2 ? 'Strong' : (reasonCount >= 1 ? 'Moderate' : 'Light');

    const exampleMarkers = ['for example', 'for instance', 'consider', 'suppose', 'like when', 'example', 'trace', 'given array', 'notice', 'look at'];
    const hasExamples = exampleMarkers.some(m => lowerCurricular.includes(m)) || hasTrace || hasExp || hasAnalogy;
    const examples = hasExamples ? 'Present' : 'Light';

    const procMarkers = ['first', 'second', 'third', 'finally', 'then', 'step', 'after', 'before', 'pauses', 'transfers', 'restores', 'resumes', 'next'];
    const procCount = procMarkers.filter(m => lowerCurricular.includes(m)).length;
    const procedures = procCount >= 3 ? 'Strong' : (procCount >= 1 ? 'Moderate' : 'Light');

    const basePoints = 40;
    const conceptPoints = conceptExp === 'Strong' ? 15 : (conceptExp === 'Moderate' ? 10 : 5);
    const reasoningPoints = reasoning === 'Strong' ? 15 : (reasoning === 'Moderate' ? 10 : 5);
    const examplePoints = examples === 'Present' ? 15 : 5;
    const procedurePoints = procedures === 'Strong' ? 15 : (procedures === 'Moderate' ? 10 : 5);

    let depthScore = basePoints + conceptPoints + reasoningPoints + examplePoints + procedurePoints;
    depthScore = Math.min(100, Math.max(50, depthScore));

    const deductions = [];
    if (conceptPoints < 15) {
      deductions.push({
        factor: 'Concept Definition & Mechanistic Depth',
        lostPoints: 15 - conceptPoints,
        maxPoints: 15,
        earnedPoints: conceptPoints,
        reason: conceptExp === 'Moderate'
          ? 'Foundational definitions were introduced, but deeper operational mechanics and transformations were not elaborated.'
          : 'Explicit ontological definitions or operational verbs were minimal.',
        actionableTip: 'Provide formal textbook definitions for all key terms and describe the exact mechanistic operations they perform.'
      });
    }

    if (reasoningPoints < 15) {
      deductions.push({
        factor: 'Causal Reasoning & Invariants',
        lostPoints: 15 - reasoningPoints,
        maxPoints: 15,
        earnedPoints: reasoningPoints,
        reason: reasoning === 'Moderate'
          ? 'Causal justification was brief. Only 1 causal connector was detected.'
          : 'Zero causal reasoning links were detected. Explanations described what happens rather than why it happens or what invariants are maintained.',
        actionableTip: 'Use explicit causal connectors ("because", "therefore", "so that", "prevents") to explain why mechanisms exist.'
      });
    }

    if (examplePoints < 15) {
      deductions.push({
        factor: 'Concrete Examples & Worked Traces',
        lostPoints: 15 - examplePoints,
        maxPoints: 15,
        earnedPoints: examplePoints,
        reason: 'Concrete examples, sample inputs/outputs, worked traces, or illustrative demonstrations were missing.',
        actionableTip: 'Include at least one concrete worked example, sample dataset walkthrough, or code trace to ground abstract principles.'
      });
    }

    if (procedurePoints < 15) {
      deductions.push({
        factor: 'Procedural Execution & Algorithmic Sequencing',
        lostPoints: 15 - procedurePoints,
        maxPoints: 15,
        earnedPoints: procedurePoints,
        reason: procedures === 'Moderate'
          ? 'Procedural progression was partial. Only limited chronological execution markers were found.'
          : 'Sequential execution stages or algorithmic transitions were not explicitly sequenced.',
        actionableTip: 'Structure procedures with clear chronological steps (e.g., "First, ..., Then, ..., Next, ..., Finally, ...").'
      });
    }

    const totalLostPoints = deductions.reduce((sum, d) => sum + d.lostPoints, 0);

    const coveredAspects = [];
    if (detectedFocus.length > 0) {
      coveredAspects.push(`Core topics covered: ${detectedFocus.join(', ')}`);
    }
    if (hasDef) {
      coveredAspects.push('Explicit concept definitions and ontological characterizations');
    }
    if (hasMech) {
      coveredAspects.push('Operational mechanisms and functional transformation processes');
    }
    if (hasExp) {
      coveredAspects.push('Teacher industry experiences, real-world case studies, or production incidents');
    }
    if (hasAnalogy) {
      coveredAspects.push('Conceptual analogies or pedagogical technical humor');
    }
    if (hasRule) {
      coveredAspects.push('Invariants, conditional boundaries, and operational rules');
    }
    if (hasComp) {
      coveredAspects.push('Comparative contrasts and structural distinctions');
    }
    if (examples === 'Present') {
      coveredAspects.push('Concrete examples, observational walkthroughs, or worked traces');
    }
    if (procedures === 'Strong') {
      coveredAspects.push('Step-by-step procedural workflow and algorithmic sequencing');
    } else if (procedures === 'Moderate') {
      coveredAspects.push('Introductory procedural progression');
    }
    if (reasoning === 'Strong') {
      coveredAspects.push('Deep causal reasoning with explicit explanations of why rules apply');
    } else if (reasoning === 'Moderate') {
      coveredAspects.push('Foundational causal explanations');
    }

    const missingAspects = [];
    if (reasoningPoints < 15) {
      missingAspects.push('Causal depth: deeper explanation of why mechanisms behave as they do');
    }
    if (examplePoints < 15) {
      missingAspects.push('Concrete worked traces, sample code, or practical illustrative examples');
    }
    if (procedurePoints < 15) {
      missingAspects.push('Explicit multi-step procedural progression');
    }
    if (conceptPoints < 15) {
      missingAspects.push('Formal textbook definitions and complete operational mechanisms');
    }

    const actionableTips = deductions.map(d => d.actionableTip);
    if (actionableTips.length === 0) {
      actionableTips.push('Outstanding pedagogical delivery! All core rubric dimensions are thoroughly demonstrated.');
    }

    const wordCount = (curricularText || raw).split(/\s+/).filter(Boolean).length;
    let recCount = 5;
    let rationale = '';

    if (curricularSegments.length <= 2 || wordCount < 150) {
      recCount = 3;
      rationale = '3 Questions: Compact curricular substance. Best for a quick conceptual check without redundant targets.';
    } else if (curricularSegments.length <= 5 || wordCount < 500) {
      recCount = 5;
      rationale = '5 Questions: Covers core definitions and primary mechanisms with balanced cognitive depth.';
    } else if (curricularSegments.length <= 9 || wordCount < 1200) {
      recCount = 8;
      rationale = '8 Questions: Optimal for this substantive lecture. Thoroughly assesses concepts, procedural traces, and causal reasoning.';
    } else {
      recCount = 10;
      rationale = '10 Questions: Rich multi-topic lecture. Enables broad coverage across foundational concepts, application, and edge cases.';
    }

    let rating = 'Developing';
    if (depthScore < 60) rating = 'Introductory';
    else if (depthScore >= 75) rating = 'Comprehensive';
    else rating = 'Developing';

    return {
      isAcademic: true,
      isCurricular: true,
      reason: null,
      teachingValueScore: Math.max(50, Math.round(totalTeachingValue * 100)),
      lectureDepth: {
        rating,
        score: depthScore,
        characteristics: {
          conceptExplanation: conceptExp,
          reasoning,
          examples,
          procedures
        },
        breakdown: {
          earnedRubric: [
            { category: 'Baseline Curricular Substance', earned: basePoints, max: 40, status: 'Earned', description: 'Verified assessable curriculum concepts with substantive instructional predicate.' },
            { category: 'Concept Definition & Explanation', earned: conceptPoints, max: 15, status: conceptExp, description: conceptExp === 'Strong' ? 'Comprehensive conceptual definitions and operational mechanisms.' : (conceptExp === 'Moderate' ? 'Introductory definitions present; could use deeper formal elaboration.' : 'Limited or missing definitions.') },
            { category: 'Causal Reasoning & Invariants', earned: reasoningPoints, max: 15, status: reasoning, description: reasoning === 'Strong' ? 'Explicit causal justifications and operational rationale (answering why).' : (reasoning === 'Moderate' ? 'Basic causal reasoning detected.' : 'No causal links detected.') },
            { category: 'Concrete Examples & Traces', earned: examplePoints, max: 15, status: examples, description: examples === 'Present' ? 'Practical examples, worked traces, or demonstrations.' : 'Missing concrete sample traces or demonstrations.' },
            { category: 'Procedural Sequencing', earned: procedurePoints, max: 15, status: procedures, description: procedures === 'Strong' ? 'Detailed multi-step algorithmic or procedural progression.' : (procedures === 'Moderate' ? 'Basic procedural steps present.' : 'Sequential procedural steps missing.') }
          ],
          deductions,
          totalLostPoints,
          coveredAspects,
          missingAspects,
          actionableTips,
          recommendedQuestionCount: recCount,
          recommendedQuestionsRationale: rationale
        }
      },
      detectedFocus,
      retainedSegments,
      curricularSegments,
      pedagogicalSegments,
      adminSegments,
      discardedSegments
    };
  }
}

module.exports = new DepthAnalyzer();
