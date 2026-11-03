import fs from "node:fs";
import path from "node:path";
import { Suspense } from "react";
import { careerOpsRoot, pipelineSummary, readLinkedReport, readTrackerShape } from "@/lib/career-ops";
import { closingDateFromText } from "@/lib/closing-date.mjs";
import { pendingInbox } from "@/lib/inbox-pending.mjs";
import { PipelineView } from "@/components/pipeline-view";
import { pipelineTab } from "@/lib/pipeline-navigation.mjs";
import { parseReport, scoreNum } from "@/lib/format";
import { resolvePostingUrl } from "@/lib/posting-url.mjs";
import { queueRows } from "@/lib/queue-filter.mjs";

export const dynamic = "force-dynamic"; // always read fresh local files

/** Text of the jds/ captures named for this row's report number ("043-…md"). */
function jdCaptureText(reportCell: string): string {
  const num = reportCell.match(/reports\/(\d+)-/)?.[1];
  if (!num) return "";
  const dir = path.join(careerOpsRoot(), "jds");
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.startsWith(`${num}-`) && /\.(md|txt)$/i.test(f))
      .map((f) => fs.readFileSync(path.join(dir, f), "utf8"))
      .join("\n");
  } catch {
    return "";
  }
}

// Tracker tabs show the inbox only as a count, so they get the count and not
// the postings. The inbox is most of the page payload on a large pipeline.
export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const { tab } = await searchParams;
  const onInbox = pipelineTab(tab) === "INBOX";
  const { inbox, applications: tracked } = pipelineSummary();
  // Queue rows need a posting URL for Apply and a closing date for the sort.
  // Most trackers have no URL column, so fall back to the linked report's
  // **URL:** header; the closing date comes from the report's archived JD or
  // the jds/ capture with the same report number.
  const candidates = new Set(queueRows(tracked, scoreNum, "0000-00-00").map((app: { n: string }) => app.n));
  const applications = tracked.map((app) => {
    if (!candidates.has(app.n)) return app;
    try {
      const report = readLinkedReport(app) ?? "";
      const reportUrl = report ? parseReport(report).fields.find((field) => field.label === "URL")?.value : "";
      const url = app.url || resolvePostingUrl(app.url, reportUrl) || "";
      const { date, open } = closingDateFromText(`${report}\n${jdCaptureText(app.report)}`);
      const closes = date ?? (open ? "open" : undefined);
      return { ...app, url, ...(closes ? { closes } : {}) };
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
