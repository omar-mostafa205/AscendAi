import { useEffect, useState } from "react";

// Session Handle

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

// Transcript Normalization

export function normalizeTranscript(input: string | null | undefined): string {
  if (input == null) return "";
  const str = typeof input === "string" ? input : String(input);
  return (
    str
      .replace(/\s+/g, " ")
      .replace(/<noise>/gi, "")
      .replace(/\[(noise|silence)\]/gi, "")
      .replace(/\(silence\)/gi, "")
      // Remove whole-word stutters only (e.g. "and and and" -> "and")
      // Removed the character-pattern repeat regex — it was corrupting real words
      .replace(/\b(\w+)(\s+\1){2,}\b/gi, "$1")
      .trim()
  );
}

// Noise / Ignore Detection

export function shouldIgnoreTranscript(
  inputRaw: string | null | undefined,
): boolean {
  if (inputRaw == null) return true;
  const input = normalizeTranscript(inputRaw);
  if (!input) return true;

  // Only punctuation
  if (/^[\.\,\!\?\-–—]+$/.test(input)) return true;

  // Single character
  if (input.length <= 1) return true;

  // Two-char non-meaningful words
  if (input.length === 2 && !/\d/.test(input)) {
    const keep = new Set(["ok", "no", "hi", "yo"]);
    if (!keep.has(input.toLowerCase())) return true;
  }

  // Pure filler words (only if the entire transcript is just fillers)
  const lower = input.toLowerCase();
  const filler = new Set([
    "um",
    "uh",
    "erm",
    "hmm",
    "mm",
    "mhm",
    "ah",
    "eh",
    "ehm",
    "uhm",
  ]);
  if (filler.has(lower)) return true;

  // No English letters or digits at all
  if (!/[a-zA-Z]/u.test(input) && !/\d/.test(input)) return true;

  // REMOVED: vowel ratio check — Gemini's split words (e.g. "dra sti cally") have
  // a low vowel ratio but are real speech. This check was silently dropping user turns.

  // REMOVED: consonant cluster check — same reason, split words trigger false positives.

  return false;
}

// Transcript Merging

export function mergeTranscript(
  prevRaw: string | null,
  nextRaw: string | null | undefined,
): string {
  const prevNorm = normalizeTranscript(prevRaw);
  const nextNorm = normalizeTranscript(nextRaw);

  if (!prevNorm) return nextNorm;
  if (!nextNorm) return prevNorm;

  // If next fully contains prev, use next (STT revised its output)
  if (nextNorm.startsWith(prevNorm)) return nextNorm;

  // If prev fully contains next, keep prev (next was a shorter revision)
  if (prevNorm.startsWith(nextNorm)) return prevNorm;

  // Otherwise append with a space
  return `${prevNorm} ${nextNorm}`;
}

// Timer

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
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  return formatTime(elapsed);
}
