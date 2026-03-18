import { prisma } from "../../config/database"
import { model } from "../../config/gemini"
import logger from "../../config/logger"
import { buildPersonaCreationPrompt } from "../../services/ai/prompts/persona.prompt"
import { geminiGenerateContentWithRetry } from "../../services/ai/gemini-retry"
import { Job, Persona } from "@prisma/client"

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

async function parsePersonaResponse(text: string): Promise<GeneratedPersona> {
  const clean = text.trim().replace(/```json|```/g, "").trim()
  return JSON.parse(clean) as GeneratedPersona
}

async function generatePersona(job: Job, scenarioType: ScenarioType): Promise<Persona> {
  const prompt = buildPersonaCreationPrompt(job, scenarioType)

  const text = await geminiGenerateContentWithRetry(() => model.generateContent(prompt))

  const generated = await parsePersonaResponse(text)

  logger.info("Persona generated", { jobId: job.id, scenarioType })

  return prisma.persona.create({
    data: {
      jobId: job.id,
      type: scenarioType,
      ...generated,
    },
  })
}

async function findExistingPersona(
  jobId: string,
  scenarioType: ScenarioType
): Promise<Persona | null> {
  return prisma.persona.findUnique({
    where: {
      jobId_type: { jobId, type: scenarioType },
    },
  })
}

async function getOrCreatePersona(job: Job, scenarioType: ScenarioType): Promise<Persona> {
  const existing = await findExistingPersona(job.id, scenarioType)

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

export const personaService = {
  getOrCreatePersona,
}