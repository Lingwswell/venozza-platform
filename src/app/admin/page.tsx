"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/dashboard");
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f4f7fb] text-slate-900">
      <div className="rounded-3xl border border-slate-200 bg-white px-8 py-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-orange-600">
          Admin VenoZza
        </p>
        <h1 className="mt-2 text-2xl font-black text-slate-900">
          Redirecionando...
        </h1>
        <p className="mt-2 text-slate-500">
          Abrindo o painel administrativo.
        </p>
      </div>
    </main>
  );
}
