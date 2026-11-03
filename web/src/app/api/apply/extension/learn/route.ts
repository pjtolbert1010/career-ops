import { careerOpsRoot } from "@/lib/career-ops";
import { loadBank, saveBank, upsertAnswers } from "@/lib/apply/answer-bank.mjs";
import { readJsonObject } from "@/lib/json-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Save the answers on a form into the user's answer bank, so the next form
// asking the same question is filled from it. Sent by the career-ops Chrome
// extension when the user moves on (Next / Submit / Save) or presses "Save my
// answers". answer-bank.mjs drops ID numbers, files and blanks.
export async function POST(req: Request) {
  const body = await readJsonObject<{ items?: unknown }>(req);
  if (!body || !Array.isArray(body.items) || body.items.length > 200) return Response.json({ error: "items must be a list of answered fields" }, { status: 400 });
  const items = body.items.filter((i): i is { label: string; type: string; value: string; options?: string[] } => !!i && typeof i === "object" && typeof (i as { label?: unknown }).label === "string" && typeof (i as { value?: unknown }).value === "string");
  const root = careerOpsRoot();
  const bank = loadBank(root);
  const result = upsertAnswers(bank, items);
  if (result.added || result.updated) saveBank(root, bank);
  return Response.json({ ...result, total: bank.entries.length });
}
