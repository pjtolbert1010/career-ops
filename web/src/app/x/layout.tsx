import type { Metadata } from "next";
import { XNav } from "@/components/x/x-nav";

// Career ops X Ai apply: an experimental, aiapply-style front end over the
// same career-ops data and scripts as Career Reef. Lives at /x; /reef is untouched.
export const metadata: Metadata = { title: "Career ops X Ai apply" };

export default function XLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="reef-lux lux-page min-h-full">
      <XNav />
      <div className="px-[var(--lux-s-gutter)] py-12">
        <div className="lux-wrap">{children}</div>
      </div>
    </div>
  );
}
