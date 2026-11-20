import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Alias — Captain POS lives at take-order with full POS capabilities. */
export default async function CaptainPosAliasPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table?: string | string[] }>;
}) {
  const { slug } = await params;
  const raw = (await searchParams).table;
  const table = Array.isArray(raw) ? raw[0] : raw;
  // Accept table id (UUID) or table number so deep links from the floor always work.
  const qs = table?.trim() ? `?table=${encodeURIComponent(table.trim())}` : "";
  redirect(`/captain/${slug}/take-order${qs}`);
}
