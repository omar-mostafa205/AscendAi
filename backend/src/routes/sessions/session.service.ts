// session.service.ts
import { prisma } from "../../config/database"
import { model } from "../../config/gemeni"
import logger from "../../config/logger"
import createInterviewGraph from "../../services/ai/graphs/interview-graph"
import { buildPersonaCreationPrompt } from "../../services/ai/prompts/persona.prompt"
import { LivekitService } from "../../services/voice/livekit.service"
import { Job, Persona } from "@prisma/client"
import { geminiGenerateContentWithRetry } from "../../services/ai/gemini-retry"

type ScenarioType = "technical" | "background" | "culture"

interface GeneratedPersona {
  name: string
  role: string
  company: string
  background: string
  interviewStyle: string
  openessLevel: string
  conscientiousnessLevel: string
  extraversionLevel: string
  agreeablenessLevel: string
  neuroticismLevel: string
}

// Private helper functions (not exported)
// ============================================================================

async function generatePersona(
  job: Job,
  scenarioType: ScenarioType
): Promise<Persona> {
  const prompt = buildPersonaCreationPrompt(job, scenarioType)
  const fallbackPersona: GeneratedPersona = {
    name: "Alex Morgan",
    role: scenarioType === "technical" ? "Engineering Manager" : "Hiring Manager",
    company: job.company,
    background:
      "Experienced interviewer focused on evaluating role-relevant skills and communication clarity.",
    interviewStyle: "Friendly, structured, and probing with follow-up questions when needed.",
    openessLevel: "medium",
    conscientiousnessLevel: "high",
    extraversionLevel: "medium",
    agreeablenessLevel: "high",
    neuroticismLevel: "low",
  }

  const text = (
    await geminiGenerateContentWithRetry(() => model.generateContent(prompt), {
      fallbackText: JSON.stringify(fallbackPersona),
    })
  ).trim()
  const clean = text.replace(/```json|```/g, "").trim()

  let generated: GeneratedPersona = fallbackPersona
  try {
    generated = JSON.parse(clean) as GeneratedPersona
  } catch {
    generated = fallbackPersona
  }

  logger.info("Persona generated", { jobId: job.id, scenarioType })

  return prisma.persona.create({
    data: {
      jobId: job.id,
      type: scenarioType,
      name: generated.name,
      role: generated.role,
      company: generated.company,
      background: generated.background,
      interviewStyle: generated.interviewStyle,
      openessLevel: generated.openessLevel,
      conscientiousnessLevel: generated.conscientiousnessLevel,
      extraversionLevel: generated.extraversionLevel,
      agreeablenessLevel: generated.agreeablenessLevel,
      neuroticismLevel: generated.neuroticismLevel,
    },
  })
}

async function getPersona(
  job: Job,
  scenarioType: ScenarioType
): Promise<Persona> {
  const existing = await prisma.persona.findUnique({
    where: {
      jobId_type: { jobId: job.id, type: scenarioType },
    },
  })

  if (existing) {
    logger.info("Reusing existing persona", {
      personaId: existing.id,
      jobId: job.id,
      scenarioType,
    })
    return existing
  }

  return generatePersona(job, scenarioType)
}

async function createSession(
  userId: string,
  jobId: string,
  scenarioType: ScenarioType
) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, userId },
  })

  if (!job) throw new Error(`Job not found: ${jobId}`)

  const persona = await getPersona(job, scenarioType)

  const session = await prisma.interviewSession.create({
    data: {
      userId,
      jobId,
      personaId: persona.id,
      scenarioType,
      status: "in_progress",
    },
  })

  try {
    await LivekitService.createRoom(session.id)
  } catch (e) {
    logger.warn("Livekit room creation failed; continuing without hard-failing session creation", {
      sessionId: session.id,
      error: e,
    })
  }
  const livekitToken = await LivekitService.generateToken(session.id, userId)

  // Best-effort: initialize the LangGraph checkpoint state without running the full graph.
  try {
    const graph = await createInterviewGraph()
    await (graph as any).updateState(
      { configurable: { thread_id: session.id } },
      {
        messages: [],
        questionCount: 0,
        maxQuestions: 8,
        isComplete: false,
        scenarioType,
        feedback: null,
        overallScore: null,
        jobContext: `Job Title: ${job.title}\nCompany: ${job.company}\nDescription: ${job.jobDescription}`,
        personaContext: `You are ${persona.name}, ${persona.role} at ${persona.company}.\nInterview style: ${persona.interviewStyle}\nBackground: ${persona.background}`,
      }
    )
  } catch (e) {
    logger.warn("LangGraph state init failed; will initialize on first socket turn", {
      sessionId: session.id,
      error: e,
    })
  }

  logger.info("Session created", { sessionId: session.id, userId, jobId })

  return { session, livekitToken }
}

async function listSessions(jobId: string) {
  const sessions = await prisma.interviewSession.findMany({
    where: { jobId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      scenarioType: true,
      status: true,
      createdAt: true,
      overallScore: true,
      feedback: true,
    },
  })

  return sessions.map((session) => ({
    ...session,
    score: session.overallScore,
  }))
}

async function getSessions(jobId: string, userId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, userId },
    select: { id: true },
  })
  if (!job) throw new Error(`Job not found: ${jobId}`)
  return listSessions(jobId)
}

export const sessionService = {
  createSession,
  getSessions,
} as const
