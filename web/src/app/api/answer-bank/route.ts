import { careerOpsRoot } from "@/lib/career-ops";
import { loadBank, saveBank } from "@/lib/apply/answer-bank.mjs";
import { readJsonObject } from "@/lib/json-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The Answers page's view of data/answer-bank.json: list, edit an answer, delete an entry.
export async function GET() {
  return Response.json(loadBank(careerOpsRoot()));
}

export async function PUT(req: Request) {
  const body = await readJsonObject<{ id?: unknown; answer?: unknown }>(req);
  if (!body || typeof body.id !== "string" || typeof body.answer !== "string") return Response.json({ error: "id and answer are required" }, { status: 400 });
  const root = careerOpsRoot();
  const bank = loadBank(root);
  const entry = bank.entries.find((e: { id: string }) => e.id === body.id);
  if (!entry) return Response.json({ error: "no such answer" }, { status: 404 });
  entry.answer = body.answer.slice(0, 8000);
  entry.updated = new Date().toISOString();
  saveBank(root, bank);
  return Response.json(bank);
}

export async function DELETE(req: Request) {
  const body = await readJsonObject<{ id?: unknown }>(req);
  if (!body || typeof body.id !== "string") return Response.json({ error: "id is required" }, { status: 400 });
  const root = careerOpsRoot();
  const bank = loadBank(root);
  bank.entries = bank.entries.filter((e: { id: string }) => e.id !== body.id);
  saveBank(root, bank);
  return Response.json(bank);
}
