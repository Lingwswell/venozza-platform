"use client";

import RoleGuard from "@/components/admin/RoleGuard";
import KDSBoard from "@/components/admin/KDSBoard";

export default function StoreKDSPage() {
  return (
    <RoleGuard allow={["operator", "owner", "super_admin"]} redirectTo="/admin/dashboard">
      <main className="min-h-screen bg-neutral-950 text-white">
        <div className="mx-auto max-w-[1800px] p-4 md:p-6">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                KDS da Loja
              </h1>
              <p className="text-sm text-neutral-400 md:text-base">
                Painel operacional local da cozinha.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-neutral-300">
              Fluxo: <span className="text-white">novo → preparo → pronto → saiu_entrega</span>
            </div>
          </div>

          <KDSBoard mode="store" />
        </div>
      </main>
    </RoleGuard>
  );
}
