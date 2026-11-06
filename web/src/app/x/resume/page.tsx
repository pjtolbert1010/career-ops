import { ResumeView } from "@/components/x/resume-view";
import { readXData } from "@/lib/x-data";

export const dynamic = "force-dynamic";

export default async function XResume() {
  const data = await readXData();
  return (
    <>
      <header className="mb-10 flex flex-col gap-3">
        <span className="lux-eyebrow">Resume</span>
        <h1 className="lux-display m-0" style={{ fontSize: "var(--lux-t-h2)" }}>
          Your resume, <em>scored</em>
        </h1>
        <p className="lux-lede m-0 max-w-2xl">Your base resume, every tailored version, and an ATS keyword check against any job.</p>
      </header>
      <ResumeView resume={data.resume} jobs={data.jobs} />
    </>
  );
}
