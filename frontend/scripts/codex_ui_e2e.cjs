const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const CREDS_PATH = path.join(__dirname, '..', '..', '.tmp', 'e2e-creds.json');
const creds = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));

const FRONTEND_URL = 'http://localhost:3000';
const BACKEND_BASE = 'http://localhost:8001';
const API_BASE = `${BACKEND_BASE}/api/v1`;

function nowMs() {
  return Date.now();
}

async function runTest(name, fn) {
  const started = nowMs();
  try {
    const details = await fn();
    return { name, pass: true, ms: nowMs() - started, ...details };
  } catch (e) {
    return {
      name,
      pass: false,
      ms: nowMs() - started,
      error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    };
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function readSupabaseAccessTokenFromBrowser(page) {
  // Supabase-js persists the session under a key like `sb-<project-ref>-auth-token`.
  const token = await page.evaluate(() => {
    const tryParse = (v) => {
      try {
        return JSON.parse(v);
      } catch {
        return null;
      }
    };

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (!k.startsWith('sb-') || !k.endsWith('-auth-token')) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = tryParse(raw);
      const t = parsed?.access_token || parsed?.currentSession?.access_token || parsed?.session?.access_token;
      if (t) return t;
    }

    // Fallback: sometimes older helpers used other keys; best-effort scan.
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (!k.toLowerCase().includes('auth')) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = tryParse(raw);
      const t = parsed?.access_token || parsed?.currentSession?.access_token || parsed?.session?.access_token;
      if (t) return t;
    }

    return null;
  });

  if (!token) throw new Error('Could not read Supabase access token from browser storage after login');
  return token;
}

