interface SessionHeaderProps {
    jobTitle: string;
    company: string;
    scenarioLabel: string;
    elapsedTime: string;
  }
  
  export function SessionHeader({ 
    jobTitle, 
    company, 
    scenarioLabel, 
    elapsedTime 
  }: SessionHeaderProps) {
    return (
      <header className="px-8 pt-6 pb-4 flex items-start justify-between z-10">
        <div>
          <h1 className="text-3xl font-serif text-[#1f1f1f] mb-1">
            {jobTitle}
          </h1>
          <p className="text-[#676662] text-sm">
            {company} • {scenarioLabel} Round
          </p>
        </div>
        <div className="px-4 py-2">
          <p className="text-3xl font-bold text-[#1b1917] tabular-nums">
            {elapsedTime}
          </p>
        </div>
      </header>
    );
  }