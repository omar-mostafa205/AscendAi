import { useState, useCallback, useRef } from "react";
import { SimulationStage, LoadingStepKey, LoadingStep, LOADING_STEPS } from "../types/simulation.types";

export const useSimulation = () => {
  const [stage, _setStage] = useState<SimulationStage>("idle");
  const [loadingSteps, setLoadingSteps] = useState<LoadingStep[]>(
    (Object.entries(LOADING_STEPS) as [LoadingStepKey, any][]).map(([key, val]) => ({
      key,
      ...val,
      completed: false
    }))
  );

  const setStage = useCallback((newStage: SimulationStage) => {
    _setStage(newStage);
  }, []);
  const [error, setError] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<string[]>([]);
  const lastUserStopRef = useRef<number>(0);

  const addMetric = useCallback((msg: string) => {
    setMetrics(prev => [...prev, `${new Date().toISOString().split('T')[1].substring(0,8)} - ${msg}`]);
    // console.log(`[Simulation] ${msg}`);
  }, []);

  const setLoadingStep = useCallback((key: LoadingStepKey, completed: boolean) => {
    setLoadingSteps(prev => {
      const updated = prev.map(s => s.key === key ? { ...s, completed } : s);
      const step = updated.find(s => s.key === key);
      if (step) {
        // console.log(`🎬 Updating loading progress: ${step.label} - ${step.progress}% - ${step.description} - Completed: ${completed}`);
      }
      return updated;
    });
  }, []);

  const onUserStartedSpeaking = useCallback(() => {
    setStage("user_speaking");
    addMetric("User started speaking");
  }, [addMetric]);

  const onUserStoppedSpeaking = useCallback(() => {
    setStage("waiting_for_ai");
    lastUserStopRef.current = performance.now();
    addMetric("User stopped speaking");
  }, [addMetric]);

  const onAiStartedResponding = useCallback(() => {
    setStage("ai_speaking");
    if (lastUserStopRef.current > 0) {
      const responseTime = Math.round(performance.now() - lastUserStopRef.current);
      addMetric(`AI started responding (Response time: ${responseTime}ms)`);
      lastUserStopRef.current = 0;
    } else {
      addMetric("AI started responding");
    }
  }, [addMetric]);

  const onAiFinishedSpeaking = useCallback(() => {
    setStage("ai_finished");
    addMetric("AI finished speaking");
  }, [addMetric, setStage]);

  const onTokenUsage = useCallback((counts: { promptTokens?: number, responseTokens?: number, totalTokens?: number }) => {
    addMetric(`Token usage update: ${JSON.stringify(counts)}`);
  }, [addMetric]);

  return {
    stage,
    setStage,
    loadingSteps,
    setLoadingStep,
    onUserStartedSpeaking,
    onUserStoppedSpeaking,
    onAiStartedResponding,
    onAiFinishedSpeaking,
    onTokenUsage,
    error,
    setError,
    metrics
  };
};
