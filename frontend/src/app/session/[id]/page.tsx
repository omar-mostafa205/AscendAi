import { InterviewSessionClient } from "@/features/session/components/InterviewSessionClient";

interface InterviewSessionPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function InterviewSessionPage({
  params,
}: InterviewSessionPageProps) {
  const { id } = await params;

  return <InterviewSessionClient sessionId={id} />;
}
