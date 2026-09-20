// A single demo login for the studio. Hard rule 8 allows this one and
// nothing more. It is a signed cookie, not an account system, and there is
// no user record anywhere.

const COOKIE = "sofia_session";
const MAX_AGE_SECONDS = 60 * 60 * 12;

function secret(): string {
  return process.env.SESSION_SECRET ?? "";
}

export function studioConfigured(): boolean {
  return Boolean(
    process.env.STUDIO_USER && process.env.STUDIO_PASSWORD && secret(),
  );
}

const encoder = new TextEncoder();

// Web Crypto, because middleware runs on the edge runtime where node crypto
// is not available.
async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Buffer.from(new Uint8Array(mac)).toString("base64url");
}

// Compares in constant time, so a wrong signature cannot be found a byte at
// a time by timing the response.
function sameSignature(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function issue(): Promise<{ name: string; value: string; maxAge: number }> {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `studio.${expires}`;
  return {
    name: COOKIE,
    value: `${payload}.${await sign(payload)}`,
    maxAge: MAX_AGE_SECONDS,
  };
}

export async function isValid(token: string | undefined): Promise<boolean> {
  if (!token || !secret()) return false;
  const at = token.lastIndexOf(".");
  if (at === -1) return false;
  const payload = token.slice(0, at);
  const given = token.slice(at + 1);
  if (!sameSignature(given, await sign(payload))) return false;
  const expires = Number(payload.split(".")[1]);
  return Number.isFinite(expires) && expires > Date.now();
}

export function checkPassword(user: string, password: string): boolean {
  const expectedUser = process.env.STUDIO_USER ?? "";
  const expectedPassword = process.env.STUDIO_PASSWORD ?? "";
  if (!expectedUser || !expectedPassword) return false;
  // Both compared in constant time, and both must match.
  return (
    sameSignature(user, expectedUser) &&
    sameSignature(password, expectedPassword)
  );
}

export const SESSION_COOKIE = COOKIE;
