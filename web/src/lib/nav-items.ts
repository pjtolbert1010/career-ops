import { ListChecks, FileText, Settings, ClipboardList } from "lucide-react";
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
