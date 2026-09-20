import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/store";

export const dynamic = "force-dynamic";

// For checking the deploy before a demo. Reports what is wired up, never
// whether a key is valid, and never any part of a key.
export async function GET() {
  return NextResponse.json({
    ok: true,
    storage: supabaseConfigured ? "supabase" : "memory",
    groq: Boolean(process.env.GROQ_API_KEY),
    model: process.env.GROQ_MODEL ?? null,
  });
}
