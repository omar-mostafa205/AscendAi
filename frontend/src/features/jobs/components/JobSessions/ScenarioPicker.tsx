import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AvatarCard } from "@/components/AvatarCard"
import { ScenarioType } from "@/features/jobs/types"
import { scenarioConfig } from "./SessionCard"

const card = "bg-white/70 border-1 border-[#b9b1ab] rounded-2xl shadow-lg"

interface ScenarioPickerProps {
  jobTitle: string
  selectedScenario: ScenarioType | null
  onSelect: (type: ScenarioType) => void
  onStart: () => void
  creating: boolean
}

export function ScenarioPicker({
  jobTitle,
  selectedScenario,
  onSelect,
  onStart,
  creating,
}: ScenarioPickerProps) {
  return (
    <Card className={`mb-8 ${card}`}>
      <CardHeader>
        <CardTitle className="text-[#1f1f1f]">Start New Practice Session</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
          {(["technical", "background", "culture"] as ScenarioType[]).map((type) => {
            const conf = scenarioConfig[type]
            if (!conf) return null
            return (
              <div key={type} onClick={() => onSelect(type)}>
                <AvatarCard
                  image={conf.image}
                  badge={conf.badge}
                  isSelected={selectedScenario === type}
                  title={`${jobTitle} — ${conf.label}`}
                  description={conf.description}
                />
              </div>
            )
          })}
        </div>

        <Button
          onClick={onStart}
          disabled={creating}
          size="lg"
          className="w-full sm:w-auto bg-[#1b1917] hover:bg-neutral-800 text-white"
        >
          {creating ? "Creating Session..." : "Start Interview"}
        </Button>
      </CardContent>
    </Card>
  )
}
