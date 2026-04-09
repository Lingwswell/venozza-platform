"use client";

type NavItem = {
  id: string;
  label: string;
  icon: string;
};

type Props = {
  items: NavItem[];
  activeId: string;
  onChange: (id: string) => void;
};

export default function MagicHorizontalNav({
  items,
  activeId,
  onChange,
}: Props) {
  return (
    <div className="no-scrollbar overflow-x-auto">
      <div className="flex min-w-max gap-2">
        {items.map((item) => {
          const active = item.id === activeId;

          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={[
                "group relative flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold transition-all duration-200",
                active
                  ? "border-orange-600 bg-orange-600 text-white shadow-[0_10px_24px_rgba(234,88,12,.28)]"
                  : "border-[#e2d8c9] bg-white text-[#2c2c2c] hover:border-[#d6c8b6] hover:bg-[#faf6ef]",
              ].join(" ")}
            >
              <span
                className={[
                  "text-base transition-transform duration-200",
                  active ? "scale-110" : "group-hover:scale-105",
                ].join(" ")}
              >
                {item.icon}
              </span>

              <span>{item.label}</span>

              {active && (
                <span className="absolute inset-0 rounded-full ring-1 ring-orange-300/50" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
