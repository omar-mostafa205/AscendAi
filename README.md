# AscendAI — Realtime Interview Practice

<img src="/frontend/public/README.png" alt="Screenshot" width="400"/>

AscendAI is a full‑stack app for practicing interview sessions with a realtime, voice‑based AI interviewer (STT + TTS) using Gemini Live. Sessions are saved to the database and a background worker generates structured feedback after the interview ends.

## Monorepo Layout

- `backend/` — Express API + Socket.IO + BullMQ worker (Prisma/Postgres)
- `frontend/` — Next.js App Router UI (React Query + Socket.IO client)

## Key Features

- **Jobs**: create and view jobs (title/company/description)
- **Practice sessions**: start technical/background/culture sessions per job
- **Realtime voice interview**:
  - mic audio → Gemini Live
  - AI audio streamed back and played in the browser
  - conversation persisted to `interview_sessions.messages` (JSON)
- **Feedback generation** (async):
  - session ends → status becomes `processing`
  - BullMQ worker generates JSON feedback (overall score + strengths/weaknesses/recommendations/summary)
  - status becomes `completed`

## Tech Stack

**Frontend**

- Next.js (App Router), React, TypeScript
- TanStack React Query
- Socket.IO client
- Web Audio API (AudioWorklet)
- Supabase Auth (client-side)

**Backend**

- Express, TypeScript
- Prisma (Postgres)
- Socket.IO server
- BullMQ + Redis (Upstash supported)
- Supabase Admin Auth verification
- Gemini (`@google/genai`)

## Architecture (High Level)

```mermaid
flowchart LR
  UI["Next.js Frontend"]
  API["Express API (/api/v1)"]
  WS["Socket.IO"]
  DB["Postgres (Prisma)"]
  REDIS["Redis (BullMQ)"]
  WORKER["session-analysis.worker"]
  GEM["Gemini Live WS and Gemini models"]

  UI -->|Bearer token| API
  UI -->|join_session/save_message/end_session| WS
  API --> DB
  WS --> DB
  API -->|enqueue analyze_session| REDIS
  REDIS --> WORKER
  WORKER -->|read messages, write feedback| DB
  UI -->|Gemini Live WebSocket ephemeral token| GEM
  API -->|/sessions/:id/live-token| UI
```

## Interview Session Sequence (End-to-End)

This is the most important runtime flow for the app.

```mermaid
sequenceDiagram
  participant User
  participant UI as Next.js UI
  participant API as Express API
  participant WS as Socket.IO
  participant GEM as Gemini Live WS
  participant DB as Postgres
  participant REDIS as Redis/BullMQ
  participant WORKER as Feedback Worker

  User->>UI: Start interview
  UI->>API: POST /api/v1/jobs/:jobId/sessions
  API->>DB: create interview_sessions (status=in_progress) + persona
  API-->>UI: { data: { session: { id } } }

  UI->>WS: join_session { sessionId }
  WS-->>UI: session_joined { sessionId }

  UI->>API: GET /api/v1/sessions/:id/live-token
  API-->>UI: { data: { token, sessionId } }

  UI->>GEM: WebSocket connect + setup (first message)
  GEM-->>UI: setupComplete

  Note over UI,GEM: Realtime interview loop
  User->>UI: Speak
  UI->>GEM: realtimeInput.mediaChunks (PCM16)
  UI->>GEM: realtimeInput.activityStart / activityEnd (VAD)
  GEM-->>UI: serverContent.modelTurn.parts (assistant audio)
  UI->>User: Play audio
  UI->>WS: save_message (user/assistant)
  WS->>DB: buffer + flush → interview_sessions.messages (JSON)

  User->>UI: End session
  UI->>WS: end_session { sessionId }
  WS->>DB: flush pending messages
  WS->>DB: update interview_sessions status=processing, endedAt=now
  WS->>REDIS: enqueue analyze_session
  WS-->>UI: session_ended

  WORKER->>REDIS: consume analyze_session
  WORKER->>DB: read interview_sessions.messages
  WORKER->>WORKER: call Gemini model for JSON feedback
  WORKER->>DB: write feedback + overallScore + status=completed
  UI->>API: GET /api/v1/sessions/:id (poll)
  API-->>UI: status=completed + feedback JSON
```

## Data Model (Important Bits)

Prisma schema lives at `backend/prisma/schema.prisma`. The main tables:

- `jobs`
- `personas` (generated interviewer persona per job+scenario)
- `interview_sessions`
  - `status`: `in_progress` → `processing` → `completed`
  - `messages` (JSON): array of `{ role: "user"|"assistant", content: string, createdAt: string }`
  - `feedback` (JSON): `{ overallScore, strengths[], weaknesses[], recommendations[], summary, ... }`

## API + Socket Contract

### REST API (Backend)

Base URL: `http://localhost:<PORT>/api/v1`