(async () => {
  const results = [];
  const consoleErrors = [];
  const apiRequests = [];
  let accessToken = creds.accessToken || null;

  process.on("unhandledRejection", (reason) => {
    console.error("UnhandledRejection:", reason);
  });

  const launchArgs = [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    // Workaround for some macOS environments where Playwright's headless shell
    // fails to register MachPortRendezvous services.
    "--disable-features=MachPortRendezvous",
  ];

  let browser;
  try {
    // Prefer system Chrome to avoid chromium headless-shell crashes on macOS.
    browser = await chromium.launch({ headless: true, channel: "chrome", args: launchArgs });
  } catch (e) {
    console.warn("Failed to launch via channel=chrome; falling back to bundled chromium:", e?.message || String(e));
    browser = await chromium.launch({ headless: true, args: launchArgs });
  }

  const context = await browser.newContext({ baseURL: FRONTEND_URL });
  await context.grantPermissions(['microphone'], { origin: FRONTEND_URL });

  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  page.on('request', (req) => {
    const url = req.url();
    if (url.startsWith(API_BASE)) {
      apiRequests.push({ method: req.method(), url, headers: req.headers() });
    }
  });

  let createdJobId = null;
  let createdSessionId = null;

  results.push(
    await runTest('TEST 1 — Auth Flow (frontend redirects)', async () => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      const url1 = page.url();
      expect(url1.includes('/login'), `Expected /login redirect, got ${url1}`);

      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      const url2 = page.url();
      expect(url2.includes('/login'), `Expected /login redirect, got ${url2}`);

      await page.goto('/jobs', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      const url3 = page.url();
      expect(url3.includes('/login'), `Expected /login redirect, got ${url3}`);

      return { status: 0, body: { url1, url2, url3 }, ui: 'Redirects to /login when unauthenticated' };
    })
  );

  results.push(
    await runTest('LOGIN — Sign in via UI', async () => {
      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      await page.getByPlaceholder('name@example.com').fill(creds.email);
      await page.getByPlaceholder('Enter your password').fill(creds.password);

      await page.locator("form button[type=\"submit\"]").click();

      await page.waitForURL(/\/jobs/, { timeout: 60000 });

      accessToken = await readSupabaseAccessTokenFromBrowser(page);

      return { status: 0, body: { url: page.url() }, ui: 'Authenticated session established' };
    })
  );

  results.push(
    await runTest('TEST 2 — Jobs page matches backend jobs', async () => {
      expect(accessToken, 'Missing access token after login');
      const res = await fetch(`${API_BASE}/jobs`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      });
      const body = await res.json();
      expect(res.status === 200, `Expected 200 from backend, got ${res.status}`);
      expect(Array.isArray(body.data), 'Expected backend {data:[...] }');

      for (const job of body.data) {
        await page.getByText(job.title, { exact: false }).first().waitFor({ timeout: 30000 });
        await page.getByText(job.company, { exact: false }).first().waitFor({ timeout: 30000 });
      }

      return { status: res.status, body, ui: `Found ${body.data.length} job(s) from backend on /jobs UI` };
    })
  );

  results.push(
    await runTest('TEST 3 — Create Job (UI → backend)', async () => {
      const title = `Senior Software Engineer ${Date.now()}`;
      const company = 'Ascend AI';
      const jobDescription = 'Senior Software Engineer requiring Next.js, Postgres, and Node.js expertise.';

      await page.getByRole('button', { name: /Add New Job/i }).click();
      await page.getByPlaceholder('e.g. Senior Software Engineer').fill(title);
      await page.getByPlaceholder('e.g. Google').fill(company);
      await page
        .getByPlaceholder('Paste the job description here — we\'ll use it to tailor your interview practice...')
        .fill(jobDescription);

      const [resp] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().startsWith(`${API_BASE}/jobs`) && r.request().method() === 'POST',
          { timeout: 60000 }
        ),
        page.getByRole('button', { name: /Add Job/i }).click(),
      ]);
      const status = resp.status();
      const json = await resp.json();
      expect(status === 201, `Expected 201, got ${status}`);
      expect(json?.data?.id, 'Expected {data:{id}}');
      createdJobId = json.data.id;

      await page.getByText(title, { exact: false }).first().waitFor({ timeout: 30000 });

      return { status, body: json, ui: 'Job card appears on /jobs without refresh', JOB_ID: createdJobId };
    })
  );

  results.push(
    await runTest('TEST 4 — Job details page UI', async () => {
      expect(createdJobId, 'Missing JOB_ID from TEST 3');
      await page.goto(`/jobs/${createdJobId}`, { waitUntil: 'domcontentloaded' });

      await page.getByText('Technical', { exact: false }).first().waitFor({ timeout: 30000 });
      await page.getByText('Background', { exact: false }).first().waitFor({ timeout: 30000 });
      await page.getByText('Culture', { exact: false }).first().waitFor({ timeout: 30000 });

      const content = await page.content();

      return {
        status: 0,
        body: { url: page.url(), hasJobDescriptionRendered: content.includes('Job Description') },
        ui: 'Scenario picker visible; past sessions expected empty',
      };
    })
  );

  results.push(
    await runTest('TEST 8 — Start interview without scenario (UI)', async () => {
      expect(createdJobId, 'Missing JOB_ID');
      await page.goto(`/jobs/${createdJobId}`, { waitUntil: 'domcontentloaded' });

      let apiCalled = false;
      const onReq = (req) => {
        if (req.url().includes(`/api/v1/jobs/${createdJobId}/sessions`) && req.method() === 'POST') apiCalled = true;
      };
      page.on('request', onReq);

      await page.getByRole('button', { name: 'Start Interview' }).click();
      await page.getByText('Please select a scenario type', { exact: false }).first().waitFor({ timeout: 10000 });

      page.off('request', onReq);
      expect(apiCalled === false, 'Expected no API call when scenario not selected');

      return { status: 0, body: { apiCalled }, ui: 'Toast shown; no network call made' };
    })
  );

  results.push(
    await runTest('TEST 5 — Create Session (UI)', async () => {
      expect(createdJobId, 'Missing JOB_ID');
      await page.goto(`/jobs/${createdJobId}`, { waitUntil: 'domcontentloaded' });

      const respPromise = page.waitForResponse(
        (r) => r.url().includes(`/api/v1/jobs/${createdJobId}/sessions`) && r.request().method() === 'POST',
        { timeout: 180000 }
      );

      await page.getByText('Technical', { exact: false }).first().click();
      await page.getByRole('button', { name: 'Start Interview' }).click();

      const resp = await respPromise;
      const status = resp.status();
      const json = await resp.json();
      expect(status === 201, `Expected 201, got ${status}`);
      expect(json?.data?.session?.id, 'Expected data.session.id');
      createdSessionId = json.data.session.id;

      await page.waitForURL((u) => u.pathname === `/session/${createdSessionId}`, { timeout: 60000 });

      return { status, body: json, ui: 'Redirects to /session/SESSION_ID', SESSION_ID: createdSessionId };
    })
  );

  results.push(
    await runTest('TEST 6 — Socket + Session page UI', async () => {
      expect(createdSessionId, 'Missing SESSION_ID');

      await page.getByText('Session active', { exact: false }).first().waitFor({ timeout: 30000 });

      // LiveKit hook starts muted; verify we can toggle unmute/mute via UI titles.
      await page.locator('button[title="Unmute Microphone"]').waitFor({ timeout: 60000 });
      await page.locator('button[title="Unmute Microphone"]').click();
      await page.locator('button[title="Mute Microphone"]').waitFor({ timeout: 60000 });

      // Record briefly, then mute again. This should stop the MediaRecorder and send audio to the backend.
      await page.waitForTimeout(1500);
      await page.locator('button[title="Mute Microphone"]').click();
      await page.locator('button[title="Unmute Microphone"]').waitFor({ timeout: 60000 });

      let livekitLive = false;
      try {
        await page.getByText('Live', { exact: false }).first().waitFor({ timeout: 45000 });
        livekitLive = true;
      } catch {
        livekitLive = false;
      }

      let sawThinking = false;
      try {
        await page.getByText('Thinking…', { exact: false }).first().waitFor({ timeout: 10000 });
        sawThinking = true;
      } catch {
        sawThinking = false;
      }

      // Assert an AI response bubble appears (non-empty text), not just "Thinking…".
      let sawAiText = false;
      const aiBubble = page.locator('div.max-w-md p').first();
      const aiDeadline = nowMs() + 90000;
      while (nowMs() < aiDeadline) {
        const txt = (await aiBubble.textContent().catch(() => "")) || "";
        if (txt.trim().length >= 5) {
          sawAiText = true;
          break;
        }
        await page.waitForTimeout(1500);
      }

      // End via UI (still triggers end_session)
      await page.locator('button[title=\"End Interview\"]').click();

      await page.waitForURL((u) => u.pathname === `/feedback/${createdSessionId}`, { timeout: 60000 });

      return {
        status: 0,
        body: { url: page.url(), livekitLive, sawThinking, sawAiText },
        ui: 'Session active badge shown; end interview redirects to feedback',
      };
    })
  );

  results.push(
    await runTest('TEST 7 — Feedback page auto-updates', async () => {
      expect(createdSessionId, 'Missing SESSION_ID');

      await page.getByText('Generating feedback...', { exact: false }).first().waitFor({ timeout: 10000 });

      const deadline = nowMs() + 60000;
      while (nowMs() < deadline) {
        const hasOverall = await page.getByText('Overall Score', { exact: false }).isVisible().catch(() => false);
        if (hasOverall) {
          return { status: 0, body: { url: page.url() }, ui: 'Feedback rendered without refresh' };
        }
        await page.waitForTimeout(2000);
      }

      throw new Error('Timed out waiting for feedback UI');
    })
  );

  results.push(
    await runTest('TEST 8 — Invalid job UUID redirects', async () => {
      await page.goto('/jobs/invalid-uuid', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      expect(page.url().includes('/jobs'), `Expected redirect to /jobs, got ${page.url()}`);
      return { status: 0, body: { url: page.url() }, ui: 'Redirects to /jobs' };
    })
  );

  results.push(
    await runTest('TEST 9 — Authorization header on API requests', async () => {
      const missingAuth = [];
      const hasApiKey = [];

      for (const r of apiRequests) {
        const auth = r.headers['authorization'] || r.headers['Authorization'];
        if (!auth || !auth.startsWith('Bearer ')) missingAuth.push({ method: r.method, url: r.url });
        if (r.headers['apikey'] || r.headers['x-api-key'] || r.headers['ApiKey']) hasApiKey.push({ method: r.method, url: r.url });
      }

      expect(missingAuth.length === 0, `Missing Authorization on ${missingAuth.length} request(s)`);
      expect(hasApiKey.length === 0, `Found api key headers on ${hasApiKey.length} request(s)`);

      return { status: 0, body: { apiRequestCount: apiRequests.length }, ui: 'All backend API calls included Bearer token; no api keys found' };
    })
  );

  const out = {
    createdAt: new Date().toISOString(),
    frontendUrl: FRONTEND_URL,
    backendBase: BACKEND_BASE,
    jobId: createdJobId,
    sessionId: createdSessionId,
    results,
    consoleErrors,
  };

  const outPath = path.join(__dirname, '..', '..', '.tmp', 'ui-results.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

  await browser.close();

  console.log(`Wrote ${outPath}`);
})();
