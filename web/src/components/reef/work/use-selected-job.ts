"use client";

import { useEffect, useState } from "react";

/** The open job rides in the URL (?job=N) so a reload keeps it; Escape closes it. */
export function useSelectedJob(ids: string[]) {
  const [sel, setSel] = useState<string | null>(null);
  const key = ids.join(",");
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("job");
    if (id && key.split(",").includes(id)) setSel(id);
  }, [key]);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (sel) url.searchParams.set("job", sel);
    else url.searchParams.delete("job");
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
    if (!sel) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSel(null);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [sel]);
  return [sel, setSel] as const;
}
