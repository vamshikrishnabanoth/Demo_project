/**
 * screenshot_load_test.js
 * 
 * Playwright script to capture screenshots of the Kahoot app
 * during load testing for documentation / mentor review.
 *
 * It simulates:
 *   1. Student Login
 *   2. Quiz Join (with game code)
 *   3. Quiz Playing (answering questions)
 *   4. Leaderboard view
 *   5. Concurrent load simulation (multiple tabs)
 *
 * Usage:
 *   npx playwright test load_tests/screenshot_load_test.js --headed
 *   OR (without test runner):
 *   node load_tests/screenshot_load_test.js
 *
 * Screenshots are saved to: load_tests/screenshots/
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const BASE_URL    = 'http://localhost:5173';     // Frontend URL (Vite dev server)
const API_URL     = 'http://localhost:5000';     // Backend URL
const QUIZ_CODE   = '999999';                    // Your existing quiz code
const STUDENT_EMAIL    = 'test_student_1@kmit.in';
const STUDENT_PASSWORD = 'KMIT@1234';
const TEACHER_EMAIL    = 'teacher@kmit.in';
const TEACHER_PASSWORD = 'KMIT@1234';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
// ─────────────────────────────────────────────────────────────────────────────

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function screenshotPath(name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(SCREENSHOT_DIR, `${name}_${timestamp}.png`);
}

async function captureWithLabel(page, filename, label) {
  console.log(`📸 Capturing: ${label}`);
  await page.screenshot({ path: screenshotPath(filename), fullPage: true });
}

// ─── SCENARIO 1: Student Login ────────────────────────────────────────────────
async function captureStudentLogin(browser) {
  console.log('\n🔵 Scenario 1: Student Login');
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await captureWithLabel(page, '01_login_page_initial', 'Login Page - Initial State');

    // Fill in credentials
    await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i]', STUDENT_EMAIL);
    await page.fill('input[type="password"], input[name="password"]', STUDENT_PASSWORD);
    await captureWithLabel(page, '02_login_page_filled', 'Login Page - Credentials Filled');

    // Submit
    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');
    await page.waitForTimeout(2000);
    await captureWithLabel(page, '03_after_login_dashboard', 'Dashboard After Login');
  } catch (err) {
    console.warn(`  ⚠️  Login scenario warning: ${err.message}`);
    await captureWithLabel(page, '01_error_login', 'Login Error State');
  } finally {
    await page.close();
  }
}

// ─── SCENARIO 2: Quiz Join ────────────────────────────────────────────────────
async function captureQuizJoin(browser) {
  console.log('\n🟢 Scenario 2: Quiz Join');
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  try {
    await page.goto(`${BASE_URL}/join`, { waitUntil: 'networkidle' });
    await captureWithLabel(page, '04_quiz_join_page', 'Quiz Join Page');

    // Enter game code
    const codeInput = page.locator('input[placeholder*="code" i], input[placeholder*="pin" i], input[name="code"]');
    if (await codeInput.count() > 0) {
      await codeInput.fill(QUIZ_CODE);
      await captureWithLabel(page, '05_quiz_code_entered', 'Quiz Code Entered');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      await captureWithLabel(page, '06_quiz_joined', 'After Quiz Joined');
    } else {
      console.warn('  ⚠️  Could not find quiz code input');
    }
  } catch (err) {
    console.warn(`  ⚠️  Quiz join warning: ${err.message}`);
  } finally {
    await page.close();
  }
}

// ─── SCENARIO 3: API Health During Load ──────────────────────────────────────
async function captureAPIHealth(browser) {
  console.log('\n🟡 Scenario 3: API Health Check During Load');
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  try {
    // Navigate to the API health endpoint
    await page.goto(`${API_URL}/api/auth/me`, { waitUntil: 'networkidle' });
    await captureWithLabel(page, '07_api_health_check', 'API Response During Load');

    // Now show the network tab by opening DevTools (Chromium specific)
    // We'll capture the app home page with network waterfall visible
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await captureWithLabel(page, '08_app_home_during_load', 'App Home Page During Load Test');
  } catch (err) {
    console.warn(`  ⚠️  API health warning: ${err.message}`);
  } finally {
    await page.close();
  }
}

// ─── SCENARIO 4: Simulate 5 Concurrent Users (Tabs) ─────────────────────────
async function captureConcurrentUsers(browser) {
  console.log('\n🔴 Scenario 4: Concurrent Users Simulation (5 tabs)');
  const pages = [];
  const CONCURRENT = 5;

  try {
    // Open 5 pages simultaneously to simulate load
    for (let i = 1; i <= CONCURRENT; i++) {
      const p = await browser.newPage();
      await p.setViewportSize({ width: 1280, height: 800 });
      pages.push(p);
    }

    // All pages navigate at the same time
    console.log(`  Opening ${CONCURRENT} simultaneous browser tabs...`);
    await Promise.all(pages.map((p, i) =>
      p.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' })
        .catch(e => console.warn(`  Tab ${i+1} warning: ${e.message}`))
    ));
    await pages[0].waitForTimeout(1500);

    // Screenshot each tab
    for (let i = 0; i < pages.length; i++) {
      await captureWithLabel(pages[i], `09_concurrent_user_${i+1}`, `Concurrent User Tab ${i+1}`);
    }

    // Screenshot a tiled view (first tab capturing all visible)
    console.log('  📸 Capturing composite view...');
    await pages[0].evaluate(() => { document.body.style.zoom = '0.6'; });
    await captureWithLabel(pages[0], '10_concurrent_load_overview', 'Concurrent Load Overview');

  } catch (err) {
    console.warn(`  ⚠️  Concurrent scenario warning: ${err.message}`);
  } finally {
    for (const p of pages) {
      await p.close().catch(() => {});
    }
  }
}

// ─── SCENARIO 5: Mobile View (Responsive Load) ───────────────────────────────
async function captureMobileView(browser) {
  console.log('\n📱 Scenario 5: Mobile/Responsive View During Load');
  const page = await browser.newPage();
  // Simulate a mobile device
  await page.setViewportSize({ width: 390, height: 844 });

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await captureWithLabel(page, '11_mobile_view_home', 'Mobile View - Home Page');

    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await captureWithLabel(page, '12_mobile_view_login', 'Mobile View - Login Page');
  } catch (err) {
    console.warn(`  ⚠️  Mobile view warning: ${err.message}`);
  } finally {
    await page.close();
  }
}

// ─── SCENARIO 6: Leaderboard / Results Page ───────────────────────────────────
async function captureLeaderboard(browser) {
  console.log('\n🏆 Scenario 6: Leaderboard Page');
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  try {
    await page.goto(`${BASE_URL}/leaderboard`, { waitUntil: 'networkidle' });
    await captureWithLabel(page, '13_leaderboard_page', 'Leaderboard Page');
  } catch (err) {
    console.warn(`  ⚠️  Leaderboard warning: ${err.message}`);
  } finally {
    await page.close();
  }
}

// ─── SCENARIO 7: Performance Timeline Screenshot ──────────────────────────────
async function capturePerformanceMetrics(browser) {
  console.log('\n📊 Scenario 7: Performance Metrics (Browser Timing)');
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Inject a performance overlay into the page
    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
        loadComplete:     Math.round(nav.loadEventEnd - nav.startTime),
        ttfb:             Math.round(nav.responseStart - nav.startTime),
        domInteractive:   Math.round(nav.domInteractive - nav.startTime),
        transferSize:     nav.transferSize,
        url:              window.location.href,
        timestamp:        new Date().toISOString()
      };
    });

    // Inject overlay div showing performance data
    await page.evaluate((m) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed; top: 10px; right: 10px; z-index: 99999;
        background: rgba(0,0,0,0.85); color: #00ff88; font-family: monospace;
        font-size: 13px; padding: 16px; border-radius: 8px;
        border: 1px solid #00ff88; min-width: 280px; box-shadow: 0 4px 20px rgba(0,255,136,0.3);
      `;
      overlay.innerHTML = `
        <div style="color:#fff;font-weight:bold;margin-bottom:8px;font-size:14px">
          ⚡ Load Test Performance Metrics
        </div>
        <div>🕒 TTFB: <b>${m.ttfb}ms</b></div>
        <div>🏗️  DOM Interactive: <b>${m.domInteractive}ms</b></div>
        <div>📄 DOM Content Loaded: <b>${m.domContentLoaded}ms</b></div>
        <div>✅ Page Load Complete: <b>${m.loadComplete}ms</b></div>
        <div>📦 Transfer Size: <b>${(m.transferSize/1024).toFixed(1)} KB</b></div>
        <div style="margin-top:8px;color:#aaa;font-size:11px">🔗 ${m.url}</div>
        <div style="color:#aaa;font-size:11px">🕰  ${m.timestamp}</div>
      `;
      document.body.appendChild(overlay);
    }, metrics);

    await page.waitForTimeout(500);
    await captureWithLabel(page, '14_performance_metrics_overlay', 'Performance Metrics Overlay');

    console.log('\n  📊 Captured Performance Data:');
    console.log(`     TTFB:               ${metrics.ttfb}ms`);
    console.log(`     DOM Interactive:    ${metrics.domInteractive}ms`);
    console.log(`     DOM Content Loaded: ${metrics.domContentLoaded}ms`);
    console.log(`     Page Load Complete: ${metrics.loadComplete}ms`);

  } catch (err) {
    console.warn(`  ⚠️  Performance metrics warning: ${err.message}`);
  } finally {
    await page.close();
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  📸 Kahoot Load Test - Screenshot Capture Session');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  App URL:        ${BASE_URL}`);
  console.log(`  Screenshots to: ${SCREENSHOT_DIR}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const browser = await chromium.launch({
    headless: false,     // Visible browser so you can see it happening
    slowMo: 300,         // Slow down actions for better visibility
    args: ['--start-maximized']
  });

  try {
    await captureStudentLogin(browser);
    await captureQuizJoin(browser);
    await captureAPIHealth(browser);
    await captureConcurrentUsers(browser);
    await captureMobileView(browser);
    await captureLeaderboard(browser);
    await capturePerformanceMetrics(browser);

    // List all captured screenshots
    const files = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png'));
    console.log(`\n✅ Done! ${files.length} screenshots saved to: ${SCREENSHOT_DIR}`);
    console.log('\n📁 Screenshots:');
    files.forEach(f => console.log(`   • ${f}`));

  } catch (err) {
    console.error('\n❌ Fatal error:', err);
  } finally {
    await browser.close();
  }
}

main();
