"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

// Career Reef editorial design system: small, composable primitives.
// Styling lives in app/lux.css (tokens + classes); these only add structure.

export function Section({
  id,
  className,
  children,
  tone = "paper",
  labelledBy,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
  tone?: "paper" | "white" | "ink";
  labelledBy?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn("lux-section scroll-mt-[72px]", tone === "white" && "bg-[var(--lux-white)]", tone === "ink" && "bg-[#0e1a24] text-white", className)}
    >
      <div className="lux-wrap">{children}</div>
    </section>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("lux-eyebrow m-0", className)}>{children}</p>;
}

/** Serif display heading. Pass the italic key phrase as `em`. */
export function DisplayHeading({
  as: Tag = "h2",
  id,
  children,
  em,
  after,
  className,
  size = "h2",
}: {
  as?: ElementType;
  id?: string;
  children: ReactNode;
  em?: ReactNode;
  after?: ReactNode;
  className?: string;
  size?: "hero" | "h2" | "h3";
}) {
  const fontSize = size === "hero" ? "var(--lux-t-hero)" : size === "h3" ? "var(--lux-t-h3)" : "var(--lux-t-h2)";
  return (
    <Tag id={id} className={cn("lux-display m-0", className)} style={{ fontSize }}>
      {children}
      {em && <em>{em}</em>}
      {after}
    </Tag>
  );
}

/** Centered editorial intro block: eyebrow, heading, lede. */
export function Intro({ eyebrow, id, heading, em, after, lede, align = "center" }: { eyebrow: string; id?: string; heading: ReactNode; em?: ReactNode; after?: ReactNode; lede?: ReactNode; align?: "center" | "left" }) {
  return (
    <Reveal className={cn("flex flex-col gap-6", align === "center" ? "mx-auto max-w-3xl items-center text-center" : "max-w-2xl")}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <DisplayHeading id={id} em={em} after={after}>{heading}</DisplayHeading>
      {lede && <p className="lux-lede m-0 text-[15px] sm:text-base">{lede}</p>}
    </Reveal>
  );
}

export function StatFigure({ value, label, note }: { value: number | string; label: string; note?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-10 text-center sm:py-12">
      <span className="lux-stat-num">{value}</span>
      <span className="lux-eyebrow">{label}</span>
      {note && <span className="text-xs text-[var(--lux-mute)]">{note}</span>}
    </div>
  );
}

/** Understated action: a text link with a drawn rule and an arrow. */
export function PrimaryAction({
  href,
  children,
  onClick,
  external,
  rule = true,
  className,
}: {
  href?: string;
  children: ReactNode;
  onClick?: () => void;
  external?: boolean;
  rule?: boolean;
  className?: string;
}) {
  const inner = (
    <>
      {rule && <span className="lux-rule" aria-hidden="true" />}
      <span className="lux-u">{children}</span>
      <span className="lux-arrow" aria-hidden="true">→</span>
    </>
  );
  if (!href)
    return (
      <button type="button" onClick={onClick} className={cn("lux-link", className)}>
        {inner}
      </button>
    );
  if (external)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cn("lux-link", className)}>
        {inner}
      </a>
    );
  return (
    <Link href={href} className={cn("lux-link", className)}>
      {inner}
    </Link>
  );
}

/** Fade and rise into view once. Reduced motion: shown immediately (CSS). */
export function Reveal({ children, className, as: Tag = "div", delay = 0 }: { children: ReactNode; className?: string; as?: ElementType; delay?: number }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    document.documentElement.classList.add("lux-js");
    if (!("IntersectionObserver" in window)) {
      el.classList.add("is-in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.classList.add("is-in");
            io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={cn("lux-reveal", className)} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </Tag>
  );
}

/** Photo slot: renders /media/{name} when present, else a calm tonal plate. */
export function ImageSlot({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div className={cn("lux-plate lux-zoom", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local static slot, may be absent */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={(e) => {
          e.currentTarget.style.visibility = "hidden";
        }}
      />
    </div>
  );
}
