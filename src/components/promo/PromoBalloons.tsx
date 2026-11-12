"use client";

import { useEffect, useState } from "react";
import Balloon from "@/components/promo/Balloon";

// Baloes de promocao subindo pela tela (site e app).
// Clicou: abre o produto da promocao. Aviso sem produto: mostra a mensagem.

export type PublicPromotion = {
  id: string;
  title: string;
  message: string | null;
  kind: string;
  color: string;
  emoji: string | null;
  badge: string | null;
  product: {
    id: string;
    name: string;
    image: string | null;
    priceCents: number;
    originalPriceCents: number;
  } | null;
};

const DISMISS_KEY = "venozza_promo_dismissed";
const MAX_BALLOONS = 3;

function readDismissed(): string[] {
  try {
    const raw = window.sessionStorage.getItem(DISMISS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.map(String) : [];
  } catch {
    return [];
  }
}

function saveDismissed(ids: string[]) {
  try {
    window.sessionStorage.setItem(DISMISS_KEY, JSON.stringify(ids));
  } catch {
    // sem storage: so some nesta visita
  }
}

function randomLeft(variant: "site" | "app") {
  // No site fica a esquerda para nao cobrir o carrinho lateral.
  const [min, max] = variant === "site" ? [4, 55] : [5, 70];
  return min + Math.random() * (max - min);
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

export default function PromoBalloons({
  storeId,
  variant,
  onOpenProduct,
}: {
  storeId: string;
  variant: "site" | "app";
  onOpenProduct: (productId: string) => void;
}) {
  const [promotions, setPromotions] = useState<PublicPromotion[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<PublicPromotion | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    const load = () =>
      fetch(`/api/promotions?storeId=${encodeURIComponent(storeId)}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && data?.ok) setPromotions(data.promotions || []);
        })
        .catch(() => undefined);
    load();
    // Promocao que comeca ou termina durante a visita aparece/some sozinha.
    const timer = window.setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [storeId]);

  const visible = promotions.filter((p) => !dismissed.includes(p.id)).slice(0, MAX_BALLOONS);
  if (visible.length === 0 && !expanded) return null;

  function dismiss(id: string) {
    const next = Array.from(new Set([...dismissed, id]));
    setDismissed(next);
    saveDismissed(next);
  }

  function open(promo: PublicPromotion) {
    if (promo.product) {
      onOpenProduct(promo.product.id);
    } else {
      setExpanded(promo);
    }
  }

  const size = variant === "site" ? 118 : 92;

  return (
    <>
      <style>{`
        @keyframes venozza-balloon-rise {
          0% { transform: translateY(110vh); }
          100% { transform: translateY(-40vh); }
        }
        @keyframes venozza-balloon-sway {
          0%, 100% { transform: translateX(-14px) rotate(-4deg); }
          50% { transform: translateX(14px) rotate(4deg); }
        }
      `}</style>

      <div aria-label="Promoções" className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
        {reduced ? (
          <div className="absolute bottom-4 left-4 flex flex-col-reverse gap-3">
            {visible.map((promo) => (
              <BalloonButton key={promo.id} promo={promo} size={Math.round(size * 0.8)} onOpen={open} onDismiss={dismiss} />
            ))}
          </div>
        ) : (
          visible.map((promo, index) => (
            <FloatingBalloon
              key={promo.id}
              promo={promo}
              index={index}
              size={size}
              variant={variant}
              onOpen={open}
              onDismiss={dismiss}
            />
          ))
        )}
      </div>

      {expanded ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setExpanded(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={expanded.title}
            className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 flex justify-center">
              <Balloon content={{ title: expanded.title, color: expanded.color, emoji: expanded.emoji }} size={96} />
            </div>
            <h3 className="text-xl font-black text-[#1C1917]">{expanded.title}</h3>
            {expanded.message ? <p className="mt-2 text-sm text-[#57534E]">{expanded.message}</p> : null}
            <button
              type="button"
              onClick={() => setExpanded(null)}
              className="mt-5 w-full rounded-full bg-[#B91C1C] px-5 py-3 text-sm font-bold text-white hover:bg-[#991B1B]"
            >
              Entendi
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function FloatingBalloon({
  promo,
  index,
  size,
  variant,
  onOpen,
  onDismiss,
}: {
  promo: PublicPromotion;
  index: number;
  size: number;
  variant: "site" | "app";
  onOpen: (p: PublicPromotion) => void;
  onDismiss: (id: string) => void;
}) {
  const [left, setLeft] = useState(() => randomLeft(variant));
  const [duration] = useState(() => 18 + Math.random() * 8);
  const [paused, setPaused] = useState(false);

  return (
    <div
      className="absolute top-0"
      style={{
        left: `${left}%`,
        animation: `venozza-balloon-rise ${duration}s linear ${index * 6 + 1.5}s infinite both`,
        animationPlayState: paused ? "paused" : "running",
      }}
      // A cada volta o balao sobe num lugar diferente.
      onAnimationIteration={(e) => {
        if (e.animationName === "venozza-balloon-rise") setLeft(randomLeft(variant));
      }}
    >
      <div
        style={{
          animation: `venozza-balloon-sway ${5 + index}s ease-in-out infinite`,
          animationPlayState: paused ? "paused" : "running",
        }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <BalloonButton promo={promo} size={size} onOpen={onOpen} onDismiss={onDismiss} />
      </div>
    </div>
  );
}

function BalloonButton({
  promo,
  size,
  onOpen,
  onDismiss,
}: {
  promo: PublicPromotion;
  size: number;
  onOpen: (p: PublicPromotion) => void;
  onDismiss: (id: string) => void;
}) {
  const label = promo.product
    ? `Promoção ${promo.title}: ver ${promo.product.name}`
    : `Promoção ${promo.title}`;

  return (
    <div className="pointer-events-auto relative">
      <button
        type="button"
        aria-label={label}
        onClick={() => onOpen(promo)}
        className="block cursor-pointer rounded-full transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1C1917]"
      >
        <Balloon
          size={size}
          content={{
            title: promo.title,
            color: promo.color,
            emoji: promo.emoji,
            image: promo.product?.image || null,
            badge: promo.badge,
            priceCents: promo.kind === "discount" ? promo.product?.priceCents ?? null : null,
            originalPriceCents: promo.kind === "discount" ? promo.product?.originalPriceCents ?? null : null,
          }}
        />
      </button>
      <button
        type="button"
        aria-label={`Fechar promoção ${promo.title}`}
        onClick={() => onDismiss(promo.id)}
        className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-bold text-[#57534E] shadow-md ring-1 ring-[#E7E5E4] hover:text-[#1C1917]"
      >
        ×
      </button>
    </div>
  );
}
