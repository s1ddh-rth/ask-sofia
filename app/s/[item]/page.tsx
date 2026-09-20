// Audience view. Built in P3.
export default async function ItemPage({
  params,
}: {
  params: Promise<{ item: string }>;
}) {
  const { item } = await params;
  return <main className="p-6 font-mono text-sm">Item {item}</main>;
}
