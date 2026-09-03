import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthorPublishingAccess } from "@/lib/author-publishing-access";
import NewBookDirectUpload from "./NewBookDirectUpload";

export const dynamic = "force-dynamic";

export default async function NewBookPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect(`/auth?next=${encodeURIComponent("/dashboard/books/new")}`);
  }

  const access = await getAuthorPublishingAccess(user.id);

  if (!access.allowed) {
    redirect("/publish");
  }

  return <NewBookDirectUpload />;
}
