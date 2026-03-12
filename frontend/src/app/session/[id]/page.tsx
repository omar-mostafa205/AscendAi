"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Mic, MicOff, Phone, Settings, Volume2, MessageSquare, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import { useSocket } from "@/features/session/hooks/useSocket";
import { useLiveKit } from "@/features/session/hooks/useLivekit";
import { SessionService } from "@/features/session/services/session.service";

type ScenarioType = "technical" | "background" | "culture";

interface InterviewSession {
  id: string;
  scenarioType: ScenarioType;
  jobTitle: string;
  company: string;
  startedAt: string;
  livekitToken?: string | null;
  currentQuestion?: {
    number: number;
    text: string;
    duration: number;
  };
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

  // ── Session fetch ──────────────────────────────────────────────────────
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

        setSession({
          id: data.id,
          scenarioType: data.scenarioType,
          jobTitle: data.job?.title ?? "Interview Session",
          company: data.job?.company ?? "",
          startedAt: data.startedAt,
          livekitToken: data.livekitToken ?? null,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  // ── Hooks ──────────────────────────────────────────────────────────────
  const { sessionJoined, isThinking, aiText, isEnded, endSession, playLastAudio } = useSocket(sessionId);
  const { isConnected, isTalking, error: livekitError, startTalking, stopTalking, disconnect } = useLiveKit(
    session?.livekitToken ?? null,
    !!session?.livekitToken
  );

  // ── UI state ──────────────────────────────────────────────────────────
  const [showQuestion, setShowQuestion] = useState(false);
  const elapsedTime = useElapsedTime();

  // ── Auto-redirect when session ends via socket ─────────────────────────
  useEffect(() => {
    if (isEnded) {
      disconnect();
      router.push(`/feedback/${sessionId}`);
    }
  }, [isEnded, disconnect, router, sessionId]);

  // ── End interview (manual) ─────────────────────────────────────────────
  const handleEndInterview = async () => {
    try {
      if (isTalking) {
        await stopTalking()
        await new Promise((r) => setTimeout(r, 500))
      }
    } catch (e) {
      console.error("Failed to stop recording before ending interview", e)
    }

    // Prefer REST end-session so the button works even if the socket is disconnected.
    try {
      await SessionService.endSession(sessionId)
    } catch (e) {
      // Fall back to socket emit if REST fails for any reason.
      console.error("Failed to end session via API, falling back to socket", e)
      endSession()
    } finally {
      await disconnect()
      router.push(`/feedback/${sessionId}`)
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────
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

      {/* Header */}
      <div className="px-8 pt-6 pb-4 flex items-start justify-between z-10">
        <div>
          <h1 className="text-3xl font-serif text-[#1f1f1f] mb-1">{session.jobTitle}</h1>
          <p className="text-[#676662] text-sm">
            {session.company} • {config.label} Round
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* LiveKit connection badge */}
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${isConnected
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-[#e5e1dc] bg-white text-[#676662]"
            }`}>
            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isConnected ? "Live" : "Connecting…"}
          </div>

          {/* Socket joined badge */}
          {sessionJoined && (
            <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Session active
            </div>
          )}

          {/* Timer */}
          <div className="px-4 py-2">
            <p className="text-3xl font-bold text-[#1b1917] tabular-nums">{elapsedTime}</p>
          </div>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 relative">

        {/* Avatar card */}
        <div className="absolute inset-0 px-8 pb-8">
          <Card className="w-full h-full bg-white border-[#e5e1dc] overflow-hidden rounded-3xl">
            <div className="w-full h-full flex items-end justify-center relative">

              {/* AI thinking / speaking indicator */}
              {(isThinking || aiText) && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10">
                  {isThinking ? (
                    <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-[#e5e1dc] rounded-full px-4 py-2 shadow-sm">
                      <span className="flex gap-1">
                        {[0, 150, 300].map((d) => (
                          <span
                            key={d}
                            className="w-1.5 h-1.5 rounded-full bg-[#1b1917] animate-bounce"
                            style={{ animationDelay: `${d}ms` }}
                          />
                        ))}
                      </span>
                      <span className="text-xs text-[#676662]">Thinking…</span>
                    </div>
                  ) : aiText ? (
                    <div className="max-w-md bg-white/95 backdrop-blur-sm border border-[#e5e1dc] rounded-2xl px-5 py-3 shadow-sm">
                      <p className="text-sm text-[#1f1f1f] leading-relaxed">{aiText}</p>
                    </div>
                  ) : null}
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

        {/* Question overlay */}
        {showQuestion && session.currentQuestion && (
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 max-w-3xl w-full px-8 z-10">
            <Card className="bg-white/95 backdrop-blur-sm border-[#e5e1dc] shadow-2xl">
              <div className="p-6">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h3 className="text-lg font-semibold text-[#1f1f1f]">
                    Question {session.currentQuestion.number}
                  </h3>
                  <span className="text-sm text-[#676662] font-medium">
                    {Math.floor(session.currentQuestion.duration / 60)}:00
                  </span>
                </div>
                <p className="text-[#1f1f1f] leading-relaxed">{session.currentQuestion.text}</p>
              </div>
            </Card>
          </div>
        )}

        {/* LiveKit error */}
        {livekitError && (
          <div className="absolute top-4 right-12 z-20">
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-xl">
              Audio error: {livekitError}
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="p-8 flex items-center justify-center z-20">
        <div className="flex items-center gap-4">

          {/* Microphone — normal conversation mode */}
          <Button
            onPointerDown={(e) => {
              e.preventDefault()
              startTalking()
            }}
            onPointerUp={(e) => {
              e.preventDefault()
              stopTalking()
            }}
            onPointerLeave={(e) => {
              e.preventDefault()
              stopTalking()
            }}
            size="lg"
            className={`w-14 h-14 rounded-full p-0 ${
              isTalking
                ? "bg-[#1b1917] hover:bg-neutral-800 text-white"
                : "bg-white border-2 border-[#e5e1dc] hover:bg-[#f0ebe6]"
            }`}
            title={isTalking ? "Release To Send" : "Hold To Talk"}
          >
            {isTalking ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5 text-[#1b1917]" />}
          </Button>

          {/* Volume (UI only) */}
          <Button
            onClick={playLastAudio}
            size="lg"
            variant="outline"
            className="w-14 h-14 rounded-full p-0 bg-white border-2 border-[#e5e1dc] hover:bg-[#f0ebe6]"
            title="Play Last AI Audio"
          >
            <Volume2 className="w-5 h-5 text-[#1b1917]" />
          </Button>

          {/* Question toggle */}
          <Button
            onClick={() => setShowQuestion((v) => !v)}
            size="lg"
            variant="outline"
            className={`w-14 h-14 rounded-full p-0 border-2 hover:bg-[#f0ebe6] ${showQuestion
                ? "bg-[#1b1917] border-[#1b1917] text-white hover:bg-neutral-800"
                : "bg-white border-[#e5e1dc]"
              }`}
            title="View Question"
          >
            <MessageSquare className={`w-5 h-5 ${showQuestion ? "text-white" : "text-[#1b1917]"}`} />
          </Button>

          {/* Settings (UI only) */}
          <Button
            size="lg"
            variant="outline"
            className="w-14 h-14 rounded-full p-0 bg-white border-2 border-[#e5e1dc] hover:bg-[#f0ebe6]"
            title="Settings"
          >
            <Settings className="w-5 h-5 text-[#1b1917]" />
          </Button>

          {/* End call — wired to endSession + disconnect */}
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
