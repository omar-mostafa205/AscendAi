import {
  Eye,
  Code,
  Users,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { formatRelativeTime } from "@/shared/lib/utils";
import { ScenarioType, Session, SessionStatus } from "../../types";

const scenarioConfig: Record<
  ScenarioType,
  {
    label: string;
    badge: string;
    backgroundColor: string;
    description: string;
    icon: React.ElementType;
    iconColor: string;
    image: string;
  }
> = {
  technical: {
    label: "Technical",
    badge: "Technical",
    backgroundColor: "#efecfd",
    description: "Technical Round",
    icon: Code,
    iconColor: "text-blue-900",
    image: "purple-avatar.png",
  },
  background: {
    label: "Background",
    backgroundColor: "#eef7fd",
    badge: "Background",
    description: "Background Round",
    icon: Users,
    iconColor: "text-purple-900",
    image: "blue-avatar.png",
  },
  culture: {
    label: "Culture",
    backgroundColor: "#fdede7",
    badge: "Culture",
    description: "Culture Round",
    icon: FileText,
    iconColor: "text-orange-700",
    image: "orange-avatar.png",
  },
};

const statusConfig: Record<
  SessionStatus,
  {
    label: string;
    icon: React.ElementType;
  }
> = {
  completed: { label: "Completed", icon: CheckCircle },
  in_progress: { label: "In Progress", icon: Clock },
  pending: { label: "Pending", icon: AlertCircle },
  processing: { label: "Processing", icon: Clock },
  active: { label: "In Progress", icon: Clock },
};

export { scenarioConfig };

const cardClass = "bg-white/70 border-1 border-[#b9b1ab] rounded-2xl shadow-lg";

export function SessionCard({
  session,
  onViewFeedback,
}: {
  session: Session;
  onViewFeedback?: (id: string) => void;
}) {
  const scenarioConf = scenarioConfig[session.scenarioType];
  const statusConf = statusConfig[session.status];
  const ScenarioIcon = scenarioConf?.icon ?? FileText;
  const StatusIcon = statusConf?.icon ?? AlertCircle;

  return (
    <Card className={`hover:shadow-md transition-shadow ${cardClass}`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div>
              <h4 className="font-medium text-[#1f1f1f]">
                {scenarioConf?.label ?? "Session"}
              </h4>
              <p className="text-sm text-[#676662]">
                {formatRelativeTime(session.createdAt)}
              </p>
            </div>
          </div>
          {session.overallScore !== null &&
            session.overallScore !== undefined && (
              <div className="text-right">
                <div className="text-2xl font-bold text-[#1b1917]">
                  {session.overallScore}
                </div>
                <div className="text-xs text-[#676662]">Score</div>
              </div>
            )}
        </div>
        <div className="flex items-center justify-between">
          <Badge
            variant="secondary"
            className="gap-1 bg-[#f0ebe6] text-[#1f1f1f]"
          >
            <StatusIcon className="w-3 h-3" />
            {statusConf?.label ?? session.status}
          </Badge>
          {session.status === "completed" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewFeedback?.(session.id)}
              className="gap-2 border-[#e5e1dc] text-[#1b1917] hover:bg-[#f0ebe6]"
            >
              <Eye className="w-4 h-4" />
              View Feedback
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
