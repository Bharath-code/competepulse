const TTL_MS = 10 * 60 * 1000;

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** `nonce.expiry.sig`; the nonce also goes in a cookie so a state can't be replayed from another browser. */
export async function createOAuthState(secret: string, now = Date.now()) {
  const nonce = crypto.randomUUID();
  const body = `${nonce}.${now + TTL_MS}`;
  return { nonce, state: `${body}.${await hmac(secret, body)}` };
}

export async function verifyOAuthState(
  secret: string,
  state: string | undefined,
  cookieNonce: string | null,
  now = Date.now(),
): Promise<boolean> {
  const parts = state?.split(".") ?? [];
  if (parts.length !== 3 || !cookieNonce) return false;
  const [nonce, exp, sig] = parts;
  if (nonce !== cookieNonce || !(Number(exp) > now)) return false;
  const expected = await hmac(secret, `${nonce}.${exp}`);
  return sig.length === expected.length && sig === expected;
}
