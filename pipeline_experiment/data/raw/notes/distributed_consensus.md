# Distributed Systems: CAP Theorem and Raft Consensus

## 1. The CAP Theorem
The CAP Theorem states that in any asynchronous distributed network subject to network partitions (P), a system can provide at most one of the following two guarantees:
- **Consistency (C)**: Every read receives the most recent write or an error.
- **Availability (A)**: Every non-failing node returns a non-error response without guarantee that it contains the most recent write.
- **Partition Tolerance (P)**: The system continues to operate despite arbitrary message loss or delay. Since physical networks inevitably experience partitions, distributed databases must choose between CP (e.g. HBase, MongoDB majority writes) and AP (e.g. Cassandra, DynamoDB).

## 2. The Raft Consensus Protocol
Raft decomposes distributed consensus into three orthogonal subproblems:
1. **Leader Election**: When a follower does not hear heartbeats within its randomized election timeout (150ms–300ms), it transitions to Candidate, increments term, votes for itself, and requests votes. A candidate becomes Leader upon receiving votes from a majority of nodes.
2. **Log Replication**: The leader receives client commands, appends them to its local log, and sends `AppendEntries` RPCs. An entry is committed once replicated to a majority of cluster nodes.
3. **Safety Invariant**: If a leader commits a log entry, that entry will be present in the logs of all leaders for all higher terms. This is enforced during election: a node denies its vote if the candidate's log is less up-to-date than its own.
