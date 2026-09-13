# Level 1 Report: Distributed Systems: CAP Theorem & Raft Consensus Protocol
**Input ID**: `input_004_notes_distributed_consensus` | **Input Type**: `NOTES` | **Content Style**: `THEORY`

## 1. Quantitative Metrics Comparison

| Evaluation Dimension | Pipeline A (Summary) | Pipeline B (Blueprint) | Metric Interpretation |
| :--- | :---: | :---: | :--- |
| **Source Grounding** | 61.4% | 48.8% | Grounding in source chunks |
| **Source Answerability** | 52.5% | 41.1% | Answerable from provided material |
| **Average Bloom's Level** | 2.0 / 6.0 | 2.0 / 6.0 | Cognitive depth demand |
| **Material Specificity** | 3.62 / 5.0 | 3.15 / 5.0 | Reflection of specific treatment |
| **Genericness Index** | 1.0 / 5.0 | 1.0 / 5.0 | Lower = More uniquely tailored |
| **Question Diversity** | 0.947 | 0.892 | Intra-suite conceptual variety |
| **Composite Quality (Q)** | **0.596** | **0.507** | Standardized Quality Score |

### **DECISION: SUMMARY**
> Summary produced higher composite quality (Q_A=0.596 vs Q_B=0.507, delta=-0.089) on this self-contained factual content.

## 2. Experiment B1: Blueprint Validity Assessment
- **Topics Grounded in Source**: 100.0%
- **Salience Alignment Score**: 3.0 / 5.0
- **Instructional Act Accuracy**: 100.0%
- **Overall Blueprint Validity**: **88.8%**

## 3. Actual Generated Questions

### Pipeline A Questions (Summary)
**Q1 (UNDERSTAND)**: According to the CAP theorem, if a distributed system chooses to remain available during a network partition, which guarantee must it sacrifice?
- A: Consistency
- B: Partition Tolerance
- C: Both Consistency and Partition Tolerance
- D: None; it can keep all three guarantees
- *Correct*: **A** | *Explanation*: The CAP theorem states that in the presence of a partition, a system can provide at most two of the three guarantees. To stay Available, it must sacrifice Consistency. Option B is incorrect because Partition Tolerance is required when partitions occur. Option C is wrong because only Consistency is sacrificed, not both. Option D contradicts the theorem.

**Q2 (UNDERSTAND)**: In the Raft consensus protocol, what event causes a follower to transition to the candidate state?
- A: Receiving an AppendEntries RPC with a higher term
- B: Detecting a leader's heartbeat timeout after a randomized election timeout
- C: Being voted for by a majority of nodes
- D: Appending a client command to its own log
- *Correct*: **B** | *Explanation*: A follower becomes a candidate when it does not receive heartbeats within its randomized election timeout (150‑300 ms). Option A describes a follower stepping down, not becoming a candidate. Option C describes the condition for becoming leader, not candidate. Option D is an action performed by a leader, not a trigger for candidacy.

**Q3 (UNDERSTAND)**: When does Raft consider a log entry to be committed?
- A: Immediately after the leader appends it to its own log
- B: When the entry is replicated on a majority of servers
- C: When the entry is stored on all servers in the cluster
- D: When the entry is applied to the state machine on the leader only
- *Correct*: **B** | *Explanation*: Raft defines commitment as the point when a log entry is stored on a majority of nodes, ensuring durability despite failures. Option A is premature; replication to a majority is required. Option C is too strict; Raft does not need all servers. Option D confuses commitment with application; an entry must be replicated before it can be applied.

**Q4 (UNDERSTAND)**: Which statement best describes Raft's safety invariant?
- A: A leader may commit entries that were not present in previous terms
- B: If a leader commits a log entry, that entry must appear in the logs of all future leaders in higher terms
- C: Followers can overwrite entries from previous terms without restriction
- D: Commitment is decided by a single node without requiring a majority
- *Correct*: **B** | *Explanation*: The safety invariant guarantees that any entry committed by a leader is present in the logs of all later leaders, preventing divergent histories. Option A contradicts the invariant. Option C ignores the up‑to‑date check that prevents overwriting committed entries. Option D misstates Raft's majority requirement for commitment.

