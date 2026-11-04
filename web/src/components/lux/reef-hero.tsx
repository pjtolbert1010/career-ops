"use client";

import { HeroVideo } from "@/components/lux/hero-video";
import { DisplayHeading, Eyebrow, PrimaryAction } from "@/components/lux/primitives";

// The /reef hero. Data-free on purpose: reef/loading.tsx renders it too, so
// the headline paints while the page's local files are still being read.
export function ReefHero() {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return (
    <HeroVideo>
      <div className="flex max-w-3xl flex-col gap-6">
        <Eyebrow>
          Reef Watch · <span suppressHydrationWarning>{today}</span>
        </Eyebrow>
        <DisplayHeading as="h1" size="hero" em="curated.">
          Your next role,
          <br />
        </DisplayHeading>
        <p className="m-0 max-w-xl text-base font-light leading-relaxed text-white/85 sm:text-lg">
          Every opening scored against your profile, every application prepared, nothing sent until you say so.
        </p>
        <div className="pt-2 text-white">
          <PrimaryAction href="#openings">Review today&apos;s openings</PrimaryAction>
        </div>
      </div>
    </HeroVideo>
  );
}
