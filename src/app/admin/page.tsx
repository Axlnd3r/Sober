import { AdminConsole } from "@/components/AdminConsole";
import { session } from "@/lib/auth";
import { mode } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = mode === "live" ? await session().catch(() => null) : null;
  if (!admin?.admin) return <div className="container utility-page"><div className="page-heading"><h1>Admin access</h1><p>Connect an allowlisted wallet and sign in to manage match rooms.</p></div></div>;
  return <AdminConsole />;
}