**Q5 (UNDERSTAND)**: Which of the following systems is typically classified as a CP system under the CAP theorem?
- A: Cassandra
- B: DynamoDB
- C: HBase
- D: Riak
- *Correct*: **C** | *Explanation*: HBase (and MongoDB with majority writes) are examples of CP systems that prioritize Consistency and Partition Tolerance over Availability. Cassandra and DynamoDB are classic AP systems that favor Availability. Riak is also designed as an AP system. Therefore only option C correctly identifies a CP system.

### Pipeline B Questions (Blueprint)
**Q1 (UNDERSTAND)**: According to the CAP theorem, which of the following statements is correct?
- A: A system can provide both consistency and availability if there is no network partition.
- B: A system can provide consistency, availability, and partition tolerance simultaneously.
- C: Partition tolerance can be ignored in a perfectly reliable network.
- D: None of the above.
- *Correct*: **A** | *Explanation*: The CAP theorem states that in the presence of a network partition, a system must choose between consistency and availability; it can provide both consistency and availability only when no partition occurs. Option A captures this nuance and is therefore correct. Option B is the common misconception that all three properties can be achieved together, which the theorem disproves. Option C confuses partition tolerance with network reliability; even reliable networks can experience partitions, so tolerance is essential. Option D is incorrect because Option A is a valid statement.

**Q2 (UNDERSTAND)**: A distributed key‑value store continues to accept reads and writes during a network partition, but some reads may return stale values. Which two CAP properties does this system guarantee?
- A: Consistency and Availability
- B: Consistency and Partition tolerance
- C: Availability and Partition tolerance
- D: All three properties
- *Correct*: **C** | *Explanation*: The described behavior shows the system remains available (it accepts operations) and tolerates partitions (it keeps working despite the split). Because stale reads are possible, strong consistency is not guaranteed. Therefore, the two guaranteed properties are Availability and Partition tolerance (Option C). Option A incorrectly includes consistency. Option B pairs consistency with partition tolerance, which is not exhibited. Option D is impossible under CAP; a system cannot guarantee all three simultaneously.

**Q3 (UNDERSTAND)**: Which statement best describes eventual consistency?
- A: All reads always return the most recent write immediately.
- B: If no new updates are made, all replicas will eventually converge to the same value.
- C: Every operation appears to execute atomically across all nodes (linearizability).
- D: Reads are blocked until the write has been replicated to a majority of nodes.
- *Correct*: **B** | *Explanation*: Eventual consistency guarantees convergence: after a period without new writes, all replicas will hold the same value (Option B). Option A describes strong consistency, not eventual. Option C describes linearizability, a stronger guarantee than eventual consistency. Option D describes a quorum‑based approach for strong consistency, not eventual consistency. The misconception that eventual consistency offers the same guarantees as strong consistency is addressed by highlighting the convergence property only.

**Q4 (UNDERSTAND)**: Why is partition tolerance considered essential in the design of distributed systems?
- A: Because network partitions never occur, so it can be ignored.
- B: Because it allows the system to continue operating despite network failures.
- C: Because it guarantees strong consistency at all times.
- D: Because it eliminates the need for data replication.
- *Correct*: **B** | *Explanation*: Partition tolerance means the system can keep functioning when communication between subsets of nodes is lost, which is a realistic scenario in distributed environments; thus Option B is correct. Option A reflects the misconception that partitions are optional. Option C confuses tolerance with consistency; tolerance does not by itself guarantee strong consistency. Option D is false because replication is often used precisely to achieve tolerance and availability.

**Q5 (UNDERSTAND)**: In the Raft consensus protocol, which role is primarily responsible for handling client requests and replicating log entries to the other nodes?
- A: Follower
- B: Candidate
- C: Leader
- D: Learner
- *Correct*: **C** | *Explanation*: The Leader in Raft receives client commands, appends them to its log, and replicates the entries to Followers, ensuring consistency. Followers simply respond to AppendEntries RPCs and do not handle client requests. Candidates are transient states during elections and do not serve client traffic. "Learner" is not a standard Raft role, making Option D a distractor. This addresses the misconception that Raft needs a majority of nodes up for any operation; only a majority is required for leader election and log commitment, not for every individual request.
