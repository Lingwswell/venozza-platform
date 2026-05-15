"use client";

import AdminShell from "@/components/admin/AdminShell";
import OrdersDashboard from "@/components/admin/OrdersDashboard";

export default function Page() {
  return (
    <AdminShell
      title="Pedidos"
      subtitle="Monitoramento em tempo real dos pedidos por loja."
    >
      <OrdersDashboard />
    </AdminShell>
  );
}
