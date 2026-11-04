"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Full-bleed, muted, looping background video with an ink overlay.
// Reduced motion: only the poster shows (no video element is rendered).
// The poster also sits behind as the section background, so a failed
// video still leaves a finished hero.
export function HeroVideo({ children }: { children: ReactNode }) {
  const [motionOk, setMotionOk] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setMotionOk(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <section className="lux-hero" aria-label="Welcome" data-hero>
      {motionOk && (
        <video
          ref={ref}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/media/hero-poster.jpg"
          aria-hidden="true"
          tabIndex={-1}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        >
          <source src="/media/hero.webm" type="video/webm" />
          <source src="/media/hero.mp4" type="video/mp4" />
        </video>
      )}
      <div className="lux-hero-overlay" aria-hidden="true" />
      <div className="relative z-10 w-full px-[var(--lux-s-gutter)] pb-[clamp(4rem,10vh,8rem)]">
        <div className="lux-wrap">{children}</div>
      </div>
    </section>
  );
}
