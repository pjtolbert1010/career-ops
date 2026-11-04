"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/components/theme-toggle";
import { WorkerPills } from "@/components/jobs/worker-pills";
import { UsageMeter } from "@/components/usage-meter";
import { useJobs } from "@/components/jobs/job-store";
import { PRIMARY_NAV, MORE_NAV, isActivePath } from "@/lib/nav-items";

// Minimal top navigation. Transparent over the /reef hero, solid paper with a
// hairline once scrolled (and always on other pages). The menu drawer carries
// every destination, the live workers, usage and the theme switch, so nothing
// the old sidebar held is lost.
export function LuxNav({ followupsEnabled }: { followupsEnabled: boolean }) {
  const pathname = usePathname();
  const [overHero, setOverHero] = useState(false);
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const { jobs } = useJobs();
  const running = jobs.filter((j) => j.status === "running").length;
  const more = MORE_NAV.filter((i) => followupsEnabled || i.href !== "/followups");

  // Transparent only while the hero sits under the bar. The hero can mount
  // after the nav (route loading state), so it is looked up on every check
  // and a MutationObserver re-checks when the page content swaps.
  useEffect(() => {
    const check = () => {
      const hero = document.querySelector<HTMLElement>("[data-hero]");
      setOverHero(!!hero && hero.getBoundingClientRect().bottom > 80);
    };
    check();
    const mo = new MutationObserver(check);
    const main = document.getElementById("main-content");
    if (main) mo.observe(main, { childList: true, subtree: true });
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      mo.disconnect();
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [pathname]);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab" && drawerRef.current) {
        const f = drawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => drawerRef.current?.querySelector<HTMLElement>("a, button")?.focus(), 60);
    const btn = menuBtnRef.current;
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
      btn?.focus();
    };
  }, [open]);

  return (
    <>
      <header className="lux-nav" data-over-hero={overHero && !open ? "true" : "false"}>
        <div className="mx-auto flex h-[var(--lux-nav-h)] max-w-[1600px] items-center gap-6 px-[var(--lux-s-gutter)]">
          <button
            ref={menuBtnRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-label={running ? `Open menu, ${running} worker${running > 1 ? "s" : ""} running` : "Open menu"}
            aria-expanded={open}
            aria-controls="lux-menu"
            className="relative -ml-2 flex size-11 shrink-0 cursor-pointer flex-col items-center justify-center gap-[6px] border-0 bg-transparent"
          >
            <span className="block h-px w-6 bg-current" />
            <span className="block h-px w-6 bg-current" />
            {running > 0 && <span className="lux-status-dot absolute right-1 top-2" data-tone="run" aria-hidden="true" />}
          </button>

          <Link href="/reef" className="lux-wordmark" aria-label="Career Reef, overview">
            Career <em>Reef</em>
          </Link>

          <nav aria-label="Primary" className="ml-auto hidden items-center gap-7 whitespace-nowrap xl:flex">
            {PRIMARY_NAV.map((i) => (
              <Link key={i.label} href={i.href} className="lux-link" aria-current={i.href === pathname ? "page" : undefined}>
                <span className="lux-u">{i.label}</span>
              </Link>
            ))}
          </nav>

          <Link href="/pipeline" className="lux-link ml-auto whitespace-nowrap xl:ml-2" aria-label="Inbox: pending postings">
            <span className="lux-u">Inbox</span>
          </Link>
        </div>
      </header>

      <div className={cn("lux-scrim", open && "open")} onClick={() => setOpen(false)} aria-hidden="true" />
      <aside
        id="lux-menu"
        ref={drawerRef}
        className={cn("lux-drawer lux-drawer-left", open && "open")}
        aria-label="Menu"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="flex min-h-full flex-col px-8 pb-8">
          <div className="flex h-[var(--lux-nav-h)] items-center justify-between">
            <span className="lux-wordmark">Career <em>Reef</em></span>
            <button type="button" onClick={() => setOpen(false)} className="lux-link" aria-label="Close menu">
              <span className="lux-u">Close</span>
            </button>
          </div>
          <nav aria-label="All pages" className="mt-6 flex flex-col">
            {PRIMARY_NAV.map((i) => (
              <Link key={i.label} href={i.href} onClick={() => setOpen(false)} className="lux-serif border-b border-[var(--lux-hair)] py-3 text-[1.75rem] leading-tight no-underline text-[var(--lux-ink)] hover:italic">
                {i.label}
              </Link>
            ))}
          </nav>
          <p className="lux-eyebrow mb-2 mt-10">More</p>
          <nav aria-label="More pages" className="grid grid-cols-2 gap-x-4">
            {more.map((i) => (
              <Link key={i.href} href={i.href} onClick={() => setOpen(false)} className="lux-link justify-start" aria-current={isActivePath(i.href, pathname) ? "page" : undefined}>
                <span className="lux-u">{i.label}</span>
              </Link>
            ))}
          </nav>
          <WorkerPills />
          <div className="mt-auto space-y-4 pt-10">
            <UsageMeter />
            <div className="space-y-2 border-t border-[var(--lux-hair)] pt-4">
              <p className="lux-eyebrow m-0">Appearance</p>
              <ThemeToggle showLabel />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
