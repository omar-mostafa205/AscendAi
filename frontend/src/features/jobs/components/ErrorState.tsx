"use client";

import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { CARD_STYLES } from "../types";

interface ErrorStateProps {
  error: Error;
  onRetry: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="min-h-screen bg-[#f5f2ef] flex items-center justify-center">
      <Card className={`max-w-md ${CARD_STYLES.className}`} style={CARD_STYLES.style}>
        <CardContent className="pt-6">
          <p className="text-red-600 text-center">
            {error.message || "Failed to load jobs"}
          </p>
          <Button
            onClick={onRetry}
            className="w-full mt-4 bg-[#1b1917] hover:bg-neutral-800 text-white"
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}