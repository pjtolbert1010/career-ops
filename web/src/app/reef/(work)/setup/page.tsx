import { StartWizard } from "@/components/reef/work/start-wizard";
import { readMatchData, readMatchPrefs } from "@/lib/match-data";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const [data, prefs] = await Promise.all([readMatchData(), readMatchPrefs()]);
  return (
    <>
      <header className="mb-10 flex flex-col gap-3">
        <span className="lux-eyebrow">Setup</span>
        <h1 className="lux-display m-0" style={{ fontSize: "var(--lux-t-h2)" }}>
          Three steps to <em>start</em>
        </h1>
        <p className="lux-lede m-0 max-w-2xl">Your resume, what you want, and you are done. Change any of it later.</p>
      </header>
      <StartWizard prefs={prefs} resume={data.resume} />
    </>
  );
}
