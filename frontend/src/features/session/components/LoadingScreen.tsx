// features/session/components/LoadingScreen.tsx

interface LoadingScreenProps {
    progress: number;
    label: string;
  }
  
  export function LoadingScreen({ progress, label }: LoadingScreenProps) {
    return (
      <div className="min-h-screen bg-[#f5f2ef] flex items-center justify-center">
        <div className="text-center w-72">
          <div className="w-16 h-16 border-4 border-[#1b1917] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#1b1917] font-medium mb-3">{label}</p>
          <div className="w-full h-2 bg-[#e5e1dc] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1b1917] rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[#676662] text-sm mt-2">{progress}%</p>
        </div>
      </div>
    );
  }