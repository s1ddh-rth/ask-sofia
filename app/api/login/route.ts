import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest } from "@/lib/api";
import { checkPassword, issue, studioConfigured } from "@/lib/session";

export const dynamic = "force-dynamic";

const LoginSchema = z.object({
  user: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  if (!studioConfigured()) {
    return NextResponse.json(
      { error: "The studio login is not configured on this deployment." },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(badRequest(parsed.error), { status: 400 });
  }

  if (!checkPassword(parsed.data.user, parsed.data.password)) {
    // Deliberately vague, and the same for a wrong user or a wrong password.
    return NextResponse.json(
      { error: "That does not match." },
      { status: 401 },
    );
  }

  const cookie = await issue();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookie.name, cookie.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: cookie.maxAge,
  });
  return res;
}
