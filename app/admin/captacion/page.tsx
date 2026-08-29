import AudienceCenterClient from "@/components/admin/AudienceCenterClient";
import { getAudienceCenterData } from "@/lib/admin/audience-center";
import { requireAdminPage } from "@/lib/admin/superadmin";

export const dynamic = "force-dynamic";

export default async function AdminCaptacionPage() {
  await requireAdminPage("audience.read");
  const data = await getAudienceCenterData();

  return <AudienceCenterClient data={data} />;
}
