import fs from "node:fs";
import path from "node:path";
import { ReefWorld } from "@/components/reef/reef-world";
import { readReefData } from "@/lib/reef-data";

export const dynamic = "force-dynamic"; // always read fresh local files

/** Section photos are optional: render a slot only once its file exists. */
function mediaSlots() {
  const has = (f: string) => fs.existsSync(path.join(process.cwd(), "public", "media", f));
  return { openings: has("section-openings.jpg"), review: has("section-review.jpg"), pipeline: has("section-pipeline.jpg") };
}

export default async function ReefPage() {
  return <ReefWorld data={await readReefData()} slots={mediaSlots()} />;
}
