"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { AssistantConsole } from "@/components/assistant-console";
import { BackToTop } from "@/components/back-to-top";
import { JobsProvider } from "@/components/jobs/job-store";
import { PipelineProvider } from "@/components/pipeline/pipeline-provider";
import { ApplyProvider } from "@/components/apply/apply-provider";
import { ExploreProvider } from "@/components/explore/explore-provider";
import { FirstScoreView } from "@/components/explore/first-score-view";
import { LuxNav } from "@/components/lux/lux-nav";
import { LuxFooter } from "@/components/lux/lux-footer";
import { WorkerTray } from "@/components/lux/worker-tray";

export function AppShell({ children, followupsEnabled }: { children: React.ReactNode; followupsEnabled: boolean }) {
  const pathname = usePathname();
  return (
    <JobsProvider>
      <PipelineProvider>
      <ApplyProvider>
      <ExploreProvider>
      <a
        href="#main-content"
        className="sr-only rounded-md bg-brand text-sm font-medium text-brand-foreground focus:not-sr-only focus:fixed focus:px-3 focus:py-2 focus:left-3 focus:top-3 focus:z-[100] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
      >
        Skip to content
      </a>
      <LuxNav followupsEnabled={followupsEnabled} />
      <WorkerTray />
      <div className="lux-page flex min-h-screen flex-col">
        {/* The /reef overview starts under a transparent nav over its hero; every
            other page clears the fixed nav. */}
        <main id="main-content" tabIndex={-1} className={cn("flex-1 overflow-x-hidden focus:outline-none", pathname !== "/reef" && "lux-main-pad")}>{children}</main>
        <LuxFooter />
        <AssistantConsole />
        <BackToTop />
        <FirstScoreView />
      </div>
      </ExploreProvider>
      </ApplyProvider>
      </PipelineProvider>
    </JobsProvider>
  );
}
