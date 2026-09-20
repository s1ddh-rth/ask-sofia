// Anonymous instrumentation, client side.
//
// The evidence says the decision happens over days, often ends somewhere
// else, and frequently passes through a friend. None of that is visible to
// an affiliate click, so it has to be measured directly. What is measured is
// deliberately thin: a random id this browser made up for itself, what
// happened, and which piece it happened to.

const ID_KEY = "asksofia.browser.v1";

export function browserId(): string {
  try {
    const existing = window.localStorage.getItem(ID_KEY);
    if (existing) return existing;
    const made = crypto.randomUUID();
    window.localStorage.setItem(ID_KEY, made);
    return made;
  } catch {
    // A private window gets a fresh id each time, which is the right
    // behaviour rather than a problem to work around.
    return "anon-" + Math.random().toString(36).slice(2, 12);
  }
}

export type TrackInput = {
  kind: "shown" | "saved" | "returned" | "shared" | "share_opened" | "checkin";
  itemId?: string | null;
  groupKey?: string | null;
  verdictCall?: string | null;
  detail?: string | null;
  ref?: string | null;
};

// Fire and forget. Nothing a person sees ever waits on this, and a failure
// changes nothing on screen.
export function track(input: TrackInput): void {
  try {
    void fetch("/api/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ browserId: browserId(), ...input }),
    }).catch(() => {});
  } catch {
    // Never worth an error in front of anyone.
  }
}
