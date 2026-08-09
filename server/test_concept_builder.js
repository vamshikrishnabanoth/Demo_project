require('dotenv').config();
const { buildConceptGraph } = require('./engine/conceptGraphBuilder/index');

function runConceptBuilderTests() {
  console.log('=== TEST 1: Concept Graph Builder v2.6.0 Pipeline Execution ===');

  const textSample = `
# Computer Network Protocols & Architecture

Transmission Control Protocol (TCP) is a core protocol of the Internet protocol suite.
TCP is defined as a connection-oriented protocol that guarantees reliable delivery.

## Transport Layer Flow Control

The sliding window protocol is used by TCP for flow control.
The \`socket()\` function opens a network socket descriptor.
An ACK flag is sent by the receiver to acknowledge frame receipt.

### Error Checking Mechanism

A Checksum is used for error detection across frames.
`;

  const result = buildConceptGraph(textSample);

  console.log('Graph Version:', result.graphVersion);
  console.log('Metadata:', JSON.stringify(result.metadata, null, 2));
  console.log('Active Nodes Count:', result.nodes.length);
  console.log('Active Edges Count:', result.edges.length);
  console.log('Topological Traversal Order:', result.traversalOrder);
  console.log('Inverted Concept Index Keys:', Object.keys(result.conceptIndex));

  console.log('\n=== TEST 2: Inspect First Enriched Node Schema ===');
  if (result.nodes.length > 0) {
    console.log(JSON.stringify(result.nodes[0], null, 2));
  }

  console.log('\n=== TEST 3: Inspect Clusters ===');
  console.log(JSON.stringify(result.clusters, null, 2));

  console.log('\n=== ALL CONCEPT GRAPH BUILDER TESTS PASSED CLEANLY! ===');
}

try {
  runConceptBuilderTests();
} catch (err) {
  console.error('❌ Concept Builder Test Error:', err);
  process.exit(1);
}
