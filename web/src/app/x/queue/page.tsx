import { QueueView } from "@/components/x/queue-view";
import { readXData } from "@/lib/x-data";

export const dynamic = "force-dynamic";

export default async function XQueue() {
  const data = await readXData();
  return (
    <>
      <header className="mb-10 flex flex-col gap-3">
        <span className="lux-eyebrow">Apply queue</span>
        <h1 className="lux-display m-0" style={{ fontSize: "var(--lux-t-h2)" }}>
          Apply, <em>one press each</em>
        </h1>
        <p className="lux-lede m-0 max-w-2xl">Documents are made for you. Open &amp; fill opens the application already filled in and stops at Submit. You read it and press Submit yourself.</p>
      </header>
      <QueueView jobs={data.jobs} />
    </>
  );
}
