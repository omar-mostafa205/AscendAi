const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { io } = require('socket.io-client');

const CREDS_PATH = path.join(__dirname, 'e2e-creds.json');
const creds = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));

const BASE_URL = 'http://localhost:8001';
const TOKEN = creds.accessToken;

const SILENCE_WAV_BASE64 =
  'UklGRjQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function nowMs() {
  return Date.now();
}

function redact(obj) {
  if (obj === null || obj === undefined) return obj;
  if (!TOKEN) return obj;
  const s = JSON.stringify(obj);
  try {
    return JSON.parse(s.replaceAll(TOKEN, '[REDACTED_TOKEN]'));
  } catch {
    return obj;
  }
}

async function httpJson(method, pathname, { token, body, timeoutMs } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs ?? 20000);

  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const started = nowMs();
  try {
    const res = await fetch(`${BASE_URL}${pathname}`, {
      method,
      headers,
      body: payload,
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    return { status: res.status, body: redact(parsed), ms: nowMs() - started };
  } finally {
    clearTimeout(t);
  }
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

(async () => {
  const results = [];
  let JOB_ID = null;
  let SESSION_ID = null;

  results.push(
    await runTest('TEST 2 — GET /api/v1/jobs (auth)', async () => {
      const r = await httpJson('GET', '/api/v1/jobs', { token: TOKEN });
      expect(r.status === 200, `Expected 200, got ${r.status}`);
      expect(r.body && Array.isArray(r.body.data), 'Expected { data: [...] }');
      return { status: r.status, body: r.body, timeTakenMs: r.ms };
    })
  );

  results.push(
    await runTest('TEST 3 — POST /api/v1/jobs (create)', async () => {
      const payload = {
        title: 'Senior Software Engineer',
        company: 'Stripe',
        jobDescription:
          'We are looking for a senior software engineer with 5+ years of experience in distributed systems, TypeScript, and React. The ideal candidate has experience with payment systems and high-scale infrastructure.',
      };
      const r = await httpJson('POST', '/api/v1/jobs', { token: TOKEN, body: payload, timeoutMs: 30000 });
      expect(r.status === 201, `Expected 201, got ${r.status}`);
      expect(r.body?.data?.id, 'Expected response.data.id');
      JOB_ID = r.body.data.id;
      return { status: r.status, body: r.body, JOB_ID, timeTakenMs: r.ms };
    })
  );

  results.push(
    await runTest('TEST 3b — GET /api/v1/jobs contains JOB_ID', async () => {
      expect(JOB_ID, 'Missing JOB_ID');
      const r = await httpJson('GET', '/api/v1/jobs', { token: TOKEN });
      expect(r.status === 200, `Expected 200, got ${r.status}`);
      expect(Array.isArray(r.body?.data), 'Expected data array');
      expect(r.body.data.some((j) => j?.id === JOB_ID), 'Created job not found in list');
      return { status: r.status, body: { count: r.body.data.length }, timeTakenMs: r.ms };
    })
  );

  results.push(
    await runTest('TEST 4 — GET /api/v1/jobs/JOB_ID', async () => {
      expect(JOB_ID, 'Missing JOB_ID');
      const r = await httpJson('GET', `/api/v1/jobs/${JOB_ID}`, { token: TOKEN });
      expect(r.status === 200, `Expected 200, got ${r.status}`);
      expect(r.body?.data?.id === JOB_ID, 'Expected matching job id');
      return { status: r.status, body: r.body, timeTakenMs: r.ms };
    })
  );

  results.push(
    await runTest('TEST 5 — POST /api/v1/jobs/JOB_ID/sessions', async () => {
      expect(JOB_ID, 'Missing JOB_ID');
      const r = await httpJson('POST', `/api/v1/jobs/${JOB_ID}/sessions`, {
        token: TOKEN,
        body: { scenarioType: 'technical' },
        timeoutMs: 120000,
      });
      expect(r.status === 201, `Expected 201, got ${r.status}`);
      expect(r.body?.data?.session?.id, 'Expected data.session.id');
      expect(typeof r.body?.data?.livekitToken === 'string', 'Expected livekitToken string');
      SESSION_ID = r.body.data.session.id;
      return { status: r.status, body: r.body, SESSION_ID, timeTakenMs: r.ms };
    })
  );

  results.push(
    await runTest('TEST 6 — Socket.io interview flow', async () => {
      expect(SESSION_ID, 'Missing SESSION_ID');

      const socket = io(BASE_URL, {
        transports: ['websocket'],
        auth: { token: TOKEN },
        timeout: 15000,
      });

      const eventLog = [];
      const waitFor = (event, timeoutMs) =>
        new Promise((resolve, reject) => {
          const t = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeoutMs);
          socket.once(event, (payload) => {
            clearTimeout(t);
            eventLog.push(event);
            resolve(payload);
          });
        });

      let tokenCount = 0;
      const onTok = () => {
        tokenCount += 1;
      };
      socket.on('ai_token', onTok);
      socket.on('ai_thinking', () => eventLog.push('ai_thinking'));

      await waitFor('connect', 20000);

      socket.emit('join_session', { sessionId: SESSION_ID });
      const joined = await waitFor('session_joined', 20000);

      socket.emit('user_answer', {
        sessionId: SESSION_ID,
        audioBuffer: Buffer.from(SILENCE_WAV_BASE64, 'base64'),
      });

      await waitFor('ai_thinking', 20000);
      const resp = await waitFor('ai_response', 90000);

      socket.emit('end_session', { sessionId: SESSION_ID });
      const ended = await waitFor('session_ended', 30000);

      socket.off('ai_token', onTok);
      socket.disconnect();

      const okOrder = eventLog.includes('session_joined') && eventLog.includes('ai_thinking') && eventLog.includes('session_ended');
      const okResp = resp && typeof resp.text === 'string' && resp.text.length > 0 && resp.audio !== undefined;

      expect(okOrder, `Missing expected events, got: ${eventLog.join(', ')}`);
      expect(tokenCount > 0, 'Expected ai_token streaming (>0 tokens)');
      expect(okResp, 'Expected ai_response with {text,audio}');

      return { status: 0, body: redact({ joined, tokenCount, aiTextLen: resp.text?.length ?? 0, ended, eventLog }) };
    })
  );

  results.push(
    await runTest('TEST 7 — Feedback completion (poll)', async () => {
      expect(JOB_ID && SESSION_ID, 'Missing JOB_ID/SESSION_ID');
      await delay(30000);

      const deadline = nowMs() + 120000;
      while (nowMs() < deadline) {
        const r = await httpJson('GET', `/api/v1/jobs/${JOB_ID}/sessions`, { token: TOKEN, timeoutMs: 20000 });
        expect(r.status === 200, `Expected 200, got ${r.status}`);
        const sess = r.body?.data?.find?.((s) => s?.id === SESSION_ID) ?? null;
        if (sess && sess.status === 'completed' && typeof sess.overallScore === 'number' && sess.feedback && typeof sess.feedback === 'object') {
          return { status: 200, body: { session: sess } };
        }
        await delay(5000);
      }

      const r = await httpJson('GET', `/api/v1/jobs/${JOB_ID}/sessions`, { token: TOKEN, timeoutMs: 20000 });
      return { status: r.status, body: r.body, note: 'Timed out waiting for status=completed' };
    })
  );

  results.push(
    await runTest('TEST 8 — GET /api/v1/jobs (no auth)', async () => {
      const r = await httpJson('GET', '/api/v1/jobs');
      expect(r.status === 401, `Expected 401, got ${r.status}`);
      expect(r.body?.error === 'Unauthorized', 'Expected {error:"Unauthorized"}');
      return { status: r.status, body: r.body, timeTakenMs: r.ms };
    })
  );

  const out = {
    createdAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    jobId: JOB_ID,
    sessionId: SESSION_ID,
    results,
  };

  fs.writeFileSync(path.join(__dirname, 'api-results.json'), JSON.stringify(out, null, 2));
  console.log('Wrote .tmp/api-results.json');
})();
