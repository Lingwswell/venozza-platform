"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type StoredUser = {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
};

export default function RoleGuard({
  allow,
  redirectTo,
  children,
}: {
  allow: string[];
  redirectTo: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);

  const normalizedAllow = useMemo(
    () => allow.map((item) => String(item || "").toLowerCase()),
    [allow]
  );

  useEffect(() => {
    const rawUser =
      localStorage.getItem("venozza_user") ||
      sessionStorage.getItem("venozza_user");

    const token =
      localStorage.getItem("venozza_token") ||
      sessionStorage.getItem("venozza_token");

    if (!token || !rawUser) {
      router.replace("/admin/login");
      return;
    }

    try {
      const user = JSON.parse(rawUser) as StoredUser;
      const role = String(user?.role || "").toLowerCase();

      if (!normalizedAllow.includes(role)) {
        router.replace(redirectTo);
        return;
      }

      setAllowed(true);
      setReady(true);
    } catch {
      router.replace("/admin/login");
    }
  }, [normalizedAllow, redirectTo, router]);

  if (!ready || !allowed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f4f7fb] text-slate-900">
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-orange-600">
            VenoZza
          </p>
          <h1 className="mt-2 text-2xl font-black text-slate-900">
            Validando acesso...
          </h1>
          <p className="mt-2 text-slate-500">
            Aguarde enquanto verificamos sua permissão.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
