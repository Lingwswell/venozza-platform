"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export default function AdminGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [user, setUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    const token =
      localStorage.getItem("venozza_token") ||
      sessionStorage.getItem("venozza_token");

    const rawUser =
      localStorage.getItem("venozza_user") ||
      sessionStorage.getItem("venozza_user");

    if (!token || !rawUser) {
      router.replace("/admin/login");
      return;
    }

    try {
      const parsedUser = JSON.parse(rawUser) as AdminUser;
      setUser(parsedUser);
      setAuthorized(true);
    } catch {
      localStorage.removeItem("venozza_token");
      localStorage.removeItem("venozza_user");
      sessionStorage.removeItem("venozza_token");
      sessionStorage.removeItem("venozza_user");
      router.replace("/admin/login");
    }
  }, [router]);

  if (!authorized) {
    return (
      <main className="min-h-screen bg-neutral-100 p-6">
        <div className="mx-auto max-w-5xl rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-widest text-orange-600">
            Admin VenoZza
          </p>
          <h1 className="mt-2 text-3xl font-black">Validando acesso...</h1>
          <p className="mt-3 text-neutral-600">
            Aguarde enquanto verificamos sua sessão administrativa.
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-600">
              Admin VenoZza
            </p>
            <h1 className="text-xl font-black text-neutral-900">
              Painel Administrativo
            </h1>
          </div>

          <div className="text-right">
            <p className="text-sm font-semibold text-neutral-900">
              {user?.name}
            </p>
            <p className="text-xs text-neutral-500">
              {user?.email} • {user?.role}
            </p>
          </div>
        </div>
      </div>

      {children}
    </>
  );
}
