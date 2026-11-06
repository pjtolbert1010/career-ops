import { TrackerBoard } from "@/components/x/tracker-board";
import { readXData } from "@/lib/x-data";

export const dynamic = "force-dynamic";

export default async function XTracker() {
  const data = await readXData();
  return (
    <>
      <header className="mb-10 flex flex-col gap-3">
        <span className="lux-eyebrow">Tracker</span>
        <h1 className="lux-display m-0" style={{ fontSize: "var(--lux-t-h2)" }}>
          Every application, <em>in one place</em>
        </h1>
        <p className="lux-lede m-0 max-w-2xl">Where you applied, when, and which resume went out. Move a card when you hear back.</p>
      </header>
      <TrackerBoard board={data.board} />
    </>
  );
}
