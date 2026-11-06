"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Career ops X Ai apply: one short row of destinations, aiapply-style.
const ITEMS = [
  { href: "/x", label: "Home" },
  { href: "/x/jobs", label: "Matches" },
  { href: "/x/queue", label: "Apply queue" },
  { href: "/x/resume", label: "Resume" },
  { href: "/x/tracker", label: "Tracker" },
  { href: "/x/tools", label: "Tools" },
];

export function XNav() {
  const pathname = usePathname();
  return (
    <div className="border-b border-[var(--lux-hair)] bg-[var(--lux-white)] px-[var(--lux-s-gutter)]">
      <div className="lux-wrap flex flex-wrap items-center gap-x-8 gap-y-1 py-2">
        <Link href="/x" className="lux-wordmark mr-auto text-[1.35rem] no-underline text-[var(--lux-ink)]">
          Career ops <em>X</em> Ai apply
        </Link>
        <nav aria-label="Career ops X" className="flex flex-wrap gap-x-6">
          {ITEMS.map((i) => {
            const on = i.href === "/x" ? pathname === "/x" : pathname.startsWith(i.href);
            return (
              <Link key={i.href} href={i.href} className="lux-link" aria-current={on ? "page" : undefined}>
                <span className="lux-u">{i.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
