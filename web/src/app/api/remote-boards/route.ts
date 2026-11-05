import { readRemoteJobs, readRemoteSources } from "@/lib/remote-boards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Remote-board health + scored rows for Reef Watch. Read-only.
export async function GET() {
  const jobs = readRemoteJobs();
  return Response.json({ sources: readRemoteSources(jobs), jobs });
}
