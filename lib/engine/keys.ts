// group_key is item_id || ':' || job. Questions group by this and only this,
// never by text similarity. Kept apart from the loader so client code can use
// it without pulling zod and the whole data file into the bundle.
export function groupKey(itemId: string | null, job: string): string {
  return `${itemId ?? "unknown"}:${job}`;
}
