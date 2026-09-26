import { notFound } from "next/navigation";
import { AdminCatalog } from "@/components/directory/AdminCatalog";
const sections = [
  "listings",
  "categories",
  "areas",
  "tags",
  "groups",
  "navigation",
  "imports",
  "analytics",
  "settings",
] as const;
export default async function AdminSection({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.includes(section as (typeof sections)[number])) notFound();
  return <AdminCatalog section={section as (typeof sections)[number]} />;
}
