export function LoadingState() {
  return (
    <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-[#1b1917] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#676662]">Loading your dashboard...</p>
      </div>
    </div>
  );
}
