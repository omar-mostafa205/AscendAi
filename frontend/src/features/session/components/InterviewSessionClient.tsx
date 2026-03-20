"use client";

import { useSessionData } from "../hooks/useSessionData";
import { useInterviewSession } from "../hooks/useInterviewSession";
import { useSessionControls } from "../hooks/useSessionControls";
import { Timer } from "../utils";
import { SCENARIO_CONFIG } from "../types/session.types";
import { LoadingScreen } from "./LoadingScreen";
import { SessionHeader } from "./SessionHeader";
import { AvatarDisplay } from "./AvatarDisplay";
import { SessionControls } from "./SessionControls";

interface InterviewSessionClientProps {
  sessionId: string;
}

export function InterviewSessionClient({ sessionId }: InterviewSessionClientProps) {
  const elapsedTime = Timer();
  const { session, loading: loadingSession } = useSessionData(sessionId);
  
  const {
    simulation,
    isMicActive,
    error,
    startMic,
    stopMic,
    handleEndInterview,
  } = useInterviewSession(sessionId, session);

  const { muted, toggleMute, handleToggleMic } = useSessionControls(
    isMicActive,
    startMic,
    stopMic
  );
  
  const showLoading = 
    loadingSession || 
    simulation.stage === "fetching_token" || 
    simulation.stage === "connecting_gemini" || 
    simulation.stage === "initializing_ai";

  if (showLoading) {
    const currentStep = simulation.loadingSteps.find(s => !s.completed);
    const progress = currentStep?.progress ?? 100;
    const label = currentStep?.label ?? "Ready";

    return <LoadingScreen progress={progress} label={label} />;
  }

  if (!session) return null;

  const config = SCENARIO_CONFIG[session.scenarioType];

  return (
    <div className="h-screen bg-[#f5f2ef] flex flex-col overflow-hidden">
      <SessionHeader
        jobTitle={session.jobTitle}
        company={session.company}
        scenarioLabel={config.label}
        elapsedTime={elapsedTime}
      />

      <AvatarDisplay
        image={config.image}
        label={config.label}
        error={error}
      />

      <SessionControls
        isMicActive={isMicActive}
        muted={muted}
        onToggleMic={handleToggleMic}
        onToggleMute={toggleMute}
        onEndInterview={handleEndInterview}
      />
    </div>
  );
}