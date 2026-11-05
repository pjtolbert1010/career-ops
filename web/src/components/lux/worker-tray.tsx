"use client";

import { usePathname } from "next/navigation";
import { useJobs } from "@/components/jobs/job-store";
import { WorkerPills } from "@/components/jobs/worker-pills";
import { cn } from "@/lib/cn";

// The live workers (evaluations, CV builds, scans) on every desktop page, as
// the old sidebar showed them: a small floating tray that exists only while
// there are workers to show. Phones get the same list inside the menu.
// It sits before <main> in the DOM so keyboard users reach it early.
export function WorkerTray() {
  const { jobs } = useJobs();
  const pathname = usePathname();
  if (jobs.length === 0) return null;
  return (
    <aside
      aria-label="Workers"
      className={cn(
        "lux-tray fixed z-30 hidden w-[19rem] overflow-y-auto md:block",
        // /reef: keep clear of the hero headline (bottom-left) and stack above
        // the back-to-top button on the right.
        pathname === "/reef" ? "bottom-36 right-5" : "bottom-5 left-5",
      )}
    >
      <WorkerPills />
    </aside>
  );
}
