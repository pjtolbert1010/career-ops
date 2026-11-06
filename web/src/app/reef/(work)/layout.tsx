// Career Reef work pages (Matches, Apply queue, Resume, Tracker, Setup). The
// route group keeps them under /reef without changing the overview at /reef.
export default function ReefWorkLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="reef-lux lux-page min-h-full">
      <div className="px-[var(--lux-s-gutter)] py-12">
        <div className="lux-wrap">{children}</div>
      </div>
    </div>
  );
}
