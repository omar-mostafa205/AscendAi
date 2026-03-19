"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SessionService } from "@/features/session/services/session.service";
import { supabase } from "@/lib/supabase";

type ScenarioType = "technical" | "background" | "culture";

export default function FeedbackPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params?.id as string;
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => SessionService.getSession(sessionId),
    enabled: !!sessionId,
  });

  // ─── Supabase Realtime: listen for status → completed ──────────────────
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`session_status_${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "interview_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload: { new: Record<string, any> }) => {
          if (payload.new?.status === "completed") {
            queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, queryClient]);

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
        <Card className="max-w-xl bg-white/70 border border-[#b9b1ab] rounded-2xl shadow-lg">
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
  const scenarioType = session.scenarioType as ScenarioType;

  const scoreFields: Record<ScenarioType, { label: string; key: string }[]> = {
    technical: [
      { label: "Communication", key: "communicationScore" },
      { label: "Technical", key: "technicalScore" },
      { label: "Problem Solving", key: "problemSolvingScore" },
    ],
    background: [
      { label: "Communication", key: "communicationScore" },
      { label: "Problem Solving", key: "problemSolvingScore" },
    ],
    culture: [
      { label: "Communication", key: "communicationScore" },
    ],
  };

  return (
    <div className="min-h-screen bg-[#f5f2ef]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-serif mb-2 text-[#1f1f1f]">Interview Feedback</h1>
        <p className="text-[#676662] mb-8">Session: {sessionId}</p>

        {session.status !== "completed" ? (
          <Card className="bg-white/70 border border-[#b9b1ab] rounded-2xl shadow-lg">
            <CardContent className="pt-6 flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-[#1b1917] border-t-transparent rounded-full animate-spin" />
              <p className="text-[#676662]">Generating feedback... this may take up to 30 seconds.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Overall Score */}
            <Card className="bg-white/70 border border-[#b9b1ab] rounded-2xl shadow-lg">
              <CardContent className="pt-6">
                <h2 className="text-xl font-medium text-[#1f1f1f] mb-2">Overall Score</h2>
                <p className="text-5xl font-bold text-[#1b1917]">
                  {session.overallScore ?? "—"}
                  <span className="text-xl font-normal text-[#676662]"> / 100</span>
                </p>
              </CardContent>
            </Card>

            {/* Score breakdown */}
            {feedback && scoreFields[scenarioType]?.length > 0 && (
              <Card className="bg-white/70 border border-[#b9b1ab] rounded-2xl shadow-lg">
                <CardContent className="pt-6">
                  <h2 className="text-xl font-medium text-[#1f1f1f] mb-4">Score Breakdown</h2>
                  <div className="space-y-3">
                    {scoreFields[scenarioType].map(({ label, key }) => {
                      const score = feedback?.[key] ?? 0;
                      return (
                        <div key={key}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-[#1f1f1f]">{label}</span>
                            <span className="font-medium text-[#1b1917]">{score}</span>
                          </div>
                          <div className="w-full h-2 bg-[#e5e1dc] rounded-full">
                            <div
                              className="h-2 bg-[#1b1917] rounded-full transition-all duration-700"
                              style={{ width: `${score}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Details */}
            <Card className="bg-white/70 border border-[#b9b1ab] rounded-2xl shadow-lg">
              <CardContent className="pt-6 space-y-5">
                <div>
                  <h3 className="font-medium text-[#1f1f1f] mb-2">Strengths</h3>
                  <ul className="list-disc pl-5 text-[#1f1f1f] space-y-1">
                    {(feedback?.strengths ?? []).map((s: string, i: number) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-[#1f1f1f] mb-2">Areas to Improve</h3>
                  <ul className="list-disc pl-5 text-[#1f1f1f] space-y-1">
                    {(feedback?.weaknesses ?? []).map((s: string, i: number) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-[#1f1f1f] mb-2">Recommendations</h3>
                  <ul className="list-disc pl-5 text-[#1f1f1f] space-y-1">
                    {(feedback?.recommendations ?? []).map((s: string, i: number) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-[#1f1f1f] mb-2">Summary</h3>
                  <p className="text-[#1f1f1f] whitespace-pre-wrap leading-relaxed">
                    {feedback?.summary ?? ""}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={() => router.push("/jobs")}
              className="w-full bg-[#1b1917] hover:bg-neutral-800 text-white rounded-xl py-3"
            >
              Back to Jobs
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
