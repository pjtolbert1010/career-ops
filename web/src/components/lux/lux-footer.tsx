import Link from "next/link";
import { PRIMARY_NAV } from "@/lib/nav-items";

export function LuxFooter() {
  return (
    <footer className="lux-footer px-[var(--lux-s-gutter)] pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-16">
      <div className="lux-wrap flex flex-col gap-10">
        <div className="flex flex-col items-start justify-between gap-8 border-b border-white/10 pb-10 md:flex-row md:items-end">
          <span className="lux-wordmark text-white">
            Career <em>Reef</em>
          </span>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-1">
            {PRIMARY_NAV.map((i) => (
              <Link key={i.label} href={i.href} className="lux-link">
                <span className="lux-u">{i.label}</span>
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex flex-col justify-between gap-3 text-[13px] tracking-[0.04em] text-[#9aa3a9] sm:flex-row">
          <span>© Career Reef</span>
          <span>Private · local-first · you press submit</span>
        </div>
      </div>
    </footer>
  );
}
