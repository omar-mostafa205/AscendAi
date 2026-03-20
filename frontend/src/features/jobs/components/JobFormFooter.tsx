import { Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

interface JobFormFooterProps {
  isPending: boolean;
  onCancel: () => void;
}

export function JobFormFooter({ isPending, onCancel }: JobFormFooterProps) {
  return (
    <div
      className="flex gap-3"
      style={{ borderTop: "1px solid #e8e3de", paddingTop: "1.25rem" }}
    >
      <Button
        type="button"
        variant="outline"
        className="flex-1 rounded-xl border-[#b9b1ab] text-[#676662] hover:bg-[#f0ebe6] hover:text-[#1f1f1f] hover:border-[#8a837c] transition-colors"
        onClick={onCancel}
        disabled={isPending}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        className="flex-1 rounded-xl bg-[#1b1917] hover:bg-neutral-800 text-white transition-colors"
        disabled={isPending}
      >
        {isPending ? (
          <span className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Adding...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Plus size={16} />
            Add Job
          </span>
        )}
      </Button>
    </div>
  );
}