// Generates docs/paper1_architecture.svg: the single MCQ pipeline (27 Nov 2026). node paper1_architecture_gen.js <out.svg>
const fs = require('fs');
const out = process.argv[2] || __dirname + '/paper1_architecture.svg';
const W = 1600, H = 1130;
const s = [];
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const STAR = '★';
const star = t => esc(t).replace(STAR, `<tspan class="star">${STAR}</tspan>`);
function panel(x, y, w, h, title, sub) {
  s.push(`<rect class="panel" x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/>`);
  s.push(`<text class="ph" x="${x + 16}" y="${y + 26}">${esc(title)}</text>`);
  if (sub) s.push(`<text class="ps" x="${x + 16}" y="${y + 44}">${esc(sub)}</text>`);
}
function box(x, y, w, h, cls, title, lines = []) {
  s.push(`<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/>`);
  s.push(`<text class="t" x="${x + 10}" y="${y + 20}">${star(title)}</text>`);
  lines.forEach((l, i) => {
    let c = 's', txt = l;
    if (l.startsWith('!')) { c = 'open'; txt = l.slice(1); }
    if (l.startsWith('~')) { c = 's it'; txt = l.slice(1); }
    s.push(`<text class="${c}" x="${x + 10}" y="${y + 38 + i * 14}">${star(txt)}</text>`);
  });
}
const arrow = (d, cls = 'ln') => s.push(`<path class="${cls}" d="${d}"/>`);
const label = (x, y, t, a = 'start') => s.push(`<text class="lab" x="${x}" y="${y}" text-anchor="${a}">${esc(t)}</text>`);
const bw = 200, xs = [40, 260, 480, 700, 920, 1140, 1360];

// ── 1 READ ──
panel(20, 20, 1560, 150, '1  Read: every input becomes text, keeping where it came from', 'one path for every input: lecture audio or video, slides, PDFs, Word, photos and handwriting, pasted notes, code or terminal sessions, or just a topic name');
box(40, 70, 300, 88, 'det', 'Speech', ['audio or video → Whisper (timed segments)', 'code-mixed speech → translated to English,', 'original kept']);
box(360, 70, 300, 88, 'det', 'Documents and images', ['PDF / PPTX / DOCX → text (slide numbers kept)', 'scans, photos, handwriting → Gemini vision', '(OCR as backup)']);
box(680, 70, 280, 88, 'det', 'Pasted text box', ['notes; code; terminal / SQL sessions', '(classified and kept verbatim)', 'instructions aimed at the AI removed']);
box(980, 70, 260, 88, 'det', 'Topic name only', ['→ reference notes written for', 'the topic, then the same path', '(general knowledge, not a lecture)']);
box(1260, 70, 300, 88, 'det', 'Refused with a reason', ['nothing readable; nothing taught', '(greetings, admin, banter);', 'too little content']);

