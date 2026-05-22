import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const COOKIE = "sid";
const MAX_AGE = 60 * 60 * 24; // 24 hours

// Stable across restarts if SESSION_SECRET is set; random otherwise (invalidates sessions on restart)
const SECRET = process.env.SESSION_SECRET ?? randomBytes(32).toString("hex");

function sign(id: string): string {
  return createHmac("sha256", SECRET).update(id).digest("base64url");
}

export function parseSession(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;

  const match = header.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!match?.[1]) return null;

  const value = decodeURIComponent(match[1]);
  const dot = value.lastIndexOf(".");
  if (dot === -1) return null;

  const id = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = sign(id);

  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }

  return id;
}

export function getOrCreateSession(req: Request): { sessionId: string; cookie?: string } {
  const existing = parseSession(req);
  if (existing) return { sessionId: existing };

  const sessionId = crypto.randomUUID();
  const sig = sign(sessionId);
  const value = encodeURIComponent(`${sessionId}.${sig}`);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";

  const cookie = `${COOKIE}=${value}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Strict${secure}`;
  return { sessionId, cookie };
}
