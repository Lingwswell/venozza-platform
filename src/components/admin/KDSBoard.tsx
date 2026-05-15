"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchWithAuth } from "@/lib/auth/fetch-auth";

type KDSStatus =
  | "novo"
  | "preparo"
  | "pronto"
  | "saiu_entrega"
  | "finalizado"
  | "cancelado";

type StoreOption = {
  id: string;
  name: string;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
};

type OrderItem = {
  id: string;
  productId?: string | null;
  name: string;
  quantity: number;
  price_cents: number;
  total_cents: number;
  note?: string | null;
  size?: string | null;
  crust?: string | null;
  addons_json?: string | null;
  createdAt?: string;
};

type Order = {
  id: string;
  orderCode: string;
  customerName: string;
  status: KDSStatus;
  total_cents: number;
  createdAt: string;
  storeId?: string;
  tenantId?: string;
  items?: OrderItem[];
  store?: {
    id: string;
    name: string;
    slug?: string | null;
  } | null;
};

const COLUMNS: KDSStatus[] = ["novo", "preparo", "pronto", "saiu_entrega"];
const SLA_WARNING_MINUTES = 20;
const SLA_CRITICAL_MINUTES = 40;


const STATUS_META: Record<
  KDSStatus,
  {
    label: string;
    action?: string;
    next?: KDSStatus;
  }
> = {
  novo: {
    label: "🆕 Novo",
    action: "Iniciar preparo",
    next: "preparo",
  },
  preparo: {
    label: "👨‍🍳 Preparo",
    action: "Marcar pronto",
    next: "pronto",
  },
  pronto: {
    label: "✅ Pronto",
    action: "Saiu para entrega",
    next: "saiu_entrega",
  },
  saiu_entrega: {
    label: "🚚 Saiu entrega",
    action: "Finalizar",
    next: "finalizado",
  },
  finalizado: {
    label: "Finalizado",
  },
  cancelado: {
    label: "Cancelado",
  },
};

function money(cents: number) {
  return (Number(cents || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function parseAddonsJson(value?: string | null) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function getMinutesWaiting(createdAt: string) {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - created) / 60000));
}

function getWaitingLevel(minutes: number) {
  if (minutes >= SLA_CRITICAL_MINUTES) return "critical";
  if (minutes >= SLA_WARNING_MINUTES) return "warning";
  return "ok";
}

function getWaitingBadge(minutes: number) {
  const level = getWaitingLevel(minutes);
  if (level === "critical") return "text-red-300 border-red-500/30 bg-red-500/10";
  if (level === "warning") return "text-amber-300 border-amber-500/30 bg-amber-500/10";
  return "text-emerald-300 border-emerald-500/30 bg-emerald-500/10";
}

function getCardRing(minutes: number, status: KDSStatus) {
  if (status === "novo" && minutes >= SLA_WARNING_MINUTES) {
    return "border-amber-500/40 shadow-[0_0_0_1px_rgba(245,158,11,0.15)]";
  }
  if (minutes >= SLA_CRITICAL_MINUTES) {
    return "border-red-500/40 shadow-[0_0_0_1px_rgba(239,68,68,0.18)]";
  }
  return "border-white/10";
}

