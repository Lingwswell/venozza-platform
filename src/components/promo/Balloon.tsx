// Visual do balao de promocao (usado nos baloes flutuantes e na previa do admin).

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export type BalloonContent = {
  title: string;
  color: string;
  emoji?: string | null;
  image?: string | null;
  priceCents?: number | null;
  originalPriceCents?: number | null;
  badge?: string | null;
};

export default function Balloon({ content, size = 132 }: { content: BalloonContent; size?: number }) {
  const height = Math.round(size * 1.12);
  const icon = content.emoji?.trim();

  return (
    <span className="relative flex flex-col items-center" style={{ width: size }}>
      <span
        className="relative flex flex-col items-center justify-center overflow-hidden px-3 text-center text-white"
        style={{
          width: size,
          height,
          background: `radial-gradient(circle at 32% 26%, rgba(255,255,255,0.38), rgba(255,255,255,0) 34%), ${content.color}`,
          borderRadius: "50% 50% 48% 52% / 56% 56% 44% 44%",
          boxShadow: "inset -10px -14px 24px rgba(0,0,0,0.18), 0 14px 28px rgba(28,25,23,0.22)",
        }}
      >
        {content.image && !icon ? (
          <img
            src={content.image}
            alt=""
            className="mb-1 h-11 w-11 rounded-full object-cover"
            style={{ boxShadow: "0 0 0 2px rgba(255,255,255,0.85)" }}
          />
        ) : (
          <span aria-hidden className="mb-0.5 text-[26px] leading-none">{icon || "🍕"}</span>
        )}
        {content.badge ? (
          <span className="mb-0.5 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold" style={{ color: content.color }}>
            {content.badge}
          </span>
        ) : null}
        <span className="line-clamp-2 text-[12.5px] font-bold leading-tight">{content.title}</span>
        {typeof content.priceCents === "number" ? (
          <span className="mt-0.5 text-[13px] font-extrabold leading-none">
            {content.originalPriceCents ? (
              <span className="mr-1 text-[10px] font-semibold line-through opacity-75">{money(content.originalPriceCents)}</span>
            ) : null}
            {money(content.priceCents)}
          </span>
        ) : null}
      </span>
      {/* no e cordinha */}
      <span
        aria-hidden
        className="-mt-px h-0 w-0"
        style={{ borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: `8px solid ${content.color}` }}
      />
      <svg aria-hidden width="20" height="46" viewBox="0 0 20 46" fill="none">
        <path d="M10 0 C 4 10, 16 18, 10 28 S 6 40, 11 46" stroke="#A8A29E" strokeWidth="1.5" fill="none" />
      </svg>
    </span>
  );
}
