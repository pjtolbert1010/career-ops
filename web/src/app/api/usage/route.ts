import { NextResponse } from "next/server";
import os from "node:os";
import path from "node:path";
import { createUsageScanner } from "@/lib/claude-usage-scan.mjs";
import { claudePlanUsage, codexPlanUsage, noDataUsage } from "@/lib/plan-usage.mjs";
import { readRememberedCli } from "@/lib/remembered-cli.mjs";
import { careerOpsRoot } from "@/lib/career-ops";
import { KNOWN } from "@/lib/clis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Two kinds of usage, both for the sidebar meter:
// - providers: real plan-limit percentages per agent CLI (lib/plan-usage.mjs):
//   Claude from Anthropic's usage service, Codex from its own session logs, and
//   the configured CLI (CAREER_OPS_CLI) listed even when it reports nothing.
// - window5h / window7d: Claude Code's per-message token volume across ALL
//   projects (~/.claude/projects/**/*.jsonl), the fallback when the live Claude
//   figures are unavailable. The scanner keeps its place in each transcript and
//   reads only what was appended since the last scan (lib/claude-usage-scan.mjs).
// Cached 60s, so the meter's once-a-minute refresh makes at most one request
// to the usage service.

type Window = { tokens: number; messages: number };
type Provider = Awaited<ReturnType<typeof codexPlanUsage>>;
type Usage = { providers: NonNullable<Provider>[]; window5h: Window; window7d: Window; computedAt: number };
let cache: { at: number; data: Usage } | null = null;

const scanner = createUsageScanner({ root: path.join(os.homedir(), ".claude", "projects") });

async function providers(): Promise<NonNullable<Provider>[]> {
  const [claude, codex] = await Promise.all([claudePlanUsage(), codexPlanUsage()]);
  const list = [claude, codex].filter((p): p is NonNullable<Provider> => p != null);
  const configured = readRememberedCli(careerOpsRoot());
  if (configured && !list.some((p) => p.id === configured)) {
    const spec = KNOWN.find((c) => c.id === configured);
    list.push(noDataUsage(configured, spec?.name ?? configured));
  }
  return list;
}

export async function GET() {
  if (cache && Date.now() - cache.at < 60_000) return NextResponse.json(cache.data);
  const [tokens, list] = await Promise.all([scanner.compute(), providers()]);
  const data = { ...tokens, providers: list };
  cache = { at: Date.now(), data };
  return NextResponse.json(data);
}
