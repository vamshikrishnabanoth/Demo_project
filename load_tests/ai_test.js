import http from 'k6/http';
import { check, sleep } from 'k6';

// ── Config: override via k6 env vars ──────────────────────────────────────────
// Usage: k6 run -e BASE_URL=http://ai-server:8000 ai_test.js
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

export const options = {
  // Test sequential brackets of concurrency
  stages: [
    { duration: '20s', target: 2  }, // Bracket 1: 1–2 concurrent requests (smooth)
    { duration: '20s', target: 5  }, // Bracket 2: 3–5 concurrent requests (acceptable)
    { duration: '20s', target: 10 }, // Bracket 3: 10+ concurrent requests (stress/slow)
    { duration: '10s', target: 0  }, // Cool down
  ],
  thresholds: {
    // We expect some requests to succeed, but latency will vary heavily by bracket
    http_req_failed: ['rate<0.05'], // Under 5% failure rate
  },
};

export default function () {
  const payload = JSON.stringify({
    type:       'topic',
    content:    'Machine learning fundamentals and linear algebra',
    count:      2, // 2 questions keep generation time within bounds
    difficulty: 'Medium',
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
    timeout: '90s', // Ollama sequential generation can be slow under high concurrency
  };

  const response = http.post(`${BASE_URL}/generate`, payload, params);

  check(response, {
    'ai service status is 200': (r) => r.status === 200,
    'response is valid JSON':   (r) => {
      try { JSON.parse(r.body); return true; } catch (_) { return false; }
    },
    'has generated questions': (r) => {
      try {
        const data = JSON.parse(r.body);
        return Array.isArray(data.questions) && data.questions.length > 0;
      } catch (_) {
        return false;
      }
    },
  });

  // Short pause before the virtual user requests again to let Ollama breathe
  sleep(2);
}
