import { HomeView } from "@/components/x/home-view";
import { readXData } from "@/lib/x-data";

export const dynamic = "force-dynamic";

export default async function XHome() {
  return <HomeView data={await readXData()} />;
}
