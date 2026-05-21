import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = 'http://localhost:8000';

export const options = {
  // Test sequential brackets of concurrency
  stages: [
    { duration: '20s', target: 2 },  // Bracket 1: 1–2 concurrent requests (smooth)
    { duration: '20s', target: 5 },  // Bracket 2: 3–5 concurrent requests (acceptable)
    { duration: '20s', target: 10 }, // Bracket 3: 10+ concurrent requests (stress/slow)
    { duration: '10s', target: 0 },  // Cool down
  ],
  thresholds: {
    // We expect some requests to succeed, but latency will vary heavily by bracket
    http_req_failed: ['rate<0.05'], // Under 5% failure rate
  },
};

export default function () {
  const payload = JSON.stringify({
    type: 'topic',
    content: 'Machine learning fundamentals and linear algebra',
    count: 2, // 2 questions to keep generation time within bounds
    difficulty: 'Medium',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '90s', // Ollama sequential generation of 2 questions under high concurrency can take time
  };

  const response = http.post(`${BASE_URL}/generate`, payload, params);

  check(response, {
    'ai service status is 200': (r) => r.status === 200,
    'has generated questions': (r) => {
      try {
        const data = JSON.parse(r.body);
        return Array.isArray(data.questions) && data.questions.length > 0;
      } catch (e) {
        return false;
      }
    },
  });

  // Short pause before the virtual user requests again to let Ollama breathe
  sleep(2);
}
