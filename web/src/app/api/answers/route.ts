import { NextResponse } from "next/server";
import { ANSWER_SECTIONS, loadAnswers, updateAnswer } from "@/lib/answers.mjs";

export const dynamic = "force-dynamic";

export async function GET() {
  try { return NextResponse.json({ answers: loadAnswers() }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load answers" }, { status: 500 }); }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body.section !== "string" || typeof body.key !== "string" || typeof body.value !== "string" || !ANSWER_SECTIONS.includes(body.section)) return NextResponse.json({ error: "Expected a known section, key, and string value" }, { status: 400 });
    return NextResponse.json({ answers: updateAnswer(body.section, body.key, body.value) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save answer" }, { status: 400 }); }
}
