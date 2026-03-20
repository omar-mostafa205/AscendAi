import { Mic, MicOff, Phone, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

interface SessionControlsProps {
  isMicActive: boolean;
  muted: boolean;
  onToggleMic: () => void;
  onToggleMute: () => void;
  onEndInterview: () => void;
}

export function SessionControls({
  isMicActive,
  muted,
  onToggleMic,
  onToggleMute,
  onEndInterview,
}: SessionControlsProps) {
  return (
    <footer className="p-8 flex items-center justify-center z-20">
      <div className="flex items-center gap-4">
        <Button
          onClick={onToggleMic}
          size="lg"
          className={`w-14 h-14 rounded-full p-0 ${
            isMicActive
              ? "bg-[#1b1917] hover:bg-gray-700 text-white"
              : "bg-white border-2 border-[#e5e1dc] hover:bg-[#f0ebe6] text-[#1b1917]"
          }`}
          title={isMicActive ? "Mute Mic" : "Unmute Mic"}
        >
          {isMicActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </Button>

        <Button
          onClick={onToggleMute}
          size="lg"
          variant="outline"
          className="w-14 h-14 rounded-full p-0 bg-white border-2 border-[#e5e1dc] hover:bg-[#f0ebe6]"
          title={muted ? "Unmute Speaker" : "Mute Speaker"}
        >
          {muted ? (
            <VolumeX className="w-5 h-5 text-[#1b1917]" />
          ) : (
            <Volume2 className="w-5 h-5 text-[#1b1917]" />
          )}
        </Button>

        <Button
          onClick={onEndInterview}
          size="lg"
          className="w-14 h-14 rounded-full p-0 text-white bg-red-600 hover:bg-red-700"
          title="End Interview"
        >
          <Phone className="w-5 h-5" />
        </Button>
      </div>
    </footer>
  );
}