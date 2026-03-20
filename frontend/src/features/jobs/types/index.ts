interface CreateJob {
    title : string,
    company : string,
    jobDescription : string,
}    
interface Job {
    id: string;
    userId: string;
    title: string;
    company: string;
    jobDescription: string;
    createdAt: string;  
    sessions?: Session[];
}

interface Session {
  id: string
  userId: string
  jobId: string
  personaId: string
  scenarioType:  ScenarioType
  status: SessionStatus
  overallScore: number | null
  feedback: unknown | null
  startedAt: string
  endedAt: string | null
  createdAt: string
}

  
  interface JobDetail {
    id: string;
    title: string;
    company: string;
    sessions: Session[];
  }


type ScenarioType = "technical" | "background" | "culture"
type SessionStatus = "completed" | "in_progress" | "pending" | "processing" | "active";

export type { Job , CreateJob , ScenarioType , SessionStatus , JobDetail , Session}
export interface DashboardStats {
  totalSessions: number;
  averageScore: number;
  improvementPercentage: number;
  scoreProgression: Array<{ session: number; score: number; date: string }>;
}

export const CARD_STYLES = {
  className: "bg-white rounded-2xl shadow-sm",
  style: { border: "1px solid #b9b1ab" },
} as const;