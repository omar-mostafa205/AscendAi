import { Card, CardContent } from "@/shared/components/ui/card";
import { AddJobModal } from "./JobModal";
import { CARD_STYLES } from "../types";

export function EmptyState() {
  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-serif mb-8 text-[#1f1f1f]">Interview Jobs</h1>
        <Card className={`max-w-2xl mx-auto mt-16 ${CARD_STYLES.className}`} style={CARD_STYLES.style}>
          <CardContent className="pt-12 pb-12 text-center">
            <h2 className="text-2xl font-serif mb-4 text-[#1f1f1f]">Welcome to AscendAI</h2>
            <p className="text-[#676662] mb-8 max-w-md mx-auto">
              Start your interview preparation journey by adding your first job position.
              We'll help you practice and improve with AI-powered feedback.
            </p>
            <AddJobModal />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

