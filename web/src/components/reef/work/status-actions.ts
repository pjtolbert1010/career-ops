// Tracker writes from the Career Reef work pages go through /api/status, which runs
// set-status.mjs (locked, validated, logged). Nothing here submits anything.
export async function setStatus(n: string, status: string): Promise<string | null> {
  const res = await fetch("/api/status", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ n, status }),
  });
  if (res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error || `Could not set ${status} (HTTP ${res.status})`;
}

export async function undoStatus(n: string): Promise<string | null> {
  const res = await fetch("/api/status", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ n, undo: true }),
  });
  return res.ok ? null : `Undo failed (HTTP ${res.status})`;
}
