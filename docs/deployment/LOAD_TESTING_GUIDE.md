# 📊 Kahoot Clone — Load Testing & Dashboard Guide

This guide explains how to run the load tests using **k6**, view the **live real-time web dashboard** during execution, and view the **compiled HTML dashboard** showing comparisons of all test results and system resource statistics.

---

## ⚡ Quick Start: Running Tests with Live Dashboard

We have configured convenient NPM scripts in the root `package.json` to automatically:
1. **Enable the Live Web Dashboard** in k6.
2. **Execute the benchmark scenario**.
3. **Save metrics output** into the `load_tests/` folder.
4. **Recompile the Unified HTML Dashboard** when the test finishes.

### Step-by-step Execution:

1. **Start the backend server** on port 5000:
   ```powershell
   cd server
   npm start
   ```

2. **Run your desired load test scenario** (open a new terminal at the root of `Demo_project`):
   ```powershell
   # Run HTTP REST API Benchmark (1,000 VUs)
   npm run test:http

   # Run WebSocket Classroom Benchmark (1,000 VUs)
   npm run test:ws

   # Run AI Quiz Generation Benchmark (2-10 VUs)
   npm run test:ai

   # Run Stress Test to breaking point (2,000 VUs)
   npm run test:stress

   # Run Endurance Test (250 VUs for 10 minutes)
   npm run test:endurance
   ```

3. **Access the Live Real-Time Dashboard:**
   While any test is running, open your web browser and go to:
   👉 **[http://localhost:5665](http://localhost:5665)**
   
   *This is k6's official web dashboard that visualizes active VUs, request rates, latencies, and checks in real-time.*

---

## 📊 Viewing the Unified HTML Report

Once any load test finishes, the runner script automatically compiles all available results (including background CPU and memory usage statistics from `resource_usage_log.csv`) into a single, beautiful HTML dashboard.

### How to Open:
Open the following file directly in your browser:
👉 **[load_tests/dashboard.html](file:///c:/Users/samanvi/OneDrive/Desktop/git_kahoot/Demo_project/load_tests/dashboard.html)**

### Dashboard Features:
* **Interactive Tabs:** Click through individual tabs to view details on HTTP API, WebSocket, AI, Stress, and Endurance benchmarks.
* **Metric Comparisons:** A summary matrix comparing peak VUs, success rates, checks, average and 95th-percentile response times across all scenarios.
* **System Resources Plot:** Interactive charts mapping Node.js memory leaks, AI Service CPU load, and Available System RAM over the testing session.
* **Dynamic Loading:** If a particular test result is missing, the dashboard gracefully prompts you with the command required to run it.

---

## ⚙️ NPM Scripts Reference

All commands must be run from the root `Demo_project` folder:

| Command | Action | Output File |
|---|---|---|
| `npm run test:http` | Run REST API Test with Live Dashboard | `load_tests/http_results.json` |
| `npm run test:ws` | Run WebSocket Test with Live Dashboard | `load_tests/ws_results.json` |
| `npm run test:ai` | Run AI Generation Test with Live Dashboard | `load_tests/ai_results.json` |
| `npm run test:stress` | Run Stress Test with Live Dashboard | `load_tests/stress_results.json` |
| `npm run test:endurance` | Run Endurance Test with Live Dashboard | `load_tests/endurance_results.json` |
| `npm run report` | Recompile report from existing results | `load_tests/dashboard.html` |

---

*Happy Benchmarking!* 🚀
