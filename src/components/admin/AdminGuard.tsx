"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthToken } from "@/lib/auth/token";

type Props = {
  children: React.ReactNode;
};

export default function AdminGuard({ children }: Props) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getAuthToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-white">
        <div className="text-sm opacity-80">Validando acesso do admin...</div>
      </main>
    );
  }

  return <>{children}</>;
}
