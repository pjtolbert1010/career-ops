import Link from "next/link";

const TOOLS = [
  { href: "/explore", name: "Find new jobs", what: "Search company boards for roles that match your titles." },
  { href: "/pipeline?tab=INBOX", name: "Score new postings", what: "Paste a job link or score the inbox in one go." },
  { href: "/followups", name: "Follow-up emails", what: "Who to nudge and when, with a draft for each." },
  { href: "/answers", name: "Saved answers", what: "Your standard answers to common application questions." },
  { href: "/documents", name: "Documents", what: "Every resume, cover letter and SOQ made so far." },
  { href: "/analytics", name: "Insights", what: "What is working: response rates by role and source." },
  { href: "/portals", name: "Companies to watch", what: "Add or remove the companies and boards that are scanned." },
  { href: "/scheduled-scans", name: "Scheduled scans", what: "When the job search runs on its own." },
  { href: "/cv", name: "Resume editor", what: "Edit your base resume directly." },
  { href: "/reef", name: "Career Reef", what: "The original editorial overview, for comparison." },
];

export default function XTools() {
  return (
    <>
      <header className="mb-10 flex flex-col gap-3">
        <span className="lux-eyebrow">Tools</span>
        <h1 className="lux-display m-0" style={{ fontSize: "var(--lux-t-h2)" }}>
          Everything <em>else</em>
        </h1>
        <p className="lux-lede m-0 max-w-2xl">The rest of career-ops, one tap away. All local and free.</p>
      </header>
      <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((t) => (
          <li key={t.href} className="flex">
            <Link href={t.href} className="lux-card w-full gap-2 p-6 no-underline text-[var(--lux-ink)]">
              <span className="lux-serif text-[1.35rem]">{t.name}</span>
              <span className="text-sm text-[var(--lux-mute)]">{t.what}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
