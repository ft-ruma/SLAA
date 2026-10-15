import "server-only";

// Cloudflare Turnstile server-side check. For local development use
// Cloudflare's test keys (see .env.example), which always pass.
export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("TURNSTILE_SECRET_KEY is not set — rejecting request");
    return false;
  }
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!data.success) {
      console.warn("Cloudflare Turnstile verification rejected:", data["error-codes"]);
    }
    return data.success === true;
  } catch (e) {
    console.error("Turnstile verification error:", e);
    return false;
  }
}
