"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const categories = [
  { id: "pizzas", name: "Pizzas", icon: "🍕" },
  { id: "combos", name: "Combos", icon: "🔥" },
  { id: "bebidas", name: "Bebidas", icon: "🥤" },
  { id: "sobremesas", name: "Sobremesas", icon: "🍰" },
  { id: "extras", name: "Extras", icon: "🍟" },
];

const promoCards = [
  {
    title: "2 pizzas + refri",
    subtitle: "Oferta especial do dia",
    tag: "Até 25% OFF",
  },
  {
    title: "Frete promocional",
    subtitle: "Entrega com valor reduzido",
    tag: "Hoje",
  },
  {
    title: "Cupom VENOZZA10",
    subtitle: "Ganhe desconto no primeiro pedido",
    tag: "Novo cliente",
  },
];

const products = [
  {
    id: 1,
    section: "pizzas",
    name: "Margherita Basil",
    description: "Molho da casa, muçarela, tomate e manjericão fresco.",
    price: "R$ 49,90",
    badge: "Mais pedida",
    image:
      "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?q=80&w=1200&auto=format&fit=crop",
    rating: "5.0",
    time: "25-35 min",
  },
  {
    id: 2,
    section: "pizzas",
    name: "Pepperoni Clássica",
    description: "Pepperoni marcante com borda dourada e muito queijo.",
    price: "R$ 57,90",
    badge: "Bestseller",
    image:
      "https://images.unsplash.com/photo-1628840042765-356cda07504e?q=80&w=1200&auto=format&fit=crop",
    rating: "4.8",
    time: "25-35 min",
  },
  {
    id: 3,
    section: "combos",
    name: "Combo Família",
    description: "2 pizzas grandes + refrigerante 2L.",
    price: "R$ 79,90",
    badge: "Promoção",
    image:
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=1200&auto=format&fit=crop",
    rating: "4.9",
    time: "30-40 min",
  },
  {
    id: 4,
    section: "bebidas",
    name: "Coca-Cola 2L",
    description: "Gelada, perfeita para acompanhar seu pedido.",
    price: "R$ 12,90",
    badge: "Bebida",
    image:
      "https://images.unsplash.com/photo-1629203432180-71e9b70c6f18?q=80&w=1200&auto=format&fit=crop",
    rating: "4.7",
    time: "20-30 min",
  },
  {
    id: 5,
    section: "sobremesas",
    name: "Pizza Doce de Chocolate",
    description: "Cobertura cremosa com toque especial da casa.",
    price: "R$ 34,90",
    badge: "Doce",
    image:
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?q=80&w=1200&auto=format&fit=crop",
    rating: "4.8",
    time: "25-35 min",
  },
  {
    id: 6,
    section: "extras",
    name: "Batata Premium",
    description: "Crocante por fora, macia por dentro.",
    price: "R$ 18,90",
    badge: "Extra",
    image:
      "https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?q=80&w=1200&auto=format&fit=crop",
    rating: "4.6",
    time: "20-30 min",
  },
];

const sections = [
  { id: "pizzas", title: "Pizzas em destaque" },
  { id: "combos", title: "Combos e promoções" },
  { id: "bebidas", title: "Bebidas" },
  { id: "sobremesas", title: "Sobremesas" },
  { id: "extras", title: "Extras" },
];

