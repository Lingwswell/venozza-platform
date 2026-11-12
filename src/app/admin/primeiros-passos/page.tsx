"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { fetchWithAuth } from "@/lib/auth/fetch-auth";

// Primeiros passos de uma rede nova: marca, primeira loja, cardapio e site.

type Status = {
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
  onboarded: boolean;
  stores: number;
  products: number;
  optionGroups: number;
  siteUrl: string | null;
};

const COLORS = ["#B91C1C", "#C2410C", "#15803D", "#1D4ED8", "#7E22CE", "#1C1917"];

const input = "w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold outline-none focus:border-orange-400";
const card = "rounded-3xl border border-slate-200 bg-white p-5 shadow-sm";
const primary = "rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60";
const ghost = "rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50";

function Step({ done, title, children }: { done: boolean; title: string; children: React.ReactNode }) {
  return (
    <section className={`${card} ${done ? "border-emerald-200" : ""}`}>
      <div className="flex items-center gap-3">
        <span
          className={[
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black",
            done ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500",
          ].join(" ")}
          aria-hidden
        >
          {done ? "✓" : "•"}
        </span>
        <h3 className="text-lg font-black text-slate-900">{title}</h3>
      </div>
      <div className="mt-3 pl-11">{children}</div>
    </section>
  );
}

export default function PrimeirosPassosPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [brand, setBrand] = useState({ name: "", logoUrl: "", brandColor: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/admin/onboarding");
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Erro ao carregar.");
      setStatus(data);
      setBrand((b) => ({
        name: b.name || data.name || "",
        logoUrl: b.logoUrl || data.logoUrl || "",
        brandColor: b.brandColor || data.brandColor || "",
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function post(body: Record<string, unknown>, done: string) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetchWithAuth("/api/admin/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Erro ao salvar.");
      setSuccess(done);
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function uploadLogo(file: File) {
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetchWithAuth("/api/admin/uploads/product-image", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) throw new Error(data?.error || "Erro ao enviar a imagem.");
      setBrand((b) => ({ ...b, logoUrl: data.url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar a imagem.");
    } finally {
      setBusy(false);
    }
  }

  const brandDone = Boolean(status && (status.logoUrl || status.brandColor));
  const storeDone = Boolean(status && status.stores > 0);
  const menuDone = Boolean(status && status.products > 0 && status.optionGroups > 0);

  return (
    <AdminShell title="Primeiros passos" subtitle="Quatro passos para a sua rede começar a vender.">
      <div className="flex max-w-3xl flex-col gap-4">
        {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        {success ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{success}</p> : null}

        {!status ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : (
          <>
            <Step done={brandDone} title="Sua marca">
              <p className="text-sm text-slate-600">Nome e logo aparecem no topo do site e do app.</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <input className={input} value={brand.name} onChange={(e) => setBrand({ ...brand, name: e.target.value })} placeholder="Nome da pizzaria" />
                <label className={`${ghost} cursor-pointer text-center`}>
                  {brand.logoUrl ? "Trocar logo" : "Enviar logo (PNG, JPG ou WebP)"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadLogo(file);
                    }}
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Cor do nome:</span>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Cor ${c}`}
                    onClick={() => setBrand({ ...brand, brandColor: c })}
                    className={["h-8 w-8 rounded-full ring-offset-2", brand.brandColor === c ? "ring-2 ring-slate-900" : ""].join(" ")}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div className="mt-3 flex items-center gap-4">
                {brand.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brand.logoUrl} alt="Logo" className="h-12 w-auto max-w-[180px] object-contain" />
                ) : (
                  <span className="text-2xl font-black" style={{ color: brand.brandColor || "#B91C1C" }}>
                    {brand.name || "Sua pizzaria"}
                  </span>
                )}
                <button type="button" disabled={busy} onClick={() => post({ action: "brand", ...brand }, "Marca salva.")} className={primary}>
                  Salvar marca
                </button>
              </div>
            </Step>

            <Step done={storeDone} title="Primeira loja">
              <p className="text-sm text-slate-600">
                {storeDone
                  ? `${status.stores} loja(s) cadastrada(s).`
                  : "Cadastre o endereço (o CEP preenche o resto), a área de entrega e o horário."}
              </p>
              <Link href="/admin/lojas" className={`${storeDone ? ghost : primary} mt-3 inline-block`}>
                {storeDone ? "Ver lojas" : "Cadastrar loja"}
              </Link>
            </Step>

            <Step done={menuDone} title="Cardápio">
              <p className="text-sm text-slate-600">
                {menuDone
                  ? `${status.products} produto(s) no cardápio.`
                  : "Comece com um cardápio de exemplo (tamanhos, bordas, algumas pizzas e bebidas) e ajuste preços e fotos depois."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {!menuDone ? (
                  <button
                    type="button"
                    disabled={busy || !storeDone}
                    onClick={() => post({ action: "sample_menu" }, "Cardápio de exemplo criado. Ajuste preços e fotos em Produtos.")}
                    className={primary}
                    title={!storeDone ? "Cadastre a loja antes" : undefined}
                  >
                    Criar cardápio de exemplo
                  </button>
                ) : null}
                <Link href="/admin/produtos" className={ghost}>
                  Abrir produtos
                </Link>
              </div>
              {!storeDone ? <p className="mt-2 text-xs text-slate-500">Cadastre a loja antes.</p> : null}
            </Step>

            <Step done={status.onboarded} title="Site no ar">
              <p className="text-sm text-slate-600">
                {status.siteUrl ? (
                  <>
                    Seu site:{" "}
                    <a href={status.siteUrl} target="_blank" rel="noreferrer" className="font-bold text-orange-600 underline">
                      {status.siteUrl.replace(/^https?:\/\//, "")}
                    </a>
                  </>
                ) : (
                  "O endereço do seu site é configurado pela plataforma (domínio próprio ou subdomínio)."
                )}
              </p>
              {!status.onboarded ? (
                <button
                  type="button"
                  disabled={busy || !storeDone || !menuDone}
                  onClick={() => post({ action: "finish" }, "Tudo pronto! Bons pedidos.")}
                  className={`${primary} mt-3`}
                >
                  Concluir
                </button>
              ) : (
                <p className="mt-2 text-sm font-bold text-emerald-700">Concluído.</p>
              )}
            </Step>
          </>
        )}
      </div>
    </AdminShell>
  );
}
