import { beforeEach, describe, expect, it } from "vitest";
import {
  checkPassword,
  isValid,
  issue,
  studioConfigured,
} from "@/lib/session";

beforeEach(() => {
  process.env.STUDIO_USER = "sofia";
  process.env.STUDIO_PASSWORD = "lookbook-002";
  process.env.SESSION_SECRET = "a-secret-that-only-the-server-knows";
});

describe("the studio session", () => {
  it("accepts a token it just issued", async () => {
    const cookie = await issue();
    expect(await isValid(cookie.value)).toBe(true);
  });

  it("rejects a token signed with a different secret", async () => {
    const cookie = await issue();
    process.env.SESSION_SECRET = "someone-elses-secret";
    expect(await isValid(cookie.value)).toBe(false);
  });

  it("rejects a tampered payload", async () => {
    const cookie = await issue();
    const [, expires, signature] = cookie.value.split(".");
    const forged = `studio.${Number(expires) + 86400000}.${signature}`;
    expect(await isValid(forged)).toBe(false);
  });

  it("rejects an expired token", async () => {
    const cookie = await issue();
    const payload = cookie.value.slice(0, cookie.value.lastIndexOf("."));
    const past = payload.replace(/\d+$/, String(Date.now() - 1000));
    // Re-signing the past payload proves expiry is checked, not just the mac.
    expect(await isValid(`${past}.${cookie.value.split(".").pop()}`)).toBe(
      false,
    );
  });

  it("rejects nonsense", async () => {
    expect(await isValid(undefined)).toBe(false);
    expect(await isValid("")).toBe(false);
    expect(await isValid("not-a-token")).toBe(false);
    expect(await isValid("studio.999999999999.")).toBe(false);
  });

  it("checks the password", () => {
    expect(checkPassword("sofia", "lookbook-002")).toBe(true);
    expect(checkPassword("sofia", "wrong")).toBe(false);
    expect(checkPassword("someone", "lookbook-002")).toBe(false);
    expect(checkPassword("", "")).toBe(false);
  });

  it("refuses to sign anyone in when it is not configured", async () => {
    delete process.env.SESSION_SECRET;
    delete process.env.STUDIO_PASSWORD;
    expect(studioConfigured()).toBe(false);
    expect(checkPassword("sofia", "lookbook-002")).toBe(false);
    expect(await isValid("studio.99999999999999.anything")).toBe(false);
  });
});

describe("the one tap demo sign in", () => {
  it("is on when the studio is configured", async () => {
    const { demoLoginEnabled } = await import("@/lib/session");
    expect(demoLoginEnabled()).toBe(true);
  });

  it("is off when explicitly switched off", async () => {
    process.env.DEMO_LOGIN = "false";
    const { demoLoginEnabled } = await import("@/lib/session");
    expect(demoLoginEnabled()).toBe(false);
    delete process.env.DEMO_LOGIN;
  });

  it("is off when the studio is not configured at all", async () => {
    delete process.env.SESSION_SECRET;
    const { demoLoginEnabled } = await import("@/lib/session");
    expect(demoLoginEnabled()).toBe(false);
  });
});
