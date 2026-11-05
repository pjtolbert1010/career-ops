import { readJsonObject } from "@/lib/json-body";
import { openSigninAlerts, raiseSigninAlert, resolveSigninAlert } from "@/lib/signin-alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// "Needs sign-in" alerts (lib/signin-alerts.ts).
//   GET    → open alerts (Reef Watch banner polls this)
//   POST   → raise one: { url, loginUrl?, reason?, kind?, source? }
//            (the career-ops extension calls this when a page is a login,
//            SSO, captcha or paywall; it has already stopped that job)
//   PATCH  → resolve: { id } or { site } ("I'm signed in")
// Same-origin / loopback / allowed-extension-origin only, via src/proxy.ts.
// No credential ever passes through here.

export async function GET() {
  return Response.json({ alerts: openSigninAlerts() });
}

export async function POST(req: Request) {
  const body = await readJsonObject(req);
  if (!body) return Response.json({ error: "body must be a JSON object" }, { status: 400 });
  const alert = raiseSigninAlert(body);
  if (!alert) return Response.json({ error: "url must be an http(s) URL" }, { status: 400 });
  return Response.json({ alert });
}

export async function PATCH(req: Request) {
  const body = await readJsonObject<{ id?: unknown; site?: unknown }>(req);
  if (!body) return Response.json({ error: "body must be a JSON object" }, { status: 400 });
  const id = typeof body.id === "string" ? body.id : undefined;
  const site = typeof body.site === "string" ? body.site : undefined;
  if (!id && !site) return Response.json({ error: "id or site required" }, { status: 400 });
  return Response.json({ resolved: resolveSigninAlert({ id, site }) });
}
