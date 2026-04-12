import { JobSessionsClient } from "@/features/jobs/components/JobSessions/JobSessionsClient";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function JobSessionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const isUuid =
    typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    );
  if (!isUuid) redirect("/jobs");

  return (
    <Suspense fallback={<div></div>}>
      <JobSessionsClient id={id} />
    </Suspense>
  );
}
