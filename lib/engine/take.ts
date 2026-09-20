// What her take reads as on a card.
//
// The verdict type alone is not enough. The grey knit is an investment piece
// on paper, but her "soft but pills" is a hard caveat and rule 3 says that
// beats the type, so the engine always returns SKIP for it. Showing "Worth
// the money" above a verdict of "Skip it" is the label contradicting the
// answer, so the label is derived the same way the verdict is.

import type { Copy, Item } from "./types";

// True when no context can produce anything but SKIP.
export function alwaysSkips(item: Item): boolean {
  return item.verdictType === "avoid" || item.caveat?.severity === "hard";
}

export function takeLabel(item: Item, copy: Copy): string {
  if (alwaysSkips(item)) return copy.takeLabels.avoid;
  return copy.takeLabels[item.verdictType];
}
