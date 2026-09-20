"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginForm({
  next,
  demoUser,
}: {
  next: string;
  demoUser: string;
}) {
  const router = useRouter();
  // Pre-filled on purpose. This is a demo account, and a judge should not
  // have to be told a password to see the half of the product that matters.
  const [user, setUser] = useState(demoUser);
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user, password }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError(d?.error ?? "That does not match.");
        setState("failed");
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("Could not sign in. Try once more.");
      setState("failed");
    }
  }

  return (
    <form onSubmit={submit} className="mt-8">
      <p className="label">Who</p>
      <input
        value={user}
        onChange={(e) => setUser(e.target.value)}
        autoComplete="username"
        className="mt-1 w-full rounded-sm border border-ink/15 bg-card px-3 py-3 text-[15px] outline-none focus:border-rust"
      />

      <p className="label mt-4">Password</p>
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        autoComplete="current-password"
        className="mt-1 w-full rounded-sm border border-ink/15 bg-card px-3 py-3 text-[15px] outline-none focus:border-rust"
      />

      {error ? (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.1em] text-rust">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={state === "sending" || password.length === 0}
        className="mt-5 w-full rounded-sm bg-rust px-4 py-3 font-mono text-[11px] uppercase tracking-[0.1em] text-card disabled:opacity-50"
      >
        {state === "sending" ? "Signing in" : "Sign in"}
      </button>

      <p className="label mt-5 border-t border-ink/10 pt-4 leading-relaxed">
        Demo account for judges
      </p>
      <p className="mt-1 text-[15px] leading-relaxed text-muted">
        The credentials are in the submission notes. This is one shared login
        for the demo, not an account system.
      </p>
    </form>
  );
}
