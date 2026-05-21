# Load Testing Suite — Quiz Platform

This directory contains all load, stress, and performance testing tools for the
KMIT Quiz Platform.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **k6** | ≥ 0.46 | https://k6.io/docs/get-started/installation/ |
| **Locust** | ≥ 2.x | `pip install locust` |
| **Playwright** | ≥ 1.40 | `npm install playwright` |
| **Node.js** | ≥ 18 | https://nodejs.org |

---

## Test Data Setup (run once)

> These scripts require the backend server to be running and a valid `DATABASE_URL` in `server/.env`.

```powershell
# 1. Seed 2000 test students (test_student_1@kmit.in … test_student_2000@kmit.in)
node server/seed_load_test_students.js

# 2. Create / upsert the load-test quiz (joinCode: 999999)
node server/create_load_test_quiz.js
```

---

## k6 Tests

All tests accept environment variable overrides:

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:5000` | Backend API URL |
| `QUIZ_CODE` | `999999` | Join code for HTTP test |
| `QUIZ_ID` | `817de27f-…` | Quiz UUID for WS tests |

### HTTP Load Test (login → join → leaderboard)
```powershell
# Basic run (1000 users)
k6 run load_tests/http_test.js

# Custom server
k6 run -e BASE_URL=http://myserver:5000 load_tests/http_test.js

# Save results as JSON
k6 run --out json=load_tests/results/http_results.json load_tests/http_test.js
```

### WebSocket Concurrency Test (1000 simultaneous WS connections)
```powershell
# Requires teacher_simulator.js running in a separate terminal
k6 run load_tests/ws_test.js
```

### Stress Test (ramps to 2000 users)
```powershell
k6 run load_tests/stress_test.js
```

### Endurance Test (250 users for 10 minutes)
```powershell
k6 run load_tests/endurance_test.js
```

### AI Service Test
```powershell
# Tests the FastAPI AI service (port 8000)
k6 run load_tests/ai_test.js

# Custom AI server
k6 run -e BASE_URL=http://localhost:8000 load_tests/ai_test.js
```

---

## Teacher Simulator (required for WS test)

The WebSocket test needs a teacher to control question flow. Run this **before** starting `ws_test.js`:

```powershell
# Default quiz ID
node server/teacher_simulator.js

# Custom quiz
$env:QUIZ_ID="your-quiz-uuid"; node server/teacher_simulator.js
```

---

## Locust Test (teacher workflow)

```powershell
# Headless (CI)
locust -f locustfile.py --headless -u 50 -r 5 --host http://localhost:5000 --run-time 60s

# With web UI (http://localhost:8089)
locust -f locustfile.py --host http://localhost:5000
```

---

## Resource Monitor

Captures CPU/RAM metrics for Node.js, Python, and system-wide during tests:

```powershell
# Run in a separate terminal while k6/Locust tests are active
powershell -ExecutionPolicy Bypass -File load_tests/monitor_resources.ps1
```

Press **Ctrl+C** to stop. Results saved to `load_tests/resource_usage_log.csv`.

---

## Playwright Screenshots

Captures before/during load-test screenshots for documentation:

```powershell
# Requires both frontend (port 5173) and backend (port 5000) running
node load_tests/screenshot_load_test.js
```

Screenshots are saved to `load_tests/screenshots/` and are **gitignored** (regenerated on each run).

---

## Thresholds Summary

| Test | Key Threshold |
|------|--------------|
| http_test | `p(95) < 1000ms`, `failure < 1%` |
| ws_test | `http_req_failed < 1%` |
| stress_test | `http_req_failed < 5%` |
| endurance_test | `p(95) < 2000ms`, `failure < 1%` |
| ai_test | `failure < 5%` |

---

## DISABLE_LIMITS flag

The backend applies rate limiting (500 req/15min per IP). For local load tests, start the server with:

```powershell
$env:DISABLE_LIMITS="true"; node server/index.js
```

This bypasses rate limiting without changing production code.
