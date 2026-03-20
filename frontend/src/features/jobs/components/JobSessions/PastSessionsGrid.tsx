import { FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { SessionCard } from "./SessionCard";
import { Session } from "../../types";
import { FeedbackDialog } from "@/features/session/components/FeedbackDialog";

const card = "bg-white/70 border-1 border-[#b9b1ab] rounded-2xl shadow-lg";

interface PastSessionsGridProps {
  sessions: Session[];
  initialSelectedSessionId?: string | null;
}

export function PastSessionsGrid({ sessions, initialSelectedSessionId }: PastSessionsGridProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (initialSelectedSessionId) {
      setSelectedSessionId(initialSelectedSessionId);
    }
  }, [initialSelectedSessionId]);

  return (
    <Card className={card}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-[#1f1f1f]">Past Practice Sessions</CardTitle>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-[#f0ebe6] rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-[#676662]" />
            </div>
            <p className="text-[#676662]">No practice sessions yet. Start your first one above!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sessions.map((session) => (
              <SessionCard key={session.id} session={session} onViewFeedback={(id) => setSelectedSessionId(id)} />
            ))}
          </div>
        )}
      </CardContent>

      {selectedSessionId && (
        <FeedbackDialog
          sessionId={selectedSessionId}
          isOpen={!!selectedSessionId}
          onOpenChange={(open) => !open && setSelectedSessionId(null)}
        />
      )}
    </Card>
  );
}