// ── 2 UNDERSTAND ──
panel(20, 185, 1560, 405, '2  Understand: the lecture model (read once, cached)', 'what was actually taught, how, how deeply, and what it supports, with every point traced to the teacher’s own words');
const r = 245, rh = 132;
box(xs[0], r, bw, rh, 'det', 'Typed blocks', ['speech ≤ 60 s / 170 words', 'one slide (number kept)', 'code construct ≤ 12 lines', '1–2 terminal commands', 'each block keeps its file']);
box(xs[1], r, bw, rh, 'det', 'Speech–material linkage', ['only when both exist', 'each slide joins the part of', 'the talk it matches, by shared', 'words AND meaning (multilingual', 'embeddings); full → next match']);
box(xs[2], r, bw, rh, 'llm', 'Teaching points', ['per window: topic, subtopic,', 'depth, emphasis, teacher’s', 'example, question angles,', 'misconceptions', 'speech-recognition slips fixed']);
box(xs[3], r, bw, rh, 'det', 'Quote check', ['a point is kept only if its', 'quote appears word for word', 'in the cited block', '(4.3% of points dropped)', 'uncited blocks re-read']);
box(xs[4], r, bw, rh, 'llm', 'Merge repeats', ['the same point taught again', '(minute 5 and minute 40) is', 'one point: both times kept,', 'revisit counted', 'topic names unified']);
box(xs[5], r, bw, rh, 'llm', 'Calibration ★', ['the whole lecture at once:', 'teacher’s intent; is it teachable;', 'what Easy/Medium/Hard mean', 'for THIS class; each point’s role;', 'each angle judged blind']);
box(xs[6], r, bw, rh, 'det', 'Capacity ★', ['angles per difficulty', 'recommended = distinct taught', 'points per difficulty', 'material-only points: a', 'separate supplement']);
for (let i = 0; i < 6; i++) arrow(`M${xs[i] + bw},${r + 66} H${xs[i + 1] - 2}`);
const r2 = 410, r2h = 160;
arrow(`M${xs[6] + 100},${r + rh} V392 H250 V${r2 - 2}`);
arrow(`M640,392 V${r2 - 2}`);
arrow(`M1010,392 V${r2 - 2}`);
arrow(`M1400,392 V${r2 - 2}`);
box(40, r2, 420, r2h, 'art', 'Lecture model (hierarchy)', ['Lecture → topics (time share) → teaching points', '(statement, verbatim quote, blocks, timestamps,', 'slides, depth, emphasis, revisits, role, meaning vector)', '→ question angles (type, focus, calibrated difficulty)', '+ intent, level, difficulty meanings, timeline,', 'speech–slide contradictions', '~stored as structured data, not text chunks']);
box(480, r2, 320, r2h, 'det', 'Teaching style (PDI v2)', ['how each point was taught: theory, code', 'walkthrough, worked problems, examples,', 'revision; slide fidelity (shared phrases)', '→ question-type preference + a note', 'for the writer; teacher can correct it', '~replaces PDI v1 (6 upload features)']);

box(820, r2, 380, r2h, 'det', 'Importance of each point', ['role in the intent (core / supporting /', 'peripheral) + depth + emphasis +', 'revisits + teaching time', '→ what to keep when fewer questions', 'are asked; which reserves come first']);
box(1220, r2, 340, r2h, 'fut', 'Teaching score', ['read from the same lecture model', 'not part of Paper 1 (Paper 2)']);

// ── 3 PLAN → DELIVER ──
panel(20, 605, 1560, 465, '3  Plan → write → check → accept → deliver', 'writer and every checker see the same teacher passage for each point; checkers come from a different model family than the writer');
const a = 660, ah = 146;
box(xs[0], a, bw, ah, 'det', 'Teacher request', ['count (≤ 30)', 'Easy / Medium / Hard /', 'Balanced', 'topics to leave out', 'style correction']);
box(xs[1], a, bw, ah, 'art', 'Test blueprint ★', ['lecture first: material-only', 'points only for the shortfall', 'mix from calibrated capacity', 'topics: capacity + time', 'points: importance, style fit,', 'type variety; one idea once', '(same meaning = same point)']);
box(xs[2], a, bw, ah, 'llm', 'Write', ['one question per target with', 'the teacher’s passage, intent,', 'what its difficulty means here,', 'question type, Hard recipe,', 'lecture misconceptions', '→ distractors; ≤ 45 words', '!writer model: set in E17']);
box(xs[3], a, bw, ah, 'det', 'Check each', ['rule checks: format, key,', 'distractors related to the', 'lecture, code shown when', 'the type needs it', 'fail → critic + 1 repair', 'Medium/Hard with nothing to', 'work on → 1 rewrite']);
box(xs[4], a, bw, ah, 'llm', 'Final Quality Gate ★', ['13 criteria per question:', 'single answer · correctness', '(numbers recomputed) ·', 'grounding · distractors · clues', '· depth · clarity · fairness …', 'duplicates by meaning']);
box(xs[5], a, bw, ah, 'llm', 'Blind answer check', ['another model family solves', 'without the key;', 'disagreement → rejected;', 'disputed lecture points', 'flagged to the teacher']);
box(xs[6], a, bw, ah, 'art', 'Deliver', ['questions + notice: what was', 'delivered, at which', 'difficulty, any shortfall and', 'why, points from material', 'only, coverage', '→ teacher review → students']);
for (let i = 0; i < 6; i++) arrow(`M${xs[i] + bw},${a + 73} H${xs[i + 1] - 2}`);
const b = 880, bh = 120;
box(xs[3], b, 420, bh, 'det', 'Replace', ['a rejected or failed slot takes the most important unused', 'reserve of the same difficulty (nearest difficulty only if none', 'is left); at most two rounds, each checked again', 'a busy provider → the same point retried after a pause']);
arrow(`M${xs[4] + 100},${a + ah} V${b - 2}`); label(xs[4] + 106, b - 12, 'rejected');
arrow(`M${xs[3] + 100},${a + ah} V${b - 2}`); label(xs[3] + 106, b - 12, 'failed');
arrow(`M${xs[3] + 60},${b} V${a + ah + 2}`, 'lnd'); label(xs[3] + 8, b - 12, 're-checked', 'start');
box(xs[5], b, 420, bh, 'det', 'Model routing (free tier, 16 keys)', ['the chosen model is tried on every key (most token', 'budget first) before any other model; a short per-minute', 'reset is waited for, not switched around; work paced', 'to the number of keys']);
box(40, b, 640, bh, 'fut', 'Removed, kept in legacy/pre_single_pipeline (with reasons)', ['old orchestrator + Agent 1 planner · chunk retrieval (parent/child chunks, BM25 +', 'TF hybrid, reranker, alignment graph with hand-written cases) · PDI v1 router ·', 'second teaching-point reader · heuristic analysis fallback · switch-off for the gate', '~the writer and the checks now share one evidence source: the lecture model']);