- `GET /jobs` — list jobs for current user
- `POST /jobs` — create a job
- `GET /jobs/:id` — job details
- `GET /jobs/:jobId/sessions` — list sessions for job
- `POST /jobs/:jobId/sessions` — create session (creates/reuses persona)
- `GET /sessions/:id` — session details including `status`, `overallScore`, `feedback`
- `POST /sessions/:id/end` — end session (sets `processing`, enqueues feedback job)
- `GET /sessions/:id/live-token` — returns `{ token, sessionId }` for Gemini Live WS

All routes require:

```http
Authorization: Bearer <supabase_access_token>
```

#### Request/Response Examples

##### Create a session

```http
POST /api/v1/jobs/<jobId>/sessions
Content-Type: application/json
Authorization: Bearer <token>

{ "scenarioType": "technical" }
```

Response:

```json
{
  "data": {
    "session": {
      "id": "uuid",
      "scenarioType": "technical",
      "status": "in_progress"
    }
  }
}
```

##### End a session

```http
POST /api/v1/sessions/<sessionId>/end
Authorization: Bearer <token>
```

Response:

```json
{ "data": { "id": "<sessionId>", "status": "processing" } }
```

##### Fetch session feedback/status

```http
GET /api/v1/sessions/<sessionId>
Authorization: Bearer <token>
```

Response (when complete):

```json
{
  "data": {
    "id": "uuid",
    "status": "completed",
    "overallScore": 75,
    "feedback": {
      "overallScore": 75,
      "strengths": ["Clear communication", "Good technical knowledge"],
      "weaknesses": ["Could improve on system design details"],
      "recommendations": ["Practice whiteboard coding exercises"],
      "summary": "Overall strong performance with room for improvement."
    }
  }
}
```

#### Error Codes (Common)

- `401 Unauthorized` — missing/invalid Supabase bearer token
- `404 Not found` — invalid UUID or resource not owned by user
- `400 Bad request` — invalid payload (e.g. scenarioType)
- `500 Internal Server Error` — unexpected backend error

### Socket.IO Events (Backend)

Namespace: default (`io`), room = `sessionId`

- Client → Server:
  - `join_session` `{ sessionId }`
  - `save_message` `{ sessionId, role, content }`
  - `end_session` `{ sessionId }`
  - `leave_session` `sessionId`
- Server → Client:
  - `session_joined` `{ sessionId }`
  - `session_ended` `{ sessionId }`

The backend buffers `save_message` events and periodically flushes them into `interview_sessions.messages` to avoid excessive DB writes.

## Low Latency Design (Interview Session)

Low latency is primarily achieved by preventing main-thread overload and WebSocket backpressure during streaming.

### Key choices

1. **AudioWorklet (not ScriptProcessorNode)**  
   ScriptProcessor is deprecated and runs on the main thread. AudioWorklet runs on the audio rendering thread, which is far more stable under UI load.
   - Worklet: `frontend/public/gemini-audio-processor.worklet.js`
   - Mic hook: `frontend/src/features/session/hooks/useGeminiMic.ts`

2. **Chunking mic audio to reduce WS send frequency**  
   Sending audio frames too frequently causes CPU overhead (base64 + JSON) and WS congestion, which shows up as "AI started responding" taking seconds.  
   We chunk at `CHUNK_SAMPLES = 640` @ 16kHz → ~40ms → ~25 sends/sec.

3. **VAD + explicit activityStart/activityEnd**  
   Fast and consistent turn-end signaling reduces "turn-taking latency" (model starts responding sooner).  
   `SILENCE_DURATION_MS` controls the safety vs speed tradeoff.

4. **Optimized PCM16 base64 encoding**  
   Base64 encoding is a hot path; chunked conversion reduces main-thread cost.
   - `frontend/src/features/session/services/audio.service.ts`

### Latency tuning knobs

- `CHUNK_SAMPLES` (worklet): smaller → lower latency, higher overhead; larger → higher latency, lower overhead
- `SILENCE_DURATION_MS` (worklet): lower → AI starts faster, but can cut off pauses; higher → safer, slower
- VAD thresholds (`SPEECH_ON_THRESHOLD`, `SPEECH_OFF_THRESHOLD`): affects when speech starts/stops

## Local Development

### Prerequisites

- Node.js 18+ (recommended: 20+)
- Postgres (or Supabase Postgres)
- Redis (Upstash or local Redis) for BullMQ
- Gemini API key

### 1) Configure Environment Variables

Create env files (examples below). Do **not** commit secrets.

#### Backend (`backend/.env`)

See `backend/src/config/env.ts` for the authoritative list.

Example:

```bash
NODE_ENV=development
PORT=8000
FRONTEND_URL=http://localhost:3000

SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

DATABASE_URL=postgresql://...
REDIS_URL=rediss://...

GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
GEMINI_LIVE_MODEL=gemini-2.5-flash-native-audio-preview-12-2025
GEMINI_API_VERSION=v1beta
SENTRY_DSN=
```

#### Frontend (`frontend/.env`)

Used by the Next.js client.

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_SOCKET_URL=http://localhost:8000

NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# If you use Google auth in Supabase:
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...
NEXT_PUBLIC_GOOGLE_CLIENT_SECERT=...
```

### 2) Install Dependencies

```bash
cd backend && npm i
cd ../frontend && npm i
```

### 3) Start Backend + Worker

The backend starts the BullMQ worker during bootstrap.

```bash
cd backend
npm run dev
```

Health check:

```bash
curl http://localhost:8000/health
```

### 4) Start Frontend

```bash
cd frontend
npm run dev
```

Open:

- `http://localhost:3000`

## Realtime Interview Session (How it Works)

### 1) Session creation

Frontend calls `POST /jobs/:jobId/sessions` → backend creates an `interview_sessions` row (`status=in_progress`) and ensures a persona exists.

### 2) Socket join + message persistence

Frontend joins the session room via `join_session`.

During the interview, the frontend emits `save_message` events. The backend:

- buffers them (in memory) and flushes to `interview_sessions.messages` (JSON)
- flushes again on `end_session` to ensure the full conversation is persisted

### 3) Gemini Live (voice)

Frontend requests an ephemeral token:

- `GET /api/v1/sessions/:id/live-token`

Then connects to Gemini Live via WebSocket and sends a `setup` message as the **first** message.

### 4) Low latency audio pipeline

Low latency comes from:

- **AudioWorklet** (instead of `ScriptProcessorNode`) so audio processing is off the main thread
- **chunking** mic audio to reduce WS send frequency
- **VAD** to send `activityStart` / `activityEnd` promptly for fast turn-taking
- optimized base64 conversion for PCM16

Key files:

- Audio worklet: `frontend/public/gemini-audio-processor.worklet.js`
- Mic streaming: `frontend/src/features/session/hooks/useGeminiMic.ts`
- Session WS + playback + transcripts: `frontend/src/features/session/hooks/useGeminiSession.ts`
- Encoding helpers: `frontend/src/features/session/services/audio.service.ts`

## Feedback Generation (Worker)

When a session ends:

- backend sets `status=processing`
- enqueues a BullMQ job `analyze_session` on the `session-analysis` queue

Worker file:

- `backend/src/queues/workers/session-analysis.worker.ts`

Worker logic:

- reads `interview_sessions.messages`
- builds a prompt using `backend/src/services/ai/prompts/feedback.prompt.ts`
- calls Gemini model with `responseMimeType: "application/json"`
- saves `feedback` + `overallScore`
- sets `status=completed`

Frontend updates:

- the job sessions page polls while any session is `processing`
- the feedback dialog polls `GET /sessions/:id` until `status=completed`

## Frontend Pages & Key Components

- Jobs list: `frontend/src/app/jobs/page.tsx`
- Job detail + sessions: `frontend/src/app/jobs/[id]/page.tsx`
  - sessions list/grid: `frontend/src/features/jobs/components/JobSessions/*`
  - feedback dialog: `frontend/src/features/session/components/FeedbackDialog.tsx`
- Interview session: `frontend/src/app/session/[id]/page.tsx`
  - client UI: `frontend/src/features/session/components/InterviewSessionClient.tsx`
  - orchestration: `frontend/src/features/session/hooks/useInterviewSession.ts`

## Backend Modules (Where Things Live)

- Server bootstrap: `backend/src/index.ts`
- Express server: `backend/src/server.ts`
- Routes:
  - Jobs: `backend/src/routes/job/*`
  - Sessions: `backend/src/routes/sessions/*`
- Socket.IO:
  - Server init: `backend/src/socket.ts`
  - Session handler: `backend/src/socket/session.handler.ts`
- Worker:
  - Queue: `backend/src/queues/session-analysis-queue.ts`
  - Worker: `backend/src/queues/workers/session-analysis.worker.ts`

## Troubleshooting

### "Failed to enqueue analysis job" / "Connection is closed"

This means BullMQ could not enqueue the job because Redis is unavailable.

Checklist:

- `REDIS_URL` is correct and reachable from your machine
- DNS/network allows your Upstash host (or local redis is running)
- backend logs show `Redis connected` and not repeated reconnect/end

### Prisma error: `Argument openessLevel is missing`

Your runtime Prisma Client is out of sync with the schema. Regenerate:

```bash
cd backend
npx prisma generate
```

### Gemini Live errors

- `setup must be the first message` → ensure nothing is sent before `setup`
- `Unknown name "languageCodes"` → remove unsupported fields from `setup.inputAudioTranscription`

### Feedback generated but UI not updating

- The job sessions page refetches while any session is `processing`.
- The feedback dialog polls `GET /sessions/:id` until `status=completed`.
- If you see `processing` forever:
  - check Redis connectivity (BullMQ enqueue must succeed)
  - check worker logs (`Session analysis complete`)

## Build / Production Notes

- Backend: `cd backend && npm run build && npm start`
- Frontend: `cd frontend && npm run build && npm start`
- Ensure `FRONTEND_URL`, `NEXT_PUBLIC_API_BASE_URL`, and `NEXT_PUBLIC_SOCKET_URL` match your deployment URLs.
