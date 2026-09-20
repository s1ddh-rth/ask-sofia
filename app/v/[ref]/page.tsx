// Shared verdict view. Built in P6.
export default async function SharePage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  return <main className="p-6 font-mono text-sm">Verdict {ref}</main>;
}
