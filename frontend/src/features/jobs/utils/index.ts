import { Job } from "../types";
import type { DashboardStats } from "../types";

export function computeStats(jobs: Job[]): DashboardStats {
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