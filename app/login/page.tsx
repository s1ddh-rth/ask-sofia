import { studioConfigured } from "@/lib/session";
import LoginForm from "./form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in — Ask Sofia" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  // Only ever redirect back inside this app. A second character of / or \
  // resolves to another origin, because browsers read a backslash in a path
  // as a slash, so /\evil.com would leave the site. Repeating the parameter
  // hands us an array rather than a string, so take the first one.
  const wanted = Array.isArray(next) ? next[0] : next;
  const target =
    typeof wanted === "string" && /^\/[^/\\]/.test(wanted) ? wanted : "/studio";

  return (
    <main className="mx-auto w-full max-w-sm px-5 pb-20 pt-16">
      <p className="label">Case 002 / Her desk</p>
      <h1 className="font-heading mt-2 text-4xl font-bold uppercase leading-[0.95]">
        Sign in
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        The studio is where Sofia answers. Everything the audience sees stays
        open without this.
      </p>
      {studioConfigured() ? (
        <LoginForm next={target} demoUser={process.env.STUDIO_USER ?? ""} />
      ) : (
        <p className="mt-8 rounded-sm border border-rust/40 bg-rust/5 p-4 text-[15px] leading-relaxed">
          The studio login is not configured on this deployment. It needs
          STUDIO_USER, STUDIO_PASSWORD and SESSION_SECRET in the environment,
          and a redeploy after they are set.
        </p>
      )}
    </main>
  );
}
