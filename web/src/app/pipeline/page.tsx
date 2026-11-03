import { Suspense } from "react";
import { pipelineSummary, readLinkedReport, readTrackerShape } from "@/lib/career-ops";
import { pendingInbox } from "@/lib/inbox-pending.mjs";
import { PipelineView } from "@/components/pipeline-view";
import { pipelineTab } from "@/lib/pipeline-navigation.mjs";
import { parseReport, scoreNum } from "@/lib/format";
import { resolvePostingUrl } from "@/lib/posting-url.mjs";
import { queueRows } from "@/lib/queue-filter.mjs";

export const dynamic = "force-dynamic"; // always read fresh local files

// Tracker tabs show the inbox only as a count, so they get the count and not
// the postings. The inbox is most of the page payload on a large pipeline.
export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const { tab } = await searchParams;
  const onInbox = pipelineTab(tab) === "INBOX";
  const { inbox, applications: tracked } = pipelineSummary();
  // Queue rows need a posting URL for Apply. Most trackers have no URL column,
  // so fall back to the linked report's **URL:** header.
  const queued = new Set(queueRows(tracked, scoreNum).map((app: { n: string }) => app.n));
  const applications = tracked.map((app) => {
    if (app.url || !queued.has(app.n)) return app;
    try {
      const report = readLinkedReport(app);
      const reportUrl = report ? parseReport(report).fields.find((field) => field.label === "URL")?.value : "";
      const url = resolvePostingUrl(app.url, reportUrl);
      return url ? { ...app, url } : app;
    } catch {
      return app;
    }
  });
  const pending = pendingInbox(inbox);
  const trackerShape = readTrackerShape();
  return (
    <Suspense>
      <PipelineView applications={applications} inbox={onInbox ? pending : null} inboxCount={pending.length} trackerShape={trackerShape} />
    </Suspense>
  );
}
