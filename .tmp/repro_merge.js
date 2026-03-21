
function normalizeTranscript(input) {
  return input
    .replace(/\s+/g, " ")
    .replace(/<noise>/gi, "")
    .replace(/\[(noise|silence)\]/gi, "")
    .replace(/\(silence\)/gi, "")
    .trim();
}

function mergeTranscriptOld(prevRaw, nextRaw) {
  const prev = normalizeTranscript(prevRaw ?? "");
  const next = normalizeTranscript(nextRaw);
  if (!prev) return next;
  if (!next) return prev;
  if (next.startsWith(prev)) return next;
  if (prev.startsWith(next)) return prev;
  return `${prev} ${next}`.replace(/\s+/g, " ").trim();
}

function mergeTranscriptNew(prevRaw, nextRaw) {
  const prev = prevRaw ?? "";
  const next = nextRaw;
  if (!prev) return normalizeTranscript(next);
  if (!next) return normalizeTranscript(prev);

  const prevNorm = normalizeTranscript(prev);
  const nextNorm = normalizeTranscript(next);

  if (nextNorm.startsWith(prevNorm)) return nextNorm;
  if (prevNorm.startsWith(nextNorm)) return prevNorm;

  // Delta chunk logic: 
  // Only add a space if the next chunk specifically starts with one 
  // OR if the previous one specifically ends with one.
  const needsSpace = next.startsWith(" ") || prev.endsWith(" ");
  return `${prevNorm}${needsSpace ? " " : ""}${nextNorm}`;
}

const testCases = [
  { prev: "Yeah", next: " ," },
  { prev: "that", next: "'s" },
  { prev: "bu", next: "ilding" },
  { prev: "So", next: " I'm" },
  { prev: "Yeah", next: "Yeah ," }, // Overlap case
];

console.log("Testing Old Logic:");
testCases.forEach(tc => {
  console.log(`"${tc.prev}" + "${tc.next}" -> "${mergeTranscriptOld(tc.prev, tc.next)}"`);
});

console.log("\nTesting New Logic:");
testCases.forEach(tc => {
  console.log(`"${tc.prev}" + "${tc.next}" -> "${mergeTranscriptNew(tc.prev, tc.next)}"`);
});
