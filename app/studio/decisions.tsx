import type { EventRow } from "@/lib/store";

// The panel that answers the 16:00 evidence.
//
// E-09 says 62% of high value buyers never clicked her affiliate link, and
// E-10 says 7 of 9 buyers never clicked while every one of those saved at
// least three looks and came back at least twice. So her affiliate dashboard
// is measuring the wrong thing, and measuring it late. This counts the
// decision instead.

const CHECKIN_LABELS: Record<string, string> = {
  "her-link": "Through her link",
  "somewhere-else": "Somewhere else",
  "not-buying": "Not buying",
  "still-deciding": "Still deciding",
};

export default function Decisions({
  events,
  shareOpens,
  buyTaps,
}: {
  events: EventRow[];
  // Counted on the shares table itself, server side, so it is the number
  // that has always been right rather than the one that started when event
  // tracking was added.
  shareOpens: number;
  buyTaps: number;
}) {
  const count = (kind: string) => events.filter((e) => e.kind === kind).length;

  const checkins = events.filter((e) => e.kind === "checkin");
  const byAnswer = (key: string) =>
    checkins.filter((e) => e.detail === key).length;

  const bought = byAnswer("her-link") + byAnswer("somewhere-else");
  const elsewhere = byAnswer("somewhere-else");
  const sampled = events.some((e) => e.sample);

  const headline = [
    ["Verdicts given", count("shown")],
    ["Saved", count("saved")],
    ["Came back", count("returned")],
    ["Shared", count("shared")],
    ["Shares opened", shareOpens],
    ["Buy taps", buyTaps],
  ] as const;

  return (
    <div className="mt-3 rounded-sm border border-ink/10 bg-card p-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        {headline.map(([label, value]) => (
          <div key={label}>
            <dt className="label">{label}</dt>
            <dd className="font-heading text-3xl font-bold leading-none">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 border-t border-ink/10 pt-4">
        <p className="label">Did you buy it?</p>
        <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(CHECKIN_LABELS).map(([key, label]) => (
            <div key={key}>
              <dt className="label">{label}</dt>
              <dd
                className={`font-heading text-2xl font-bold leading-none ${
                  key === "somewhere-else" ? "text-rust" : ""
                }`}
              >
                {byAnswer(key)}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {bought > 0 ? (
        <p className="mt-4 border-l-2 border-rust pl-3 text-[15px] leading-relaxed">
          {elsewhere} of {bought} people who bought did it somewhere other than
          your link. Those are the decisions and the purchases your affiliate
          clicks never see.
        </p>
      ) : (
        <p className="mt-4 border-l-2 border-ink/20 pl-3 text-[15px] leading-relaxed text-muted">
          Once people start answering, this shows the decisions and the
          purchases your affiliate clicks never see.
        </p>
      )}

      {sampled ? (
        <p className="label mt-4">
          Includes sample data, marked as such in the events table
        </p>
      ) : null}
    </div>
  );
}
