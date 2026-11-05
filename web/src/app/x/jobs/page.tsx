import { MatchesView } from "@/components/x/matches-view";
import { readXData } from "@/lib/x-data";

export const dynamic = "force-dynamic";

export default async function XJobs() {
  const data = await readXData();
  return (
    <>
      <header className="mb-10 flex flex-col gap-3">
        <span className="lux-eyebrow">Matches</span>
        <h1 className="lux-display m-0" style={{ fontSize: "var(--lux-t-h2)" }}>
          Jobs that <em>fit you</em>
        </h1>
        <p className="lux-lede m-0 max-w-2xl">Every job here was read and scored against your resume. Open one to see why it fits, what you meet and what you miss.</p>
      </header>
      <MatchesView jobs={data.jobs} />
    </>
  );
}
