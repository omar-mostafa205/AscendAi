"use client";

import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { SessionService } from "@/features/session/services/session.service";

type ScenarioType = "technical" | "background" | "culture";

interface FeedbackDialogProps {
  sessionId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackDialog({
  sessionId,
  isOpen,
  onOpenChange,
}: FeedbackDialogProps) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => SessionService.getSession(sessionId),
    enabled: !!sessionId && isOpen,
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      return status === "completed" ? false : 2000;
    },
  });

  const session = data?.data ?? null;
  const isCompleted = session?.status === "completed";

  if (!isOpen) return null;

  const feedback = session?.feedback as any;
  const scenarioType = session?.scenarioType as ScenarioType | undefined;

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
    culture: [{ label: "Communication", key: "communicationScore" }],
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="w-[90vw] !max-w-6xl max-h-[90vh] overflow-y-auto bg-[#f5f2ef] border border-[#b9b1ab] rounded-2xl shadow-lg"
      >
        <h2 className="text-3xl font-serif mb-2 text-[#1f1f1f]">
          Interview Feedback
        </h2>
        <p className="text-[#676662] mb-6">Session: {sessionId}</p>

        {isLoading || !session ? (
          <div className="text-center py-10">
            <div className="w-16 h-16 border-4 border-[#1b1917] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[#676662]">Generating feedback...</p>
          </div>
        ) : error ? (
          <Card className="bg-white/70 border-1 border-[#b9b1ab] rounded-2xl shadow-lg">
            <CardContent className="pt-6">
              <p className="text-red-600 text-center">
                {error instanceof Error
                  ? error.message
                  : "Failed to load feedback"}
              </p>
              <Button
                onClick={() => refetch()}
                className="w-full mt-4 bg-[#1b1917] hover:bg-neutral-800 text-white"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : session.status !== "completed" ? (
          <Card className="bg-white/70 border-1 border-[#b9b1ab] rounded-2xl shadow-lg">
            <CardContent className="pt-6">
              <p className="text-[#676662]">Generating feedback...</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card className="bg-white/70 border-1 border-[#b9b1ab] rounded-2xl shadow-lg">
              <CardContent className="pt-6">
                <h3 className="text-xl font-medium text-[#1f1f1f] mb-2">
                  Overall Score
                </h3>
                <p className="text-5xl font-bold text-[#1b1917]">
                  {session.overallScore ?? "—"}
                  <span className="text-xl font-normal text-[#676662]">
                    {" "}
                    / 100
                  </span>
                </p>
              </CardContent>
            </Card>

            {feedback &&
              scenarioType &&
              scoreFields[scenarioType]?.length > 0 && (
                <Card className="bg-white/70 border-1 border-[#b9b1ab] rounded-2xl shadow-lg">
                  <CardContent className="pt-6">
                    <h3 className="text-xl font-medium text-[#1f1f1f] mb-4">
                      Score Breakdown
                    </h3>
                    <div className="space-y-3">
                      {scoreFields[scenarioType].map(({ label, key }) => {
                        const score = Number(feedback?.[key] ?? 0);
                        return (
                          <div key={key}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-[#1f1f1f]">{label}</span>
                              <span className="font-medium text-[#1b1917]">
                                {score}
                              </span>
                            </div>
                            <div className="w-full h-2 bg-[#e5e1dc] rounded-full">
                              <div
                                className="h-2 bg-[#1b1917] rounded-full transition-all duration-700"
                                style={{
                                  width: `${Math.max(0, Math.min(100, score))}%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

            <Card className="bg-white/70 border-1 border-[#b9b1ab] rounded-2xl shadow-lg">
              <CardContent className="pt-6 space-y-4">
                <div>
                  <h4 className="font-medium text-[#1f1f1f] mb-2">Strengths</h4>
                  <ul className="list-disc pl-5 text-[#1f1f1f]">
                    {(feedback?.strengths ?? []).map((s: string, i: number) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-[#1f1f1f] mb-2">
                    Areas to Improve
                  </h4>
                  <ul className="list-disc pl-5 text-[#1f1f1f]">
                    {(feedback?.weaknesses ?? []).map(
                      (s: string, i: number) => (
                        <li key={i}>{s}</li>
                      ),
                    )}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-[#1f1f1f] mb-2">
                    Recommendations
                  </h4>
                  <ul className="list-disc pl-5 text-[#1f1f1f]">
                    {(feedback?.recommendations ?? []).map(
                      (s: string, i: number) => (
                        <li key={i}>{s}</li>
                      ),
                    )}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-[#1f1f1f] mb-2">Summary</h4>
                  <p className="text-[#1f1f1f] whitespace-pre-wrap">
                    {feedback?.summary ?? ""}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={() => onOpenChange(false)}
              className="w-full bg-[#1b1917] hover:bg-neutral-800 text-white"
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