export default function KDSBoard({ mode = "admin" }: { mode?: "admin" | "store" }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [currentStoreId, setCurrentStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyOrderCode, setBusyOrderCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [tvMode, setTvMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [newHighlightMap, setNewHighlightMap] = useState<Record<string, boolean>>({});

  const audioCtxRef = useRef<AudioContext | null>(null);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());

  const playBeep = useCallback(() => {
    if (!soundEnabled) return;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioCtx) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }

      const ctx = audioCtxRef.current;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.value = 0.03;

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.15);
    } catch {
      // ignora falha de áudio no navegador
    }
  }, [soundEnabled]);

  const loadStores = useCallback(async () => {
    const res = await fetchWithAuth("/api/admin/stores");
    const data = await res.json();

    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || "Falha ao carregar lojas");
    }

    setStores(Array.isArray(data.stores) ? data.stores : []);
    setRole(data.role || "");
    setCurrentStoreId(data.currentStoreId || null);

    if (data.role !== "owner" && data.currentStoreId) {
      setSelectedStoreId(data.currentStoreId);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const query =
        role === "owner" && selectedStoreId
          ? `?storeId=${encodeURIComponent(selectedStoreId) }`
          : "";

      const res = await fetchWithAuth(`/api/admin/kds${query}`);
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Falha ao carregar KDS");
      }

      const incomingOrders: Order[] = Array.isArray(data.orders) ? data.orders : [];

      const previousIds = knownOrderIdsRef.current;
      const nextIds = new Set(incomingOrders.map((o) => o.id));
      const newOrders = incomingOrders.filter((o) => !previousIds.has(o.id));

      if (previousIds.size > 0 && newOrders.length > 0) {
        playBeep();

        setNewHighlightMap((prev) => {
          const next = { ...prev };
          for (const order of newOrders) {
            next[order.id] = true;
          }
          return next;
        });

        window.setTimeout(() => {
          setNewHighlightMap((prev) => {
            const next = { ...prev };
            for (const order of newOrders) {
              delete next[order.id];
            }
            return next;
          });
        }, 12000);
      }

      knownOrderIdsRef.current = nextIds;
      setOrders(incomingOrders);
      setError(null);
      setLastSync(new Date().toLocaleTimeString("pt-BR"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar KDS");
    } finally {
      setLoading(false);
    }
  }, [role, selectedStoreId, playBeep]);

  const loadAll = useCallback(async () => {
    try {
      await loadStores();
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar painel");
      setLoading(false);
    }
  }, [loadStores, loadOrders]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!role) return;

    loadOrders();

    const timer = setInterval(loadOrders, 15000);

    const token =
      localStorage.getItem("venozza_token") ||
      sessionStorage.getItem("venozza_token") ||
      "";

    const streamUrl = token
      ? `/api/admin/kds/stream?token=${encodeURIComponent(token) }`
      : "/api/admin/kds/stream";

    console.log("[KDS] streamUrl:", streamUrl);
    const eventSource = new EventSource(streamUrl);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        if (
          payload?.type === "order_created" ||
          payload?.type === "order_status_changed"
        ) {
          loadOrders();
        }
      } catch {
        // ignora payload inválido
      }
    };

    eventSource.onerror = () => {
      // o browser tenta reconectar sozinho
    };

    return () => {
      clearInterval(timer);
      eventSource.close();
    };
  }, [loadOrders, role]);

  async function advance(order: Order) {
    const nextStatus = STATUS_META[order.status]?.next;
    if (!nextStatus) return;

    const previousOrders = orders;

    setOrders((current) =>
      current.map((item) =>
        item.id === order.id
          ? {
              ...item,
              status: nextStatus,
            }
          : item
      )
    );

    try {
      setBusyOrderCode(order.orderCode);

      const res = await fetchWithAuth(`/api/orders/${order.orderCode}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: nextStatus,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Falha ao atualizar status");
      }

      await loadOrders();
    } catch (err) {
      setOrders(previousOrders);
      setError(err instanceof Error ? err.message : "Erro ao atualizar status");
    } finally {
      setBusyOrderCode(null);
    }
  }

  const grouped = useMemo(() => {
    return COLUMNS.reduce((acc, status) => {
      acc[status] = orders.filter((o) => o.status === status);
      return acc;
    }, {} as Record<KDSStatus, Order[]>);
  }, [orders]);

  const criticalCount = useMemo(() => {
    return orders.filter((o) => getMinutesWaiting(o.createdAt) >= SLA_CRITICAL_MINUTES).length;
  }, [orders]);

  const stats = useMemo(() => {
    const total = orders.length;
    const novo = grouped.novo?.length || 0;
    const preparo = grouped.preparo?.length || 0;
    const pronto = grouped.pronto?.length || 0;
    const saiu = grouped.saiu_entrega?.length || 0;

    return { total, novo, preparo, pronto, saiu };
  }, [orders, grouped]);

  return (
    <div className={tvMode ? "space-y-6" : "space-y-5"}>
      <div className={`grid gap-3 ${tvMode ? "xl:grid-cols-7" : "md:grid-cols-2 xl:grid-cols-7"}`}>
        <div className="rounded-2xl border border-white/10 bg-neutral-900 p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-400">Total no KDS</div>
          <div className="mt-2 text-3xl font-bold">{stats.total}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-neutral-900 p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-400">Novo</div>
          <div className="mt-2 text-3xl font-bold">{stats.novo}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-neutral-900 p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-400">Preparo</div>
          <div className="mt-2 text-3xl font-bold">{stats.preparo}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-neutral-900 p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-400">Pronto</div>
          <div className="mt-2 text-3xl font-bold">{stats.pronto}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-neutral-900 p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-400">Saiu entrega</div>
          <div className="mt-2 text-3xl font-bold">{stats.saiu}</div>
        </div>

        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
          <div className="text-xs uppercase tracking-wide text-red-200">Críticos</div>
          <div className="mt-2 text-3xl font-bold text-white">{criticalCount}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-neutral-900 p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-400">Escopo</div>
          <div className="mt-2 text-sm font-semibold text-white">
            {role === "owner"
              ? selectedStoreId
                ? "Loja filtrada"
                : "Todas as lojas"
              : "Minha loja"}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="text-sm text-neutral-300">
            {loading ? "Carregando painel..." : "Painel multi-loja ativo e monitorando pedidos."}
          </div>

          {mode === "admin" && role === "owner" ? (
            <div className="flex items-center gap-2">
              <label className="text-sm text-neutral-400">Loja</label>
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="">Todas as lojas</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
          ) : mode === "admin" ? (
            <div className="rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-neutral-300">
              Loja atual:{" "}
              <span className="font-semibold text-white">
                {stores.find((s) => s.id === currentStoreId)?.name || "Minha loja"}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setSoundEnabled((v) => !v)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10"
          >
            {soundEnabled ? "🔔 Som ligado" : "🔕 Som desligado"}
          </button>

          <button
            type="button"
            onClick={() => setTvMode((v) => !v)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10"
          >
            {tvMode ? "Sair modo TV" : mode === "store" ? "Modo TV Loja" : "Modo TV"}
          </button>

          {lastSync ? (
            <span className="text-xs text-neutral-400">Última atualização: {lastSync}</span>
          ) : null}

          <button
            type="button"
            onClick={loadOrders}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10"
          >
            Atualizar agora
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className={`grid gap-4 ${tvMode ? "2xl:grid-cols-4 xl:grid-cols-2" : "xl:grid-cols-4"}`}>
        {COLUMNS.map((status) => (
          <section
            key={status}
            className="rounded-2xl border border-white/10 bg-neutral-900 p-4"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className={tvMode ? "text-lg font-semibold" : "text-base font-semibold"}>
                {STATUS_META[status].label}
              </h2>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-neutral-300">
                {grouped[status]?.length || 0}
              </span>
            </div>

            <div className="space-y-3">
              {(grouped[status] || []).map((order) => {
                const waiting = getMinutesWaiting(order.createdAt);
                const isNew = !!newHighlightMap[order.id];
                const level = getWaitingLevel(waiting);

                return (
                  <article
                    key={order.id}
                    className={[
                      "rounded-2xl bg-neutral-950 p-4 transition",
                      getCardRing(waiting, order.status),
                      isNew ? "ring-2 ring-emerald-400/40" : "border",
                    ].join(" ")}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <div className={tvMode ? "text-xl font-bold tracking-tight" : "text-lg font-bold tracking-tight"}>
                          {order.orderCode}
                        </div>
                        <div className={tvMode ? "text-base text-neutral-300" : "text-sm text-neutral-400"}>
                          {order.customerName || "Sem nome"}
                        </div>
                      </div>

                      <div
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getWaitingBadge(waiting)}`}
                      >
                        {waiting} min
                      </div>
                    </div>

                    {isNew ? (
                      <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200">
                        Novo pedido detectado
                      </div>
                    ) : null}

                    {level === "critical" ? (
                      <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">
                        Pedido crítico — atenção imediata
                      </div>
                    ) : null}

                    {order.items?.length ? (
                      <div className="mb-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                          Itens do pedido
                        </div>

                        <div className="mt-2 space-y-2">
                          {order.items.map((item) => {
                            const addons = parseAddonsJson(item.addons_json);

                            return (
                              <div
                                key={item.id}
                                className="rounded-xl bg-neutral-900/80 px-3 py-2 text-xs text-neutral-300"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="font-semibold text-white">
                                    {item.quantity}x {item.name}
                                  </div>
                                  <div className="shrink-0 font-semibold text-orange-200">
                                    {money(item.total_cents)}
                                  </div>
                                </div>

                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {item.size ? (
                                    <span className="rounded-full bg-blue-500/10 px-2 py-1 text-blue-200">
                                      {item.size}
                                    </span>
                                  ) : null}

                                  {item.crust ? (
                                    <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-200">
                                      {item.crust}
                                    </span>
                                  ) : null}

                                  {addons.map((addon, index) => (
                                    <span
                                      key={`${item.id}-addon-${index}`}
                                      className="rounded-full bg-white/10 px-2 py-1 text-neutral-200"
                                    >
                                      {addon}
                                    </span>
                                  ))}
                                </div>

                                {item.note ? (
                                  <div className="mt-2 rounded-lg bg-orange-500/10 px-2 py-1 text-orange-100">
                                    Obs: {item.note}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-2 text-sm text-neutral-300">
                      <div className="rounded-xl bg-white/5 px-3 py-2">
                        <div className="text-[11px] uppercase tracking-wide text-neutral-500">Total</div>
                        <div className="mt-1 font-semibold text-white">{money(order.total_cents) }</div>
                      </div>

                      <div className="rounded-xl bg-white/5 px-3 py-2">
                        <div className="text-[11px] uppercase tracking-wide text-neutral-500">Horário</div>
                        <div className="mt-1 font-semibold text-white">
                          {new Date(order.createdAt).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          }) }
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-xs text-neutral-400">
                      Loja:{" "}
                      <span className="text-neutral-200">
                        {order.store?.name || order.storeId || "não informada"}
                      </span>
                    </div>

                    {STATUS_META[order.status]?.next ? (
                      <button
                        type="button"
                        onClick={() => advance(order) }
                        disabled={busyOrderCode === order.orderCode}
                        className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyOrderCode === order.orderCode
                          ? "Atualizando..."
                          : STATUS_META[order.status].action}
                      </button>
                    ) : null}
                  </article>
                );
              }) }

              {!grouped[status]?.length ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-neutral-950 p-6 text-center text-sm text-neutral-500">
                  Nenhum pedido nesta coluna
                </div>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