// legend
const ly = 1100;
[['llm', 'LLM step'], ['det', 'deterministic step'], ['art', 'stored structure / output'], ['fut', 'not in the Paper 1 pipeline']].reduce((x, [c, t]) => {
  s.push(`<rect class="${c}" x="${x}" y="${ly - 11}" width="22" height="14" rx="3"/>`); s.push(`<text class="s" x="${x + 30}" y="${ly}">${t}</text>`); return x + 60 + t.length * 6.2;
}, 40);
s.push(`<text class="star" x="760" y="${ly + 1}">${STAR}</text><text class="s" x="776" y="${ly}">Paper 1 contribution</text>`);
s.push(`<text class="open" x="930" y="${ly}">red</text><text class="s" x="955" y="${ly}">= still to be fixed by experiment</text>`);
s.push(`<text class="ps" x="40" y="${ly + 22}">Branch feat/semantic-linkage-quality. Free-tier models only: Groq qwen3.8-27b, gpt-oss-120b, gpt-oss-20b; Gemini flash / flash-lite; gemini-embedding-001. No agent framework.</text>`);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Arial, Helvetica, sans-serif">
<defs>
<marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#555"/></marker>
<style>
.panel{fill:#FAFAF8;stroke:#D6D6D0;stroke-width:1}
.ph{font-size:15px;font-weight:bold;fill:#222}
.ps{font-size:11px;fill:#666}
.llm{fill:#E8EEF9;stroke:#3B5BA9;stroke-width:1.4}
.det{fill:#F1F1EE;stroke:#7A7A75;stroke-width:1.4}
.art{fill:#FFF3DC;stroke:#C27C0E;stroke-width:1.8}
.fut{fill:#FFFFFF;stroke:#999;stroke-width:1.4;stroke-dasharray:6 4}
.t{font-size:13px;font-weight:bold;fill:#1A1A1A}
.s{font-size:11px;fill:#444}
.it{font-style:italic}
.open{font-size:11px;font-weight:bold;fill:#B03A2E}
.lab{font-size:10px;fill:#555;font-style:italic}
.ln{fill:none;stroke:#555;stroke-width:1.4;marker-end:url(#a)}
.lnd{fill:none;stroke:#555;stroke-width:1.4;stroke-dasharray:5 4;marker-end:url(#a)}
.star{font-size:13px;font-weight:bold;fill:#C27C0E}
</style>
</defs>
<rect width="${W}" height="${H}" fill="#FFFFFF"/>
${s.join('\n')}
</svg>
`;
fs.writeFileSync(out, svg);
console.log('wrote', out);
