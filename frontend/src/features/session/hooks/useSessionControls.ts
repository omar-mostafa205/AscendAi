"use client";

import { useState, useCallback } from "react";

export function useSessionControls(
  isMicActive: boolean,
  startMic: () => void,
  stopMic: () => void
) {
  const [muted, setMuted] = useState(false);

  const toggleMute = useCallback(() => {
    setMuted((prev) => !prev);
  }, []);

  const handleToggleMic = useCallback(() => {
    if (isMicActive) {
      stopMic();
    } else {
      startMic();
    }
  }, [isMicActive, startMic, stopMic]);

  return {
    muted,
    toggleMute,
    handleToggleMic,
  };
}