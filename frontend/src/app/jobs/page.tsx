"use client";

import { useRouter } from "next/navigation";
import { Briefcase, Calendar, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddJobModal } from "@/features/jobs/components/JobModal";
import { JobService } from "@/features/jobs/services/job.service";
import { Job } from "@/features/jobs/types";
import { formatRelativeTime } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

interface DashboardStats {
  totalSessions: number;
  averageScore: number;
  improvementPercentage: number;
  scoreProgression: Array<{ session: number; score: number; date: string }>;
}

function computeStats(jobs: Job[]): DashboardStats {
  const allSessions = jobs.flatMap((j) => j.sessions ?? []);
  const totalSessions = allSessions.length;

  const scores = allSessions
    .map((s) => s.overallScore)
    .filter((v): v is number => typeof v === "number");
  const averageScore = scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 0;

  const sorted = [...allSessions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const scoreProgression = sorted.map((s, i) => ({
    session: i + 1,
    score: s.overallScore ?? 0,
    date: new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  const first = scoreProgression[0]?.score ?? 0;
  const last = scoreProgression[scoreProgression.length - 1]?.score ?? 0;
  const improvementPercentage = first > 0 ? ((last - first) / first) * 100 : 0;

  return { totalSessions, averageScore, improvementPercentage, scoreProgression };
}

const cardClass = "bg-white rounded-2xl shadow-sm";
const cardStyle = { border: "1px solid #b9b1ab" };

export default function JobsPage() {
  const router = useRouter();
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => JobService.getJobs(),
  });

  const jobs = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#1b1917] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#676662]">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f5f2ef] flex items-center justify-center">
        <Card className={`max-w-md ${cardClass}`} style={cardStyle}>
          <CardContent className="pt-6">
            <p className="text-red-600 text-center">
              {error instanceof Error ? error.message : "Failed to load jobs"}
            </p>
            <Button
              onClick={() => refetch()}
              className="w-full mt-4 bg-[#1b1917] hover:bg-neutral-800 text-white"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="min-h-screen bg-[#f5f5f5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl font-serif mb-8 text-[#1f1f1f]">Interview Jobs</h1>
          <Card className={`max-w-2xl mx-auto mt-16 ${cardClass}`} style={cardStyle}>
            <CardContent className="pt-12 pb-12 text-center">
              <h2 className="text-2xl font-serif mb-4 text-[#1f1f1f]">Welcome to AscendAI</h2>
              <p className="text-[#676662] mb-8 max-w-md mx-auto">
                Start your interview preparation journey by adding your first job position.
                We'll help you practice and improve with AI-powered feedback.
              </p>
              <AddJobModal />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const stats = computeStats(jobs);

  return (
    <div className="min-h-screen bg-[#f5f2ef]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-serif mb-8 text-[#1f1f1f]">My Interview Prep</h1>

        {/* Progress Card */}
        <Card className={`mb-8 ${cardClass}`} style={cardStyle}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#1f1f1f]">
              <TrendingUp className="w-5 h-5" />
              Your Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-[#f5f3f0] rounded-xl p-4">
                <p className="text-sm text-[#676662] mb-1">Total Sessions</p>
                <p className="text-3xl font-bold text-[#1b1917]">{stats.totalSessions}</p>
              </div>
              <div className="bg-[#f5f3f0] rounded-xl p-4">
                <p className="text-sm text-[#676662] mb-1">Average Score</p>
                <p className="text-3xl font-bold text-[#1b1917]">
                  {stats.averageScore > 0 ? stats.averageScore.toFixed(1) : "—"}
                </p>
              </div>
              <div className="bg-[#f5f3f0] rounded-xl p-4">
                <p className="text-sm text-[#676662] mb-1">Improvement</p>
                <p className="text-3xl font-bold text-emerald-600">
                  {stats.totalSessions < 2
                    ? "—"
                    : `${stats.improvementPercentage > 0 ? "+" : ""}${stats.improvementPercentage.toFixed(1)}%`}
                </p>
              </div>
            </div>

            {stats.scoreProgression.length > 1 && (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.scoreProgression}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e1dc" />
                    <XAxis
                      dataKey="session"
                      stroke="#676662"
                      label={{ value: "Session", position: "insideBottom", offset: -5 }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      stroke="#676662"
                      label={{ value: "Score", angle: -90, position: "insideLeft" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        border: "2px solid #b9b1ab",
                        borderRadius: "12px",
                      }}
                      formatter={(value?: number) => [`${value ?? 0}`, "Score"]}
                      labelFormatter={(label) =>
                        `Session ${label} · ${stats.scoreProgression[label - 1]?.date ?? ""}`
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#1b1917"
                      strokeWidth={2}
                      dot={{ fill: "#1b1917", r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Jobs Grid */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-serif text-[#1f1f1f]">Your application jobs</h2>
            <AddJobModal />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.map((job) => {
              const sessionCount = job.sessions?.length ?? 0;
              const avgScore =
                sessionCount > 0
                  ? (
                      job.sessions!.reduce((a, s) => a + (s.overallScore ?? 0), 0) /
                      sessionCount
                    ).toFixed(1)
                  : null;
              const lastPracticed =
                sessionCount > 0
                  ? job.sessions!.reduce((latest, s) =>
                      new Date(s.createdAt) > new Date(latest.createdAt) ? s : latest
                    ).createdAt
                  : null;

              return (
                <Card
                  key={job.id}
                  className={`hover:shadow-lg transition-shadow ${cardClass}`}
                  style={cardStyle}
                >
                  <CardHeader>
                    <CardTitle className="text-xl text-[#1f1f1f]">{job.title}</CardTitle>
                    <p className="text-[#676662]">{job.company}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center gap-2 text-sm text-[#676662]">
                        <Briefcase className="w-4 h-4" />
                        <span>{sessionCount} session{sessionCount !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#676662]">
                        <TrendingUp className="w-4 h-4" />
                        <span>{avgScore ? `Avg Score: ${avgScore}/100` : "No sessions yet"}</span>
                      </div>
                      {lastPracticed && (
                        <div className="flex items-center gap-2 text-sm text-[#676662]">
                          <Calendar className="w-4 h-4" />
                          <span>{formatRelativeTime(lastPracticed)}</span>
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={() => router.push(`/jobs/${job.id}`)}
                      className="w-full bg-[#1b1917] hover:bg-neutral-800 text-white"
                    >
                      {sessionCount > 0 ? "Continue Practicing" : "Start Practicing"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
