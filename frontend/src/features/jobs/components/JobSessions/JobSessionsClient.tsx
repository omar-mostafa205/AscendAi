"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { useJobSessions } from "@/features/jobs/hooks/useJobSessions";
import { ScenarioPicker } from "./ScenarioPicker";
import { PastSessionsGrid } from "./PastSessionsGrid";

const card = "bg-white/70 border-1 border-[#b9b1ab] rounded-2xl shadow-lg";

interface JobSessionsClientProps {
  id: string;
}

export function JobSessionsClient({ id }: JobSessionsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSelectedSessionId = searchParams.get("sessionId");

  const {
    job,
    isLoading,
    error,
    sessions,
    selectedScenario,
    setSelectedScenario,
    handleStartInterview,
    creating,
  } = useJobSessions(id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5f2ef] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#1b1917] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#676662]">Loading job details...</p>
        </div>
      </div>
    );
  }
  if (error === "Job not found") {
    return (
      <div className="min-h-screen bg-[#f5f2ef] flex items-center justify-center">
        <Card className={`max-w-md ${card}`}>
          <CardContent className="pt-6 text-center">
            <h2 className="text-2xl font-serif mb-4 text-[#1f1f1f]">Job Not Found</h2>
            <p className="text-[#676662] mb-6">
              The job you&apos;re looking for doesn&apos;t exist or has been removed.
            </p>
            <Button
              onClick={() => router.push("/jobs")}
              className="bg-[#1b1917] hover:bg-neutral-800 text-white"
            >
              Back to Jobs
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-[#f5f2ef] flex items-center justify-center">
        <Card className={`w-[400px] max-w-lg ${card}`}>
          <CardContent className="pt-6">
            <p className="text-red-600 text-center overflow-clip">{error || "Failed to load job"}</p>
            <Button
              onClick={() => window.location.reload()}
              className="w-full mt-4 bg-[#1b1917] hover:bg-neutral-800 text-white"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f2ef]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push("/jobs")}
            className="mb-4 -ml-2 text-[#1b1917] hover:bg-[#f0ebe6]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Jobs
          </Button>
          <h1 className="text-4xl font-serif mb-2 text-[#1f1f1f]">{job.title}</h1>
          <p className="text-xl text-[#676662]">{job.company}</p>
        </div>

        <ScenarioPicker
          jobTitle={job.title}
          selectedScenario={selectedScenario}
          onSelect={setSelectedScenario}
          onStart={handleStartInterview}
          creating={creating}
        />

        <PastSessionsGrid 
          sessions={sessions ?? []} 
          initialSelectedSessionId={initialSelectedSessionId}
        />
      </div>
    </div>
  );
}

