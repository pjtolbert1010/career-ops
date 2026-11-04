import { ReefWorld } from "@/components/reef/reef-world";
import { readReefData } from "@/lib/reef-data";

export const dynamic = "force-dynamic"; // always read fresh local files

export default function ReefPage() {
  return (
    <div className="px-4">
      <ReefWorld data={readReefData()} />
    </div>
  );
}
