import "server-only";

// Cloudflare Turnstile server-side check. For local development use
// Cloudflare's test keys (see .env.example), which always pass.
export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const rawSecret = process.env.TURNSTILE_SECRET_KEY;
  if (!rawSecret) {
    console.error("TURNSTILE_SECRET_KEY is not set — rejecting request");
    return false;
  }
  const secret = rawSecret.trim().replace(/^["']|["']$/g, "");
  if (secret.length < 30) {
    console.error(
      `CRITICAL: TURNSTILE_SECRET_KEY has length ${secret.length}. This looks like a Site Key (24 chars), NOT a Secret Key (35+ chars). Make sure you did not swap Site Key and Secret Key in Vercel.`,
    );
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
      console.warn("Cloudflare Turnstile verification rejected:", data["error-codes"], {
        secretLength: secret.length,
        secretPrefix: secret.slice(0, 8),
      });
    }
    return data.success === true;
  } catch (e) {
    console.error("Turnstile verification error:", e);
    return false;
  }
}
