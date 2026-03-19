"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Mic, MicOff, Phone, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import { useSocket } from "@/features/session/hooks/useSocket";
import { useGeminiLive } from "@/features/session/hooks/useGeminiLive";
import { useSimulation } from "@/features/session/hooks/useSimulation";
import { SessionService } from "@/features/session/services/session.service";

type ScenarioType = "technical" | "background" | "culture";

interface InterviewSession {
  id: string;
  scenarioType: ScenarioType;
  jobTitle: string;
  company: string;
  startedAt: string;
  jobId: string;
}

const scenarioConfig: Record<ScenarioType, { label: string; image: string }> = {
  technical: { label: "Technical", image: "interviewer-1.png" },
  background: { label: "Background", image: "interviewer-2.png" },
  culture: { label: "Culture", image: "interviewer-3.png" },
};

function useElapsedTime() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const format = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  return format(elapsed);
}

export default function InterviewSessionPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params?.id as string;

  const [session, setSession] = useState<InterviewSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [muted, setMuted] = useState(false);
  const gainNodeRef = useRef<GainNode | null>(null);
  const elapsedTime = useElapsedTime();

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await SessionService.getSession(sessionId);
        const data = res.data;
        if (!cancelled) {
          if (data.endedAt || data.status === "processing" || data.status === "completed") {
            router.push(`/feedback/${sessionId}`);
            return;
          }
          setSession({
            id: data.id,
            scenarioType: data.scenarioType,
            jobTitle: data.job?.title ?? "Interview Session",
            company: data.job?.company ?? "",
            startedAt: data.startedAt,
            jobId: data.jobId,
          });
        }
      } finally {
        if (!cancelled) setLoadingSession(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId, router]);

  // ─── Hooks ────────────────────────────────────────────────────────────────
  const simulation = useSimulation();
  const { saveMessage, endSession, isEnded, sessionJoined } = useSocket(sessionId);

  const onSaveMessage = useCallback(
    (role: "user" | "assistant", content: string) => saveMessage(role, content),
    [saveMessage]
  );

  const {
    connect,
    disconnect,
    interrupt,
    startMic,
    stopMic,
    flushPendingTranscripts,
    isConnected,
    isModelSpeaking,
    isUserSpeaking,
    isMicActive,
    error,
  } = useGeminiLive(session?.jobId ?? "", sessionId, onSaveMessage, {
    onUserStartedSpeaking: simulation.onUserStartedSpeaking,
    onUserStoppedSpeaking: simulation.onUserStoppedSpeaking,
    onAiStartedResponding: simulation.onAiStartedResponding,
    onAiFinishedSpeaking: simulation.onAiFinishedSpeaking,
  });

  // ─── Connect Gemini after session loads ───────────────────────────────────
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    simulation.setStage("fetching_token");
    simulation.setLoadingStep("fetching_token", false);
    (async () => {
      try {
        simulation.setStage("connecting_gemini");
        simulation.setLoadingStep("fetching_token", true);
        await connect();
        if (!cancelled) {
          simulation.setLoadingStep("connecting_gemini", true);
          simulation.setStage("ready");
        }
      } catch (e) {
        if (!cancelled) simulation.setStage("error");
      }
    })();
    return () => {
      cancelled = true;
      disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // ─── Auto-start mic once connected + joined ───────────────────────────────
  useEffect(() => {
    if (sessionJoined && isConnected && !isMicActive) {
      startMic().catch(console.error);
    }
  }, [sessionJoined, isConnected, isMicActive, startMic]);

  // ─── Redirect on session ended via socket ─────────────────────────────────
  useEffect(() => {
    if (isEnded) {
      stopMic();
      disconnect();
      router.push(`/feedback/${sessionId}`);
    }
  }, [isEnded, stopMic, disconnect, router, sessionId]);

  // ─── End interview handler ────────────────────────────────────────────────
  const handleEndInterview = useCallback(async () => {
    console.log("🔚 Ending interview session...");
    interrupt();
    stopMic();
    // Flush any pending transcripts so they are saved to the database
    // before the socket disconnects and the session ends.
    flushPendingTranscripts();
    endSession();
    disconnect();
    router.push(`/feedback/${sessionId}`);
  }, [interrupt, stopMic, flushPendingTranscripts, endSession, disconnect, router, sessionId]);

  // ─── Toggle speaker mute ──────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    setMuted((prev) => !prev);
  }, []);

  // ─── Loading screen ───────────────────────────────────────────────────────
  const showLoading = loadingSession || simulation.stage === "fetching_token" || simulation.stage === "connecting_gemini" || simulation.stage === "initializing_ai";
  const loadingProgress = simulation.loadingSteps.find(s => !s.completed)?.progress ?? 100;
  const loadingLabel = simulation.loadingSteps.find(s => !s.completed)?.label ?? "Ready";

  if (showLoading) {
    return (
      <div className="min-h-screen bg-[#f5f2ef] flex items-center justify-center">
        <div className="text-center w-72">
          <div className="w-16 h-16 border-4 border-[#1b1917] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#1b1917] font-medium mb-3">{loadingLabel}</p>
          <div className="w-full h-2 bg-[#e5e1dc] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1b1917] rounded-full transition-all duration-700"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          <p className="text-[#676662] text-sm mt-2">{loadingProgress}%</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const config = scenarioConfig[session.scenarioType];
  const aiSpeakingPriority = isModelSpeaking;

  return (
    <div className="h-screen bg-[#f5f2ef] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-6 pb-4 flex items-start justify-between z-10">
        <div>
          <h1 className="text-3xl font-serif text-[#1f1f1f] mb-1">{session.jobTitle}</h1>
          <p className="text-[#676662] text-sm">
            {session.company} • {config.label} Round
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2">
            <p className="text-3xl font-bold text-[#1b1917] tabular-nums">{elapsedTime}</p>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="flex-1 relative">
        <div className="absolute inset-0 px-8 pb-8">
          <Card className="w-full h-full bg-white border-[#e5e1dc] overflow-hidden rounded-3xl">
            <div className="w-full h-full flex items-end justify-center relative">
              <div className="relative w-full max-w-2xl aspect-square -mb-30">
                <Image
                  src={`/${config.image}`}
                  alt={config.label}
                  fill
                  className="object-contain"
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                  quality={100}
                />
              </div>
            </div>
          </Card>
        </div>

        {error && (
          <div className="absolute top-4 right-12 z-20">
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-xl">
              Audio error: {error}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-8 flex items-center justify-center z-20">
        <div className="flex items-center gap-4">
          {/* Mic */}
          <Button
            onClick={isMicActive ? stopMic : startMic}
            size="lg"
            className={`w-14 h-14 rounded-full p-0 ${
              isMicActive
                ? "bg-[#1b1917] hover:bg-gray-700 text-white"
                : "bg-white border-2 border-[#e5e1dc] hover:bg-[#f0ebe6] text-[#1b1917]"
            }`}
            title={isMicActive ? "Mute Mic" : "Unmute Mic"}
          >
            {isMicActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </Button>

          <Button
            onClick={toggleMute}
            size="lg"
            variant="outline"
            className="w-14 h-14 rounded-full p-0 bg-white border-2 border-[#e5e1dc] hover:bg-[#f0ebe6]"
            title={muted ? "Unmute Speaker" : "Mute Speaker"}
          >
            {muted ? (
              <VolumeX className="w-5 h-5 text-[#1b1917]" />
            ) : (
              <Volume2 className="w-5 h-5 text-[#1b1917]" />
            )}
          </Button>

          {/* End */}
          <Button
            onClick={handleEndInterview}
            size="lg"
            className="w-14 h-14 rounded-full p-0 text-white bg-red-600 hover:bg-red-700"
            title="End Interview"
          >
            <Phone className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
