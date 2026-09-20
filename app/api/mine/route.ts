import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest } from "@/lib/api";
import { getOverrides, getShares } from "@/lib/store";

export const dynamic = "force-dynamic";

// Tells a follower which of their own links Sofia has answered. They already
// hold every ref they send, so this reveals nothing they could not see by
// opening each link, and it returns only refs and a boolean, never a note,
// never anything they typed.
const MineSchema = z.object({
  refs: z.array(z.string().min(1).max(64)).max(20),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = MineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(badRequest(parsed.error), { status: 400 });
  }

  // One query for the shares and one for the overrides, not one per ref.
  const [overrides, shares] = await Promise.all([
    getOverrides(),
    getShares(parsed.data.refs),
  ]);

  const answered = shares
    .filter((s) => {
      const groupKey = s.verdict?.groupKey;
      return Boolean(groupKey && overrides[groupKey]);
    })
    .map((s) => s.ref);

  return NextResponse.json({ answered });
}
