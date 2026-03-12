import { useRouter } from "next/navigation";
import { Eye, Code, Users, FileText, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Session, ScenarioType, SessionStatus } from "../../types";
import { formatRelativeTime } from "@/lib/utils";

const scenarioConfig: Record<ScenarioType, {
  label: string;
  badge: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  image: string;
}> = {
  technical: {
    label: "Technical",
    badge: "Technical",
    description: "Technical Round",
    icon: Code,
    iconColor: "text-blue-900",
    image: "interviewer-1.png",
  },
  background: {
    label: "Background",
    badge: "Background",
    description: "Background Round",
    icon: Users,
    iconColor: "text-purple-900",
    image: "interviewer-2.png",
  },
  culture: {
    label: "Culture",
    badge: "Culture",
    description: "Culture Round",
    icon: FileText,
    iconColor: "text-orange-700",
    image: "interviewer-3.png",
  },
};

const statusConfig: Record<SessionStatus, {
  label: string;
  icon: React.ElementType;
}> = {
  completed:   { label: "Completed",   icon: CheckCircle },
  in_progress: { label: "In Progress", icon: Clock },
  pending:     { label: "Pending",     icon: AlertCircle },
  processing:  { label: "Processing",  icon: Clock },
  active:      { label: "In Progress", icon: Clock },
};

export { scenarioConfig };

const card = "bg-white/70 border-1 border-[#b9b1ab] rounded-2xl shadow-lg";

export function SessionCard({ session }: { session: Session }) {
  const router = useRouter();
  const scenarioConf = scenarioConfig[session.scenarioType];
  const statusConf   = statusConfig[session.status];
  const ScenarioIcon = scenarioConf?.icon ?? FileText;
  const StatusIcon   = statusConf?.icon ?? AlertCircle;

  return (
    <Card className={`hover:shadow-md transition-shadow ${card}`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center">
              <ScenarioIcon className={`w-5 h-5 ${scenarioConf.iconColor}`} />
            </div>
            <div>
              <h4 className="font-medium text-[#1f1f1f]">{scenarioConf?.label ?? "Session"}</h4>
              <p className="text-sm text-[#676662]">{formatRelativeTime(session.createdAt)}</p>
            </div>
          </div>
          {(session as any).score !== null && (session as any).score !== undefined && (
            <div className="text-right">
              <div className="text-2xl font-bold text-[#1b1917]">{(session as any).score}</div>
              <div className="text-xs text-[#676662]">Score</div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="gap-1 bg-[#f0ebe6] text-[#1f1f1f]">
            <StatusIcon className="w-3 h-3" />
            {statusConf?.label ?? session.status}
          </Badge>
          {session.status === "completed" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/feedback/${session.id}`)}
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
