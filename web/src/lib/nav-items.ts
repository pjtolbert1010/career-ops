import { ListChecks, FileText, Settings, ClipboardList, Fish } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

// Single source of truth for the app's primary destinations — shared by the
// desktop sidebar and the mobile nav so they can never drift.
export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  chip?: string;
};

// Trimmed to the pipeline workflow. The other pages still exist and open by
// URL: /explore, /scheduled-scans, /followups, /portals, /analytics, /documents.
export const NAV_ITEMS: NavItem[] = [
  { href: "/reef", label: "Reef", icon: Fish },
  { href: "/pipeline", label: "Pipeline", icon: ListChecks },
  { href: "/answers", label: "Answers", icon: ClipboardList },
  { href: "/cv", label: "CV", icon: FileText },
  { href: "/config", label: "Config", icon: Settings },
];

export function visibleNavItems(followupsEnabled: boolean): NavItem[] {
  return followupsEnabled ? NAV_ITEMS : NAV_ITEMS.filter((item) => item.href !== "/followups");
}

export function isActivePath(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

// Editorial top nav (LuxNav): the primary destinations, in order.
export const PRIMARY_NAV: { href: string; label: string }[] = [
  { href: "/reef", label: "Overview" },
  { href: "/reef/matches", label: "Matches" },
  { href: "/reef/queue", label: "Apply queue" },
  { href: "/reef/tracker", label: "Tracker" },
  { href: "/reef/resume", label: "Resume" },
  { href: "/config", label: "Settings" },
];

// Everything else stays one tap away in the menu drawer.
export const MORE_NAV: { href: string; label: string }[] = [
  { href: "/pipeline?tab=INBOX", label: "Inbox" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/documents", label: "Documents" },
  { href: "/answers", label: "Answers" },
  { href: "/cv", label: "CV editor" },
  { href: "/explore", label: "Explore" },
  { href: "/portals", label: "Portals" },
  { href: "/scheduled-scans", label: "Scheduled scans" },
  { href: "/followups", label: "Follow-ups" },
  { href: "/analytics", label: "Analytics" },
  { href: "/jobs", label: "Worker history" },
  { href: "/reef/setup", label: "Setup" },
];
