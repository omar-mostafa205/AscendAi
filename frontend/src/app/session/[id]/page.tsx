"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Mic, MicOff, Phone, Settings, Volume2, VolumeX, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import { useSocket } from "@/features/session/hooks/useSocket";
import { SessionService } from "@/features/session/services/session.service";
import { useGeminiLive } from "@/features/session/hooks/useGeminiLive";

type ScenarioType = "technical" | "background" | "culture";

interface InterviewSession {
  id: string;
  scenarioType: ScenarioType;
  jobTitle: string;
  company: string;
  startedAt: string;
  status?: string;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await SessionService.getSession(sessionId);
        const data = res.data;

        if (cancelled) return;

        const status = data.status as string | undefined
        if (data.endedAt || status === "processing" || status === "completed") {
          router.push(`/feedback/${sessionId}`)
          return
        }

        setSession({
          id: data.id,
          scenarioType: data.scenarioType,
          jobTitle: data.job?.title ?? "Interview Session",
          company: data.job?.company ?? "",
          startedAt: data.startedAt,
          status: status ?? "active",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId, router]);

  const { sessionJoined, isEnded, endSession } = useSocket(sessionId);
  const {
    isConnected,
    isMuted,
    isMicActive,
    isUserSpeaking,
    isModelSpeaking,
    hasAudio,
    error,
    connect,
    startInterview,
    disconnect,
    startMic,
    stopMic,
    toggleMute,
  } = useGeminiLive(sessionId, session?.scenarioType)

  const elapsedTime = useElapsedTime();

  useEffect(() => {
    if (!sessionId || !session?.scenarioType) return
    let cancelled = false
    ;(async () => {
      try {
        if (cancelled) return
        await connect()
      } catch (err) {
        console.error("Failed to connect to Gemini Live", err)
      }
    })()
    return () => {
      cancelled = true
      disconnect()
    }
  }, [sessionId, session?.scenarioType, connect, disconnect])

  useEffect(() => {
    if (isEnded) {
      stopMic();
      disconnect();
      router.push(`/feedback/${sessionId}`);
    }
  }, [isEnded, stopMic, disconnect, router, sessionId]);

  useEffect(() => {
    if (!sessionJoined) return;
    if (!isConnected) return;
    if (isMicActive) return;
    startMic().catch((e) => console.error("Failed to auto-start mic", e));
  }, [sessionJoined, isConnected, isMicActive, startMic]);

  useEffect(() => {
    if (!sessionJoined) return
    if (!isConnected) return
    startInterview().catch((e) => console.error("Failed to start interview", e))
    // fire once per join/connect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionJoined, isConnected])

  const handleEndInterview = async () => {
    try {
      await stopMic()
    } catch (e) {
      console.error("Failed to stop recording before ending interview", e)
    }

    try {
      await SessionService.endSession(sessionId)
    } catch (e) {
      console.error("Failed to end session via API, falling back to socket", e)
      endSession()
    } finally {
      await disconnect()
      router.push(`/feedback/${sessionId}`)
    }
  };

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-[#f5f2ef] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#1b1917] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#676662]">Starting interview session...</p>
        </div>
      </div>
    );
  }

  const config = scenarioConfig[session.scenarioType];

  return (
    <div className="h-screen bg-[#f5f2ef] flex flex-col overflow-hidden">
      <div className="px-8 pt-6 pb-4 flex items-start justify-between z-10">
        <div>
          <h1 className="text-3xl font-serif text-[#1f1f1f] mb-1">{session.jobTitle}</h1>
          <p className="text-[#676662] text-sm">
            {session.company} • {config.label} Round
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${
            isConnected
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-[#e5e1dc] bg-white text-[#676662]"
          }`}>
            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isConnected ? "Live" : "Connecting…"}
          </div>

          {sessionJoined && (
            <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Session active
            </div>
          )}

          {isConnected && sessionJoined && !hasAudio && (
            <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700">
              Audio fallback
            </div>
          )}

          <div className="px-4 py-2">
            <p className="text-3xl font-bold text-[#1b1917] tabular-nums">{elapsedTime}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 relative">
        <div className="absolute inset-0 px-8 pb-8">
          <Card className="w-full h-full bg-white border-[#e5e1dc] overflow-hidden rounded-3xl">
            <div className="w-full h-full flex items-end justify-center relative">
              
              {isModelSpeaking && (
                <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10">
                  <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm px-4 py-2 rounded-full flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    AI is speaking...
                  </div>
                </div>
              )}

              {isUserSpeaking && (
                <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10">
                  <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2 rounded-full flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Listening...
                  </div>
                </div>
              )}

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

      <div className="p-8 flex items-center justify-center z-20">
        <div className="flex items-center gap-4">
          <Button
            onClick={isMicActive ? stopMic : startMic}
            size="lg"
            className={`w-14 h-14 rounded-full p-0 ${
              isMicActive
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-white border-2 border-[#e5e1dc] hover:bg-[#f0ebe6] text-[#1b1917]"
            }`}
            title={isMicActive ? "Disable Mic" : "Enable Mic"}
          >
            {isMicActive ? (
              <Mic className="w-5 h-5" />
            ) : (
              <MicOff className="w-5 h-5" />
            )}
          </Button>

          <Button
            onClick={toggleMute}
            size="lg"
            variant="outline"
            className="w-14 h-14 rounded-full p-0 bg-white border-2 border-[#e5e1dc] hover:bg-[#f0ebe6]"
            title={isMuted ? "Unmute AI" : "Mute AI"}
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-[#1b1917]" />
            ) : (
              <Volume2 className="w-5 h-5 text-[#1b1917]" />
            )}
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="w-14 h-14 rounded-full p-0 bg-white border-2 border-[#e5e1dc] hover:bg-[#f0ebe6]"
            title="Settings"
          >
            <Settings className="w-5 h-5 text-[#1b1917]" />
          </Button>

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
