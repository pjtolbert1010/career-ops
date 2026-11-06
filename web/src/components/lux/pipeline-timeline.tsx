import Link from "next/link";

export type Stage = { label: string; count: number; note: string; href: string };

// Found → Scored → Prepped → Ready for review → Applied → Interview, as one hairline with
// serif numerals. Horizontal on desktop, vertical on phones.
export function PipelineTimeline({ stages }: { stages: Stage[] }) {
  return (
    <ol className="lux-timeline m-0 list-none p-0" aria-label="Application pipeline">
      {stages.map((s, i) => (
        <li key={s.label} className="relative flex gap-6 pb-10 md:flex-col md:gap-5 md:pb-0 md:pr-6">
          <span className="lux-dot mt-0 shrink-0" data-on={s.count > 0 ? "true" : "false"} aria-hidden="true" />
          <Link href={s.href} className="group flex flex-col gap-2 text-inherit no-underline">
            <span className="lux-eyebrow">
              {String(i + 1).padStart(2, "0")} · {s.label}
            </span>
            <span className="lux-serif text-[1.9rem] font-light leading-none tabular-nums transition-transform duration-700 group-hover:translate-x-1">{s.count}</span>
            <span className="text-sm text-[var(--lux-mute)]">{s.note}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
