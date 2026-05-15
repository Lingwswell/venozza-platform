"use client";

import RoleGuard from "@/components/admin/RoleGuard";
import KDSBoard from "@/components/admin/KDSBoard";

export default function AdminKDSPage() {
  return (
    <RoleGuard allow={["owner", "operator", "super_admin"]} redirectTo="/admin/dashboard">
      <main className="min-h-screen bg-neutral-950 text-white">
        <div className="mx-auto max-w-[1800px] p-4 md:p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">KDS Central</h1>
            <p className="text-neutral-400">
              Monitoramento operacional por loja
            </p>
          </div>

          <KDSBoard mode="admin" />
        </div>
      </main>
    </RoleGuard>
  );
}
