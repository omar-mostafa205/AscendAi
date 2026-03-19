import { prisma } from "./src/config/database"
import { analysisQueue } from "./src/queues/session-analysis-queue"
import { startSessionWorker } from "./src/queues/workers/session-analysis.worker"

async function main() {
  console.log("Starting worker...");
  await startSessionWorker();

  let user = await prisma.user.findFirst();
  if (!user) user = await prisma.user.create({ data: { email: "test@test.com", password: "pwd", firstName: "Test", lastName: "User" }})
  
  let job = await prisma.job.findFirst({ where: { userId: user.id }});
  if (!job) job = await prisma.job.create({ data: { userId: user.id, title: "Test Job", company: "Test Co", jobDescription: "Test Description" }})
  
  let persona = await prisma.persona.findFirst();
  if (!persona) persona = await prisma.persona.create({ data: { jobId: job.id, scenarioType: "technical", name: "Tester", role: "Engineer", company: "Test Co", interviewStyle: "Hard", background: "None", openessLevel: 50, conscientiousnessLevel: 50, extraversionLevel: 50, agreeablenessLevel: 50, neuroticismLevel: 50 }})

  const session = await prisma.interviewSession.create({
    data: {
      userId: user.id,
      jobId: job.id,
      scenarioType: "technical",
      personaId: persona.id,
      status: "processing",
    }
  });

  await prisma.interviewMessage.create({
    data: { sessionId: session.id, role: "user", content: "Hello I am here to interview." }
  });
  await prisma.interviewMessage.create({
    data: { sessionId: session.id, role: "assistant", content: "Great! Let's start with a technical question." }
  });
  await prisma.interviewMessage.create({
    data: { sessionId: session.id, role: "user", content: "Ok, I know how to use React and Node." }
  });

  console.log("Adding job to queue for session:", session.id);
  await analysisQueue.add("analyze_session", { sessionId: session.id });
  
  console.log("Waiting 15 seconds for job to complete...");
  await new Promise(resolve => setTimeout(resolve, 15000));
  
  const updated = await prisma.interviewSession.findUnique({
    where: { id: session.id }
  });
  console.log("Updated session details:", JSON.stringify({ status: updated?.status, overallScore: updated?.overallScore }, null, 2));
  
  process.exit(0);
}

main().catch(console.error);
