const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, 'raw_outputs');
const pkgs = fs.readdirSync(baseDir).filter(f => f.startsWith('pkg_')).sort();

console.log('Auditing Benchmark Runs Across Packages:');
console.log('Total packages found:', pkgs.length);

let totalSys1 = 0;
let totalSys2 = 0;
let totalSys3 = 0;
const packageSummary = [];
const fileErrors = [];
const schemaErrors = [];

for (const pkg of pkgs) {
  const dir = path.join(baseDir, pkg);
  const files = [
    { name: 'system1_zeroshot.json', id: 'Sys1' },
    { name: 'system2_rag.json', id: 'Sys2' },
    { name: 'system3_lcacm.json', id: 'Sys3' }
  ];

  const counts = {};

  for (const f of files) {
    const p = path.join(dir, f.name);
    if (!fs.existsSync(p)) {
      fileErrors.push(`Missing ${f.name} in ${pkg}`);
      continue;
    }
    try {
      const content = fs.readFileSync(p, 'utf8');
      const data = JSON.parse(content);
      const qCount = Array.isArray(data.questions) ? data.questions.length : 0;
      counts[f.id] = qCount;

      if (f.id === 'Sys1') totalSys1 += qCount;
      if (f.id === 'Sys2') totalSys2 += qCount;
      if (f.id === 'Sys3') totalSys3 += qCount;

      if (!Array.isArray(data.questions)) {
        schemaErrors.push(`${pkg}/${f.name}: questions is not an array`);
      } else {
        data.questions.forEach((q, idx) => {
          if (!q.questionText || typeof q.questionText !== 'string') {
            schemaErrors.push(`${pkg}/${f.name} Q${idx+1}: missing or non-string questionText`);
          }
          if (!Array.isArray(q.options) || q.options.length !== 4) {
            schemaErrors.push(`${pkg}/${f.name} Q${idx+1}: options array length is not 4 (${q.options ? q.options.length : 0})`);
          }
          if (q.correctAnswer === undefined && q.correct_option === undefined) {
            schemaErrors.push(`${pkg}/${f.name} Q${idx+1}: missing correct answer`);
          }
        });
      }
    } catch (e) {
      fileErrors.push(`Corrupt JSON in ${pkg}/${f.name}: ${e.message}`);
    }
  }

  packageSummary.push({
    pkg,
    sys1: counts['Sys1'],
    sys2: counts['Sys2'],
    sys3: counts['Sys3'],
    pkgTotal: (counts['Sys1'] || 0) + (counts['Sys2'] || 0) + (counts['Sys3'] || 0)
  });
}

console.log('\n--- Package Level Item Counts ---');
console.table(packageSummary);

console.log('\n--- Aggregate Totals ---');
console.log(`System 1 (Zero-Shot AQG): ${totalSys1} items (Expected: 126)`);
console.log(`System 2 (Sliding-Window RAG): ${totalSys2} items (Expected: 140)`);
console.log(`System 3 (Frozen LCA-CM): ${totalSys3} items (Expected: 140)`);
console.log(`Grand Total Corpus Items: ${totalSys1 + totalSys2 + totalSys3} (Expected: 406)`);
console.log(`File Errors: ${fileErrors.length}`);
if (fileErrors.length > 0) console.log(fileErrors);
console.log(`Schema / Structural Errors: ${schemaErrors.length}`);
if (schemaErrors.length > 0) console.log(schemaErrors);