export function HomePage() {
  const [activeCategory, setActiveCategory] = useState("pizzas");

  const sectionIds = useMemo(() => sections.map((section) => section.id), []);

  useEffect(() => {
    const handleScroll = () => {
      let current = sectionIds[0];

      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (!el) continue;

        const rect = el.getBoundingClientRect();
        if (rect.top <= 180) {
          current = id;
        }
      }

      setActiveCategory(current);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [sectionIds]);

  return (
    <main className="min-h-screen bg-[#fff8f2] text-[#1f1b16]">
      <header className="sticky top-0 z-50 border-b border-[#eee2d5] bg-[#fff8f2]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div className="min-w-0">
            <Link href="/" className="block text-2xl font-black tracking-tight text-[#b3261e]">
              VenoZza
            </Link>
            <p className="truncate text-xs text-[#6e6257] md:text-sm">
              Delivery • Site oficial • Mais vantagens no app
            </p>
          </div>

          <div className="hidden flex-1 justify-center md:flex">
            <div className="flex w-full max-w-xl items-center rounded-full border border-[#eadbcc] bg-white px-4 py-3 shadow-sm">
              <span className="mr-3 text-lg">🔎</span>
              <input
                type="text"
                placeholder="Buscar pizzas, combos e bebidas"
                className="w-full border-0 bg-transparent p-0 text-sm outline-none placeholder:text-[#9b8f84]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/m"
              className="rounded-full border border-[#e2d2c3] bg-white px-4 py-2 text-sm font-semibold text-[#1f1b16] transition hover:bg-[#fffdfb]"
            >
              App
            </Link>
            <Link
              href="/admin"
              className="rounded-full bg-[#b3261e] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Admin
            </Link>
          </div>
        </div>

        <div className="border-t border-[#f0e5da] px-4 py-3 md:hidden">
          <div className="mx-auto flex max-w-7xl items-center rounded-full border border-[#eadbcc] bg-white px-4 py-3 shadow-sm">
            <span className="mr-3 text-lg">🔎</span>
            <input
              type="text"
              placeholder="Buscar pizzas, combos e bebidas"
              className="w-full border-0 bg-transparent p-0 text-sm outline-none placeholder:text-[#9b8f84]"
            />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 pt-5 md:px-8 md:pt-8">
        <div className="overflow-hidden rounded-[28px] bg-gradient-to-r from-[#b3261e] via-[#ce3828] to-[#f05a2a] shadow-[0_20px_60px_rgba(179,38,30,0.22)]">
          <div className="grid items-center gap-6 md:grid-cols-2">
            <div className="p-6 md:p-10">
              <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-white">
                Oferta da casa
              </span>
              <h1 className="mt-4 text-4xl font-black leading-none tracking-tight text-white md:text-6xl">
                Peça direto
                <br />
                na VenoZza
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/90 md:text-lg">
                Layout mais comercial, mais forte para conversão e pronto para evoluir
                para catálogo, banners, cupom e multi-loja.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/m"
                  className="rounded-full bg-white px-6 py-3 text-sm font-black text-[#b3261e] shadow-lg transition hover:-translate-y-0.5"
                >
                  Pedir agora
                </Link>
                <a
                  href="#categorias"
                  className="rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"
                >
                  Ver cardápio
                </a>
              </div>
            </div>

            <div className="relative h-[280px] md:h-[420px]">
              <img
                src="https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=1600&auto=format&fit=crop"
                alt="Pizza em destaque VenoZza"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent to-[#000]/15" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {promoCards.map((promo) => (
            <div
              key={promo.title}
              className="rounded-3xl border border-[#f0e3d7] bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <span className="inline-block rounded-full bg-[#fff1ef] px-3 py-1 text-[11px] font-black uppercase tracking-widest text-[#b3261e]">
                {promo.tag}
              </span>
              <h3 className="mt-3 text-lg font-black tracking-tight text-[#1f1b16]">
                {promo.title}
              </h3>
              <p className="mt-1 text-sm text-[#6e6257]">{promo.subtitle}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        id="categorias"
        className="sticky top-[73px] z-40 border-y border-[#f1e6db] bg-[#fff8f2]/95 backdrop-blur md:top-[81px]"
      >
        <div className="mx-auto max-w-7xl overflow-x-auto px-4 py-3 md:px-8">
          <div className="flex min-w-max gap-3">
            {categories.map((category) => {
              const isActive = activeCategory === category.id;

              return (
                <a
                  key={category.id}
                  href={`#${category.id}`}
                  className={[
                    "rounded-full px-4 py-2 text-sm font-bold shadow-sm transition",
                    isActive
                      ? "border border-[#b3261e] bg-[#b3261e] text-white"
                      : "border border-[#eadbcc] bg-white text-[#3c342d] hover:border-[#b3261e] hover:text-[#b3261e]",
                  ].join(" ")}
                >
                  <span className="mr-2">{category.icon}</span>
                  {category.name}
                </a>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <div className="mb-8 rounded-3xl border border-[#f0e3d7] bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b3261e]">
                Loja oficial
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-[#1f1b16]">
                VenoZza Delivery
              </h2>
              <p className="mt-1 text-sm text-[#6e6257]">
                Pizza artesanal • Entrega rápida • Mais vantagens pedindo direto
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-[#f7f2ec] px-4 py-2 font-bold text-[#3c342d]">
                ⭐ 4.9 de avaliação
              </span>
              <span className="rounded-full bg-[#f7f2ec] px-4 py-2 font-bold text-[#3c342d]">
                ⏱️ 25-35 min
              </span>
              <span className="rounded-full bg-[#f7f2ec] px-4 py-2 font-bold text-[#3c342d]">
                🛵 Entrega disponível
              </span>
            </div>
          </div>
        </div>

        {sections.map((section) => {
          const items = products.filter((product) => product.section === section.id);

          if (!items.length) return null;

          return (
            <section key={section.id} id={section.id} className="mb-10 scroll-mt-40">
              <div className="mb-5 flex items-center justify-between gap-4">
                <h3 className="text-2xl font-black tracking-tight text-[#1f1b16]">
                  {section.title}
                </h3>
                <Link
                  href="/m"
                  className="text-sm font-black text-[#b3261e] hover:underline"
                >
                  Ver tudo
                </Link>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {items.map((product) => (
                  <article
                    key={product.id}
                    className="overflow-hidden rounded-3xl border border-[#f0e3d7] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex h-full flex-col md:flex-row">
                      <div className="relative h-52 w-full md:h-auto md:w-[220px]">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute left-3 top-3 rounded-full bg-[#b3261e] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                          {product.badge}
                        </span>
                      </div>

                      <div className="flex flex-1 flex-col p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="text-xl font-black tracking-tight text-[#1f1b16]">
                              {product.name}
                            </h4>
                            <p className="mt-2 text-sm leading-relaxed text-[#6e6257]">
                              {product.description}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-[#f7f2ec] px-3 py-1 text-xs font-black text-[#3c342d]">
                            ⭐ {product.rating}
                          </span>
                        </div>

                        <div className="mt-5 flex flex-wrap items-center gap-3 text-xs font-bold text-[#6e6257]">
                          <span className="rounded-full bg-[#f7f2ec] px-3 py-1">
                            {product.time}
                          </span>
                          <span className="rounded-full bg-[#f7f2ec] px-3 py-1">
                            Pedido online
                          </span>
                        </div>

                        <div className="mt-auto flex items-center justify-between gap-4 pt-6">
                          <span className="text-2xl font-black text-[#1f1b16]">
                            {product.price}
                          </span>

                          <Link
                            href="/m"
                            className="rounded-full bg-[#b3261e] px-5 py-3 text-sm font-black text-white transition hover:opacity-90"
                          >
                            Pedir agora
                          </Link>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-24 md:px-8">
        <div className="rounded-[28px] bg-[#1f1b16] p-6 text-white md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ffb4ab]">
                Vantagem oficial
              </p>
              <h3 className="mt-2 text-3xl font-black tracking-tight">
                Peça pelo app da VenoZza
              </h3>
              <p className="mt-2 max-w-2xl text-sm text-white/80 md:text-base">
                Mais controle da experiência, mais autonomia para a marca e estrutura
                pronta para crescer para multi-loja, cupom, campanhas e fidelização.
              </p>
            </div>

            <Link
              href="/m"
              className="rounded-full bg-white px-6 py-3 text-sm font-black text-[#b3261e] transition hover:-translate-y-0.5"
            >
              Ir para o app
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#eee2d5] bg-[#fff3e9]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-12 md:grid-cols-2 md:px-8">
          <div>
            <h4 className="text-xl font-black tracking-tight text-[#1f1b16]">VenoZza</h4>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[#6e6257]">
              Estrutura visual mais forte para conversão, com cara de marketplace,
              mas mantendo sua marca própria no centro da operação.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div>
              <h5 className="mb-3 text-sm font-black uppercase tracking-widest text-[#1f1b16]">
                Navegação
              </h5>
              <div className="space-y-2 text-sm text-[#6e6257]">
                <a className="block hover:text-[#b3261e]" href="#categorias">Categorias</a>
                <Link className="block hover:text-[#b3261e]" href="/m">App</Link>
                <Link className="block hover:text-[#b3261e]" href="/admin">Admin</Link>
              </div>
            </div>

            <div>
              <h5 className="mb-3 text-sm font-black uppercase tracking-widest text-[#1f1b16]">
                Institucional
              </h5>
              <div className="space-y-2 text-sm text-[#6e6257]">
                <a className="block hover:text-[#b3261e]" href="#">Privacidade</a>
                <a className="block hover:text-[#b3261e]" href="#">Termos</a>
                <a className="block hover:text-[#b3261e]" href="#">Contato</a>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[#eee2d5] px-4 py-6 md:px-8">
          <div className="mx-auto max-w-7xl text-xs uppercase tracking-wide text-[#84786d]">
            © 2026 VenoZza Platform. Todos os direitos reservados.
          </div>
        </div>
      </footer>

      <div className="fixed bottom-4 left-0 right-0 z-50 px-4 md:hidden">
        <Link
          href="/m"
          className="flex items-center justify-center rounded-full bg-[#b3261e] px-6 py-4 text-sm font-black text-white shadow-[0_20px_50px_rgba(179,38,30,0.35)]"
        >
          Pedir agora no app
        </Link>
      </div>
    </main>
  );
}
