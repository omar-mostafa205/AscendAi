const path = require("node:path")
const { setTimeout: delay } = require("node:timers/promises")

const dotenv = require("dotenv")

if (process.env.E2E_ENV_PATH) {
  dotenv.config({ path: process.env.E2E_ENV_PATH })
} else {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "..", ".env"), // backend/.env
    path.resolve(__dirname, "..", "..", ".env"),
  ]
  for (const p of candidates) {
    try {
      dotenv.config({ path: p })
      if (process.env.NODE_ENV || process.env.SUPABASE_URL) break
    } catch {
      // ignore
    }
  }
}

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:8001"
let TOKEN = process.env.E2E_SUPABASE_JWT || process.env.SUPABASE_JWT || process.env.E2E_TOKEN || ""

function nowMs() {
  return Date.now()
}

async function httpJson(method, pathName, opts) {
  const url = new URL(pathName, BASE_URL)
  const headers = { Accept: "application/json" }
  if (opts && opts.token) headers.Authorization = `Bearer ${opts.token}`

  let body
  if (opts && Object.prototype.hasOwnProperty.call(opts, "body")) {
    headers["Content-Type"] = "application/json"
    body = JSON.stringify(opts.body)
  }

  const res = await fetch(url, { method, headers, body })
  const text = await res.text()
  let parsed = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = text
  }
  return { status: res.status, body: parsed }
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasKeys(obj, keys) {
  if (!isObject(obj)) return false
  return keys.every((k) => k in obj)
}

function toErr(e) {
  if (e instanceof Error) return `${e.name}: ${e.message}`
  return String(e)
}

async function runTest(name, fn) {
  const start = nowMs()
  try {
    const partial = await fn()
    return { name, ms: nowMs() - start, ...partial }
  } catch (e) {
    return { name, pass: false, ms: nowMs() - start, error: toErr(e) }
  }
}

function printReport(results) {
  for (const r of results) {
    const status = r.skipped ? "SKIP" : r.pass ? "PASS" : "FAIL"
    console.log(`[${status}] ${r.name} (${r.ms}ms)`)
    if (r.status !== undefined) console.log(`  status: ${r.status}`)
    if (r.body !== undefined) console.log(`  body: ${JSON.stringify(r.body)}`)
    if (r.error) console.log(`  error: ${r.error}`)
  }
}

// Small, valid WAV (mono 8kHz, ~0.1s silence). Used to keep Deepgram STT happy.
const SILENCE_WAV_BASE64 =
  "UklGRjQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"

