"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, LocateFixed, MapPin, X } from "lucide-react";
import { getMobileStoreContext, setMobileStoreContext } from "@/lib/mobile-store-context";

type PickerStore = {
  id: string;
  name: string;
  slug: string;
  tenantId: string;
  address: string | null;
  hasLocation: boolean;
  distanceKm: number | null;
  deliveryRadiusKm: number | null;
  deliversHere: boolean | null;
  status: { open: boolean; message: string };
};

type StoresResponse = {
  ok?: boolean;
  error?: string;
  tenant?: { name: string };
  stores?: PickerStore[];
  suggestedStoreId?: string | null;
};

type GeoState = "idle" | "asking" | "ok" | "denied" | "unavailable" | "insecure";

type Props = {
  open: boolean;
  /** Primeira visita: tenta a localizacao sozinho e escolhe a loja mais perto. */
  automatic?: boolean;
  /** Sem onClose o seletor nao pode ser fechado sem escolher (primeira visita). */
  onClose?: () => void;
};

function formatKm(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
}

export default function StorePicker({ open, automatic = false, onClose }: Props) {
  const [stores, setStores] = useState<PickerStore[]>([]);
  const [tenantName, setTenantName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [geo, setGeo] = useState<GeoState>("idle");
  const autoTried = useRef(false);
  // Evita que a localizacao chegue depois e troque uma loja que o cliente ja escolheu.
  const chosen = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  // Guardado em ref para o efeito de abertura nao rodar de novo a cada render do pai.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const currentStoreId = open ? getMobileStoreContext().storeId : "";

  const choose = useCallback(
    (store: PickerStore) => {
      chosen.current = true;
      setMobileStoreContext({
        tenantId: store.tenantId,
        storeId: store.id,
        storeName: store.name,
        storeSlug: store.slug,
      });
      onCloseRef.current?.();
    },
    []
  );

  const fetchStores = useCallback(
    async (coords?: { lat: number; lng: number }, autoSelect = false) => {
      setLoading(true);
      setError("");
      try {
        const query = coords ? `?lat=${coords.lat}&lng=${coords.lng}` : "";
        const res = await fetch(`/api/stores${query}`, { cache: "no-store" });
        const data: StoresResponse = await res.json().catch(() => ({}));

        if (!res.ok || !data.ok) throw new Error(data.error || "Erro ao carregar as lojas.");

        const list = data.stores || [];
        setStores(list);
        setTenantName(data.tenant?.name || "");

        if (!alive.current) return;

        if (autoSelect && !chosen.current && data.suggestedStoreId) {
          const suggested = list.find((s) => s.id === data.suggestedStoreId);
          if (suggested) choose(suggested);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar as lojas.");
      } finally {
        setLoading(false);
      }
    },
    [choose]
  );

  const locate = useCallback(
    (autoSelect: boolean) => {
      if (typeof window === "undefined" || !("geolocation" in navigator)) {
        setGeo("unavailable");
        return;
      }
      // Navegadores so liberam a localizacao em HTTPS (ou localhost).
      if (!window.isSecureContext) {
        setGeo("insecure");
        return;
      }

      setGeo("asking");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!alive.current) return;
          setGeo("ok");
          fetchStores(
            { lat: position.coords.latitude, lng: position.coords.longitude },
            autoSelect
          );
        },
        (err) => {
          if (!alive.current) return;
          setGeo(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
      );
    },
    [fetchStores]
  );

  useEffect(() => {
    if (!open) return;
    chosen.current = false;

    // Lista sem distancia primeiro; se a rede so tem uma loja, ja escolhe.
    fetchStores(undefined, automatic);

    if (automatic && !autoTried.current) {
      autoTried.current = true;
      locate(true);
    }
  }, [open, automatic, fetchStores, locate]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 sm:items-center">
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#d61717]">
              {tenantName || "Escolha a loja"}
            </p>
            <h2 className="mt-1 text-xl font-black text-[#171717]">De qual loja você quer pedir?</h2>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f4efed] text-[#444]"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => locate(false)}
          disabled={geo === "asking"}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#f1d6cf] bg-[#fff4f1] px-4 py-3 text-sm font-black text-[#c4161c] disabled:opacity-60"
        >
          <LocateFixed className="h-4 w-4" />
          {geo === "asking" ? "Procurando sua localização..." : "Usar minha localização"}
        </button>

        {geo === "denied" ? (
          <p className="mb-3 rounded-2xl bg-[#fff8e6] px-4 py-3 text-xs font-semibold text-[#8a5a00]">
            Localização bloqueada. Escolha a loja na lista ou libere a localização nas configurações do navegador.
          </p>
        ) : geo === "insecure" ? (
          <p className="mb-3 rounded-2xl bg-[#fff8e6] px-4 py-3 text-xs font-semibold text-[#8a5a00]">
            A localização só funciona quando o site está em HTTPS. Escolha a loja na lista.
          </p>
        ) : geo === "unavailable" ? (
          <p className="mb-3 rounded-2xl bg-[#fff8e6] px-4 py-3 text-xs font-semibold text-[#8a5a00]">
            Não foi possível pegar sua localização. Escolha a loja na lista.
          </p>
        ) : null}

        {error ? (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>
        ) : loading && stores.length === 0 ? (
          <p className="py-6 text-center text-sm font-semibold text-[#777]">Carregando lojas...</p>
        ) : stores.length === 0 ? (
          <p className="py-6 text-center text-sm font-semibold text-[#777]">Nenhuma loja disponível.</p>
        ) : (
          <ul className="space-y-2">
            {stores.map((store) => {
              const selected = store.id === currentStoreId;
              return (
                <li key={store.id}>
                  <button
                    type="button"
                    onClick={() => choose(store)}
                    className={[
                      "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99]",
                      selected ? "border-[#d61717] bg-[#fff4f1]" : "border-[#eee3de] bg-white hover:border-[#e8b4a8]",
                    ].join(" ")}
                  >
                    <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#d61717]" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-black text-[#171717]">{store.name}</span>
                        {selected ? <Check className="h-4 w-4 shrink-0 text-[#d61717]" /> : null}
                      </span>
                      {store.address ? (
                        <span className="mt-0.5 block text-xs text-[#6f6f6f]">{store.address}</span>
                      ) : null}
                      <span className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] font-bold">
                        {store.distanceKm !== null ? (
                          <span className="rounded-full bg-[#f4efed] px-2 py-0.5 text-[#444]">
                            {formatKm(store.distanceKm)}
                          </span>
                        ) : null}
                        {store.deliversHere === false ? (
                          <span className="rounded-full bg-[#fff1e0] px-2 py-0.5 text-[#9a5b00]">Fora da área de entrega</span>
                        ) : store.deliversHere === true ? (
                          <span className="rounded-full bg-[#e8f7ee] px-2 py-0.5 text-[#167a3e]">Entrega no seu endereço</span>
                        ) : null}
                        <span
                          className={[
                            "rounded-full px-2 py-0.5",
                            store.status.open ? "bg-[#e8f7ee] text-[#167a3e]" : "bg-[#fdecec] text-[#b3261e]",
                          ].join(" ")}
                        >
                          {store.status.open ? "Aberta" : "Fechada"}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
