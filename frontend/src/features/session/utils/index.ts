import { useEffect, useState } from "react";

// session.utils.ts
export function getStoredSessionHandle(sessionId: string): string | null {
  try {
    return window.localStorage.getItem(`gemini_live_handle:${sessionId}`);
  } catch {
    return null;
  }
}

export function storeSessionHandle(sessionId: string, handle: string): void {
  try {
    window.localStorage.setItem(`gemini_live_handle:${sessionId}`, handle);
  } catch {}
}
// transcript.utils.ts

export function normalizeTranscript(input: string): string {
  return input
    .replace(/\s+/g, " ")
    .replace(/<noise>/gi, "")
    .replace(/\[(noise|silence)\]/gi, "")
    .replace(/\(silence\)/gi, "")
    .trim();
}

export function shouldIgnoreTranscript(inputRaw: string): boolean {
  const input = normalizeTranscript(inputRaw);
  if (!input) return true;
  if (/^[\.\,\!\?\-–—]+$/.test(input)) return true;
  const lower = input.toLowerCase();
  const filler = new Set(["um","uh","erm","hmm","mm","mhm","ah","eh","ehm","ähm","uhm"]);
  if (filler.has(lower) && input.split(" ").length <= 2) return true;
  if (!/[A-Za-z]/.test(input) && !/\d/.test(input)) return true;
  return false;
}

export function mergeTranscript(prevRaw: string | null, nextRaw: string): string {
  if (!prevRaw) return normalizeTranscript(nextRaw);
  if (!nextRaw) return normalizeTranscript(prevRaw);
  const prevNorm = normalizeTranscript(prevRaw);
  const nextNorm = normalizeTranscript(nextRaw);
  if (nextNorm.startsWith(prevNorm)) return nextNorm;
  if (prevNorm.startsWith(nextNorm)) return prevNorm;
  const needsSpace = nextRaw.startsWith(" ") || prevRaw.endsWith(" ");
  return `${prevNorm}${needsSpace ? " " : ""}${nextNorm}`;
}

export function Timer(startedAtMs: number | null | undefined) {
  const getElapsedSeconds = () => {
    if (!startedAtMs) return 0;
    return Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
  };

  const [elapsed, setElapsed] = useState(getElapsedSeconds);

  useEffect(() => {
    setElapsed(getElapsedSeconds());
    const interval = setInterval(() => setElapsed(getElapsedSeconds()), 1000);
    return () => clearInterval(interval);
  }, [startedAtMs]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };
  
  return formatTime(elapsed);
}