async function main() {
  const results = []

  if (!TOKEN && process.env.E2E_EMAIL && process.env.E2E_PASSWORD) {
    try {
      const { createClient } = require("@supabase/supabase-js")

      const supabaseUrl = process.env.SUPABASE_URL
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!supabaseUrl || !anonKey) throw new Error("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")

      const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
      const { data, error } = await userClient.auth.signInWithPassword({
        email: process.env.E2E_EMAIL,
        password: process.env.E2E_PASSWORD,
      })

      if (error && process.env.E2E_CREATE_USER === "1") {
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!serviceKey) throw error

        const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
        await adminClient.auth.admin.createUser({
          email: process.env.E2E_EMAIL,
          password: process.env.E2E_PASSWORD,
          email_confirm: true,
        })

        const retry = await userClient.auth.signInWithPassword({
          email: process.env.E2E_EMAIL,
          password: process.env.E2E_PASSWORD,
        })
        if (retry.error) throw retry.error
        TOKEN = retry.data.session && retry.data.session.access_token ? retry.data.session.access_token : ""
      } else if (!error) {
        TOKEN = data.session && data.session.access_token ? data.session.access_token : ""
      } else {
        throw error
      }
    } catch (e) {
      console.error(`Failed to obtain Supabase JWT automatically: ${toErr(e)}`)
    }
  }

  let JOB_ID = ""
  let SESSION_ID = ""

  // TEST 1 — Health Check
  results.push(
    await runTest("TEST 1 — Health Check", async () => {
      const { status, body } = await httpJson("GET", "/health")
      const ok = status === 200 && isObject(body) && body.status === "healthy" && typeof body.timestamp === "string"
      return { pass: ok, status, body }
    })
  )

  if (!TOKEN) {
    results.push(
      await runTest("TEST 2 — Create Job", async () => ({
        pass: false,
        skipped: true,
        status: 0,
        body: null,
        error: "Missing Supabase JWT (set E2E_SUPABASE_JWT or SUPABASE_JWT)",
      }))
    )
    results.push(
      await runTest("TEST 3 — Get Jobs", async () => ({
        pass: false,
        skipped: true,
        status: 0,
        body: null,
        error: "Missing Supabase JWT (set E2E_SUPABASE_JWT or SUPABASE_JWT)",
      }))
    )
    results.push(
      await runTest("TEST 4 — Get Job By ID", async () => ({
        pass: false,
        skipped: true,
        status: 0,
        body: null,
        error: "Missing Supabase JWT (set E2E_SUPABASE_JWT or SUPABASE_JWT)",
      }))
    )
    results.push(
      await runTest("TEST 5 — Create Session", async () => ({
        pass: false,
        skipped: true,
        status: 0,
        body: null,
        error: "Missing Supabase JWT (set E2E_SUPABASE_JWT or SUPABASE_JWT)",
      }))
    )
    results.push(
      await runTest("TEST 6 — Get Sessions", async () => ({
        pass: false,
        skipped: true,
        status: 0,
        body: null,
        error: "Missing Supabase JWT (set E2E_SUPABASE_JWT or SUPABASE_JWT)",
      }))
    )
    results.push(
      await runTest("TEST 7 — Socket.io Interview Flow", async () => ({
        pass: false,
        skipped: true,
        status: 0,
        body: null,
        error: "Missing Supabase JWT (set E2E_SUPABASE_JWT or SUPABASE_JWT)",
      }))
    )
    results.push(
      await runTest("TEST 8 — Feedback Job Completion", async () => ({
        pass: false,
        skipped: true,
        status: 0,
        body: null,
        error: "Missing Supabase JWT (set E2E_SUPABASE_JWT or SUPABASE_JWT)",
      }))
    )
    results.push(
      await runTest("TEST 9 — Unauthorized Access", async () => ({
        pass: false,
        skipped: true,
        status: 0,
        body: null,
        error: "Missing Supabase JWT (set E2E_SUPABASE_JWT or SUPABASE_JWT)",
      }))
    )
    results.push(
      await runTest("TEST 10 — Not Found", async () => ({
        pass: false,
        skipped: true,
        status: 0,
        body: null,
        error: "Missing Supabase JWT (set E2E_SUPABASE_JWT or SUPABASE_JWT)",
      }))
    )

    printReport(results)
    process.exit(2)
  }

  // TEST 2 — Create Job
  results.push(
    await runTest("TEST 2 — Create Job", async () => {
      const payload = {
        title: "Senior Software Engineer",
        company: "Stripe",
        jobDescription:
          "We are looking for a senior software engineer with 5+ years of experience in distributed systems, TypeScript, and React. The ideal candidate has experience with payment systems and high-scale infrastructure.",
      }
      const { status, body } = await httpJson("POST", "/api/v1/jobs", { token: TOKEN, body: payload })
      const ok =
        status === 201 && isObject(body) && hasKeys(body.data, ["id", "title", "company", "jobDescription", "createdAt"])
      if (ok) JOB_ID = body.data.id
      return { pass: ok, status, body }
    })
  )

  // TEST 3 — Get Jobs
  results.push(
    await runTest("TEST 3 — Get Jobs", async () => {
      const { status, body } = await httpJson("GET", "/api/v1/jobs", { token: TOKEN })
      const ok =
        status === 200 &&
        isObject(body) &&
        Array.isArray(body.data) &&
        (!JOB_ID || body.data.some((j) => j && j.id === JOB_ID))
      return { pass: ok, status, body }
    })
  )

  // TEST 4 — Get Job By ID
  results.push(
    await runTest("TEST 4 — Get Job By ID", async () => {
      if (!JOB_ID) return { pass: false, status: 0, body: null, error: "Missing JOB_ID from TEST 2" }
      const { status, body } = await httpJson("GET", `/api/v1/jobs/${JOB_ID}`, { token: TOKEN })
      const ok = status === 200 && isObject(body) && isObject(body.data) && body.data.id === JOB_ID
      return { pass: ok, status, body }
    })
  )

  // TEST 5 — Create Session
  results.push(
    await runTest("TEST 5 — Create Session", async () => {
      if (!JOB_ID) return { pass: false, status: 0, body: null, error: "Missing JOB_ID from TEST 2" }
      const { status, body } = await httpJson("POST", `/api/v1/jobs/${JOB_ID}/sessions`, {
        token: TOKEN,
        body: { scenarioType: "technical" },
      })
      const ok =
        status === 201 &&
        isObject(body) &&
        isObject(body.data) &&
        isObject(body.data.session) &&
        typeof body.data.session.id === "string"
      if (ok) SESSION_ID = body.data.session.id
      return { pass: ok, status, body }
    })
  )

  // TEST 6 — Get Sessions
  results.push(
    await runTest("TEST 6 — Get Sessions", async () => {
      if (!JOB_ID) return { pass: false, status: 0, body: null, error: "Missing JOB_ID from TEST 2" }
      const { status, body } = await httpJson("GET", `/api/v1/jobs/${JOB_ID}/sessions`, { token: TOKEN })
      const ok =
        status === 200 &&
        isObject(body) &&
        Array.isArray(body.data) &&
        (!SESSION_ID || body.data.some((s) => s && s.id === SESSION_ID))
      return { pass: ok, status, body }
    })
  )

  // TEST 7 — Socket.io Connection + Interview Flow
  results.push(
    await runTest("TEST 7 — Socket.io Interview Flow", async () => {
      if (!SESSION_ID) return { pass: false, status: 0, body: null, error: "Missing SESSION_ID from TEST 5" }

      if (process.env.E2E_SKIP_SOCKET === "1") {
        return { pass: false, skipped: true, status: 0, body: null, error: "E2E_SKIP_SOCKET=1" }
      }

      let ioClient
      try {
        ioClient = require("socket.io-client")
      } catch (e) {
        return {
          pass: false,
          skipped: true,
          status: 0,
          body: null,
          error: `socket.io-client not installed: ${toErr(e)} (run: npm i -D socket.io-client)`,
        }
      }

      const { io } = ioClient
      const socket = io(BASE_URL, {
        transports: ["websocket"],
        auth: { token: TOKEN },
        timeout: 10000,
      })

      const waitFor = (event, timeoutMs) =>
        new Promise((resolve, reject) => {
          const t = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeoutMs)
          socket.once(event, (payload) => {
            clearTimeout(t)
            resolve(payload)
          })
        })

      const onErr = (payload) => {
        console.error("socket error:", payload)
      }
      socket.on("error", onErr)

      await waitFor("connect", 15000)

      socket.emit("join_session", { sessionId: SESSION_ID })
      await waitFor("session_joined", 15000)

      // Live interview audio is now handled directly by Gemini Live from the browser.
      // We only verify that the socket join/end plumbing still works.
      socket.emit("live_message", {
        sessionId: SESSION_ID,
        role: "user",
        content: "Hello! This is an automated E2E message.",
      })

      socket.emit("end_session", { sessionId: SESSION_ID })
      const ended = await waitFor("session_ended", 20000)

      socket.off("error", onErr)
      socket.disconnect()

      const ok = ended && ended.sessionId === SESSION_ID
      return { pass: ok, status: 0, body: { ended } }
    })
  )

  // TEST 8 — Verify Feedback Job (poll up to 90s)
  results.push(
    await runTest("TEST 8 — Feedback Job Completion", async () => {
      if (!JOB_ID || !SESSION_ID) return { pass: false, status: 0, body: null, error: "Missing JOB_ID or SESSION_ID" }

      if (process.env.E2E_SKIP_FEEDBACK === "1") {
        return { pass: false, skipped: true, status: 0, body: null, error: "Feedback verification skipped" }
      }

      await delay(30000)

      const deadline = nowMs() + 90000
      while (nowMs() < deadline) {
        const { status, body } = await httpJson("GET", `/api/v1/jobs/${JOB_ID}/sessions`, { token: TOKEN })
        if (status !== 200 || !isObject(body) || !Array.isArray(body.data)) return { pass: false, status, body }

        const sess = body.data.find((s) => s && s.id === SESSION_ID)
        if (sess && sess.status === "completed" && typeof sess.overallScore === "number" && isObject(sess.feedback)) {
          return { pass: true, status, body: { session: sess } }
        }
        await delay(5000)
      }

      const { status, body } = await httpJson("GET", `/api/v1/jobs/${JOB_ID}/sessions`, { token: TOKEN })
      return { pass: false, status, body, error: "Timed out waiting for completed feedback" }
    })
  )

  // TEST 9 — Unauthorized Access
  results.push(
    await runTest("TEST 9 — Unauthorized Access", async () => {
      const a = await httpJson("GET", "/api/v1/jobs")
      const b = await httpJson("POST", `/api/v1/jobs/${JOB_ID || "00000000-0000-0000-0000-000000000000"}/sessions`, {
        token: "invalid_token",
        body: { scenarioType: "technical" },
      })
      const ok =
        a.status === 401 &&
        isObject(a.body) &&
        a.body.error === "Unauthorized" &&
        b.status === 401 &&
        isObject(b.body) &&
        b.body.error === "Unauthorized"
      return { pass: ok, status: 0, body: { getJobs: a, createSession: b } }
    })
  )

  // TEST 10 — Not Found
  results.push(
    await runTest("TEST 10 — Not Found", async () => {
      const { status, body } = await httpJson("GET", "/api/v1/jobs/non-existent-uuid/sessions", { token: TOKEN })
      const ok = status === 404 && isObject(body) && body.error === "Job not found"
      return { pass: ok, status, body }
    })
  )

  printReport(results)
  const failed = results.some((r) => !r.pass && !r.skipped)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
