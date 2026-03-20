import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const sessionId = '44cc6b9f-b44e-461e-bb74-836bccd0bfa2';

prisma.interviewSession.findUnique({
  where: { id: sessionId },
  select: { messages: true, status: true, scenarioType: true }
})
.then(session => {
  if (!session) {
    console.log('❌ Session not found');
    return;
  }
  
  console.log('\n📊 Status:', session.status);
  console.log('📝 Type:', session.scenarioType);
  console.log('💬 Messages:', (session.messages as any[])?.length || 0);
  console.log('\n');
  console.log(JSON.stringify(session.messages, null, 2));
})
.finally(() => prisma.$disconnect());
