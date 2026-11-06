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
  const qs = table && /^\d{1,4}$/.test(table) ? `?table=${table}` : "";
  redirect(`/captain/${slug}/take-order${qs}`);
}
