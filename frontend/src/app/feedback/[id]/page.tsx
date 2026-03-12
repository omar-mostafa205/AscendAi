"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SessionService } from "@/features/session/services/session.service";

export default function FeedbackPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params?.id as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => SessionService.getSession(sessionId),
    enabled: !!sessionId,
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      return status === "completed" ? false : 2000;
    },
  });

  const session = data?.data ?? null;

  if (isLoading || !session) {
    return (
      <div className="min-h-screen bg-[#f5f2ef] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#1b1917] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#676662]">Generating feedback...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f5f2ef] flex items-center justify-center">
        <Card className="max-w-xl bg-white/70 border-1 border-[#b9b1ab] rounded-2xl shadow-lg">
          <CardContent className="pt-6">
            <p className="text-red-600 text-center">
              {error instanceof Error ? error.message : "Failed to load feedback"}
            </p>
            <Button
              onClick={() => router.refresh()}
              className="w-full mt-4 bg-[#1b1917] hover:bg-neutral-800 text-white"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const feedback = session.feedback as any;

  return (
    <div className="min-h-screen bg-[#f5f2ef]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-serif mb-2 text-[#1f1f1f]">Interview Feedback</h1>
        <p className="text-[#676662] mb-8">Session: {sessionId}</p>

        {session.status !== "completed" ? (
          <Card className="bg-white/70 border-1 border-[#b9b1ab] rounded-2xl shadow-lg">
            <CardContent className="pt-6">
              <p className="text-[#676662]">Generating feedback...</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card className="bg-white/70 border-1 border-[#b9b1ab] rounded-2xl shadow-lg">
              <CardContent className="pt-6">
                <h2 className="text-xl font-medium text-[#1f1f1f] mb-2">Overall Score</h2>
                <p className="text-4xl font-bold text-[#1b1917]">
                  {session.overallScore ?? "—"}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/70 border-1 border-[#b9b1ab] rounded-2xl shadow-lg">
              <CardContent className="pt-6 space-y-4">
                <div>
                  <h3 className="font-medium text-[#1f1f1f] mb-2">Strengths</h3>
                  <ul className="list-disc pl-5 text-[#1f1f1f]">
                    {(feedback?.strengths ?? []).map((s: string, i: number) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-[#1f1f1f] mb-2">Weaknesses</h3>
                  <ul className="list-disc pl-5 text-[#1f1f1f]">
                    {(feedback?.weaknesses ?? []).map((s: string, i: number) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-[#1f1f1f] mb-2">Recommendations</h3>
                  <ul className="list-disc pl-5 text-[#1f1f1f]">
                    {(feedback?.recommendations ?? []).map((s: string, i: number) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-[#1f1f1f] mb-2">Summary</h3>
                  <p className="text-[#1f1f1f] whitespace-pre-wrap">
                    {feedback?.summary ?? ""}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

