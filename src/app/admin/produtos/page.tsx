"use client";

import { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { fetchWithAuth } from "@/lib/auth/fetch-auth";

type AdminStore = {
  id: string;
  name: string;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
};

type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  sortOrder?: number | null;
  active?: boolean | null;
  showInMobile?: boolean | null;
  showInSite?: boolean | null;
};

type CategoriesResponse = {
  ok?: boolean;
  categories?: AdminCategory[];
  error?: string;
  message?: string;
};

type AdminProduct = {
  id: string;
  productStoreId?: string;
  name: string;
  description?: string | null;
  image?: string | null;
  category?: string | null;
  customizationType?: string | null;
  available: boolean;
  productAvailable?: boolean;
  storeAvailable?: boolean;
  stock?: number;
  price_cents: number;
  price: number;
  storeId: string;
  store?: AdminStore | null;
  createdAt?: string;
  source?: string;
};

type ProductsResponse = {
  ok?: boolean;
  role?: string;
  tenantId?: string;
  currentStoreId?: string | null;
  selectedStoreId?: string | null;
  stores?: AdminStore[];
  products?: AdminProduct[];
  error?: string;
  message?: string;
};

type ProductFormState = {
  name: string;
  category: string;
  categoryCustom: string;
  customizationType: string;
  price: string;
  stock: string;
  storeId: string;
  description: string;
  image: string;
  available: boolean;
  allStores: boolean;
};

function moneyFromCents(value: number) {
  return (Number(value || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function AdminProdutosPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [adminCategories, setAdminCategories] = useState<AdminCategory[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("all");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<ProductFormState>({
    name: "",
    category: "pizza",
    categoryCustom: "",
    customizationType: "auto",
    price: "",
    stock: "0",
    storeId: "",
    description: "",
    image: "",
    available: true,
    allStores: false,
  });

  const [productSearch, setProductSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [mountingFilter, setMountingFilter] = useState("all");
  const [storeFilter, setStoreFilter] = useState("all");
  const [minPriceFilter, setMinPriceFilter] = useState("");
  const [maxPriceFilter, setMaxPriceFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [beverageBrand, setBeverageBrand] = useState("Coca-Cola");
  const [beveragePackage, setBeveragePackage] = useState("PET");
  const [beverageVolume, setBeverageVolume] = useState("2L");

  async function loadCategories() {
    try {
      const res = await fetchWithAuth("/api/admin/categories", {
        method: "GET",
        cache: "no-store",
      });

      const data = (await res.json().catch(() => ({}))) as CategoriesResponse;

      if (!res.ok || data.ok === false) {
        throw new Error(data.error || data.message || "Erro ao carregar categorias.");
      }

      setAdminCategories(Array.isArray(data.categories) ? data.categories : []);
    } catch (err) {
      console.warn("[admin/produtos][categories]", err);
      setAdminCategories([]);
    }
  }

  async function loadProducts(nextStoreId?: string) {
    setLoading(true);
    setError("");

    try {
      const storeId = nextStoreId || selectedStoreId || "all";

      const res = await fetchWithAuth(
        `/api/admin/products?storeId=${encodeURIComponent(storeId)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = (await res.json().catch(() => ({}))) as ProductsResponse;

      if (!res.ok || data.ok === false) {
        throw new Error(data.error || data.message || "Erro ao carregar produtos.");
      }

      setProducts(Array.isArray(data.products) ? data.products : []);
      setStores(Array.isArray(data.stores) ? data.stores : []);
      setRole(String(data.role || ""));
      setSelectedStoreId(data.selectedStoreId || storeId || "all");
    } catch (err) {
      setProducts([]);
      setError(err instanceof Error ? err.message : "Erro ao carregar produtos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
    loadProducts("all");
  }, []);

  const activeProducts = useMemo(() => {
    return products.filter((product) => product.available !== false).length;
  }, [products]);

  const categoriesCount = useMemo(() => {
    const set = new Set(
      products.map((product) => product.category || "Sem categoria")
    );

    return set.size;
  }, [products]);

  function handleStoreChange(value: string) {
    setSelectedStoreId(value);
    loadProducts(value);
  }

  function updateForm<K extends keyof ProductFormState>(
    key: K,
    value: ProductFormState[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function resetForm() {
    const fallbackStoreId =
      selectedStoreId && selectedStoreId !== "all"
        ? selectedStoreId
        : stores[0]?.id || "";

    setEditingProductId(null);
    setFormMode("create");

    setForm({
      name: "",
      category: "pizza",
      categoryCustom: "",
      customizationType: "auto",
      price: "",
      stock: "0",
      storeId: fallbackStoreId,
      description: "",
      image: "",
      available: true,
      allStores: false,
    });
  }

  function slugifyCategory(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function normalizeCategory(value: string) {
    const slug = slugifyCategory(value);

    if (
      slug === "porcao" ||
      slug === "porcoes" ||
      slug === "porcaoes" ||
      slug === "acompanhamentos"
    ) {
      return "acompanhamento";
    }

    if (slug === "bebidas") {
      return "bebida";
    }

    if (slug === "sobremesas") {
      return "sobremesa";
    }

    if (slug === "pizzas") {
      return "pizza";
    }

    return slug;
  }

  const categoryOptions = useMemo(() => {
    const fallback = [
      { value: "pizza", label: "Pizza" },
      { value: "bebida", label: "Bebida" },
      { value: "sobremesa", label: "Sobremesa" },
      { value: "acompanhamento", label: "Acompanhamento" },
    ];

    const map = new Map<string, { value: string; label: string; icon?: string | null }>();

    const activeCategories = adminCategories
      .filter((category) => category.active !== false)
      .sort((a, b) => {
        const orderA = Number(a.sortOrder ?? 0);
        const orderB = Number(b.sortOrder ?? 0);

        if (orderA !== orderB) return orderA - orderB;

        return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
      });

    const source =
      activeCategories.length > 0
        ? activeCategories.map((category) => ({
            value: normalizeCategory(category.slug || category.name),
            label: category.name,
            icon: category.icon,
          }))
        : fallback;

    source.forEach((category) => {
      if (!category.value) return;
      map.set(category.value, category);
    });

    products.forEach((product) => {
      const raw = String(product.category || "").trim();

      if (!raw) return;

      const value = normalizeCategory(raw);

      if (!value) return;

      if (!map.has(value)) {
        map.set(value, {
          value,
          label: raw
            .replace(/-/g, " ")
            .replace(/\b\w/g, (char) => char.toUpperCase()),
        });
      }
    });

    return Array.from(map.values());
  }, [adminCategories, products]);

  const beverageBrands = [
    "Coca-Cola",
    "Coca-Cola Zero",
    "Guaraná Antarctica",
    "Fanta",
    "Sprite",
    "Pepsi",
    "Água Mineral",
    "Suco",
  ];

  const beveragePackages = [
    "Lata",
    "Mini",
    "Garrafa",
    "PET",
    "Retornável",
    "Caixa",
  ];

  const beverageVolumes = [
    "200ml",
    "220ml",
    "269ml",
    "350ml",
    "500ml",
    "600ml",
    "1L",
    "1,25L",
    "1,5L",
    "2L",
    "2,5L",
    "3L",
  ];

  const isBeverageForm =
    normalizeCategory(form.categoryCustom || form.category) === "bebida" ||
    form.customizationType === "bebida";

  const beverageSuggestedName = [
    beverageBrand,
    beveragePackage,
    beverageVolume,
  ]
    .filter(Boolean)
    .join(" ");

  function applyBeverageSuggestion() {
    setForm((current) => ({
      ...current,
      name: beverageSuggestedName,
      category: "bebida",
      categoryCustom: "",
      customizationType: "bebida",
    }));
  }

  async function handleImageUpload(file: File | null) {
    if (!file) return;

    setUploadingImage(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetchWithAuth("/api/admin/uploads/product-image", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Erro ao enviar imagem.");
      }

      if (!data?.url) {
        throw new Error("Upload concluído, mas a URL da imagem não retornou.");
      }

      updateForm("image", String(data.url));
      setSuccess("Imagem enviada com sucesso. Agora salve o produto.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar imagem.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSubmitProduct(event: React.FormEvent) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const effectiveCategory =
        form.categoryCustom.trim()
          ? normalizeCategory(form.categoryCustom)
          : normalizeCategory(form.category);

      const storeId =
        form.storeId ||
        (selectedStoreId && selectedStoreId !== "all" ? selectedStoreId : stores[0]?.id);

      const endpoint =
        formMode === "edit" && editingProductId
          ? `/api/admin/products/${editingProductId}`
          : "/api/admin/products";

      const res = await fetchWithAuth(endpoint, {
        method: formMode === "edit" ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          category: effectiveCategory,
          customizationType: form.customizationType,
          price: form.price,
          stock: form.stock,
          storeId,
          description: form.description,
          image: form.image,
          available: form.available,
          allStores: formMode === "create" ? form.allStores : false,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.ok === false) {
        throw new Error(
          data?.error ||
            (formMode === "edit" ? "Erro ao editar produto." : "Erro ao criar produto.")
        );
      }

      setSuccess(
        formMode === "edit"
          ? "Produto atualizado com sucesso."
          : "Produto criado com sucesso."
      );
      setShowCreateForm(false);
      resetForm();
      await loadProducts(selectedStoreId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : formMode === "edit"
            ? "Erro ao editar produto."
            : "Erro ao criar produto."
      );
    } finally {
      setSaving(false);
    }
  }

  function startEditProduct(product: AdminProduct) {
    setFormMode("edit");
    setEditingProductId(product.id);
    setShowCreateForm(true);
    setError("");
    setSuccess("");

    setForm({
      name: product.name || "",
      category: product.category || "pizza",
      categoryCustom: "",
      customizationType: product.customizationType || "auto",
      price: (Number(product.price_cents || 0) / 100).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      stock: String(product.stock ?? 0),
      storeId: product.storeId || "",
      description: product.description || "",
      image: product.image || "",
      available: product.available !== false,
      allStores: false,
    });

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function toggleProductAvailability(product: AdminProduct) {
    setBusyProductId(product.id);
    setError("");
    setSuccess("");

    try {
      const res = await fetchWithAuth(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: product.name,
          category: product.category || "pizza",
          customizationType: product.customizationType || "auto",
          price_cents: product.price_cents,
          stock: product.stock ?? 0,
          storeId: product.storeId,
          description: product.description || "",
          image: product.image || "",
          available: product.available === false,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Erro ao atualizar disponibilidade.");
      }

      setSuccess(
        product.available === false
          ? "Produto marcado como disponível."
          : "Produto marcado como indisponível."
      );

      await loadProducts(selectedStoreId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao atualizar disponibilidade."
      );
    } finally {
      setBusyProductId(null);
    }
  }

  const canSeeAllStores = String(role).toLowerCase() !== "operator";

  const mountingOptions = [
    { value: "auto", label: "Automático" },
    { value: "pizza", label: "Pizza" },
    { value: "batata", label: "Batata" },
    { value: "simples", label: "Simples" },
    { value: "bebida", label: "Bebida" },
    { value: "sobremesa", label: "Sobremesa" },
    { value: "combo", label: "Combo" },
  ];

  const filteredProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase();

    return products.filter((product) => {
      const name = String(product.name || "").toLowerCase();
      const description = String(product.description || "").toLowerCase();
      const category = normalizeCategory(String(product.category || ""));
      const mounting = String(product.customizationType || "auto").toLowerCase();
      const stock = Number(product.stock ?? 0);
      const available = product.available !== false;
      const priceCents = Number(product.price_cents || 0);

      const minPriceCents = minPriceFilter.trim()
        ? Math.round(Number(minPriceFilter.replace(",", ".")) * 100)
        : null;

      const maxPriceCents = maxPriceFilter.trim()
        ? Math.round(Number(maxPriceFilter.replace(",", ".")) * 100)
        : null;

      const matchesSearch =
        !search ||
        name.includes(search) ||
        description.includes(search) ||
        String(product.id || "").toLowerCase().includes(search);

      const matchesCategory =
        categoryFilter === "all" || category === categoryFilter;

      const matchesMounting =
        mountingFilter === "all" || mounting === mountingFilter;

      const matchesStore =
        storeFilter === "all" || product.storeId === storeFilter;

      const matchesPrice =
        (minPriceCents === null || priceCents >= minPriceCents) &&
        (maxPriceCents === null || priceCents <= maxPriceCents);

      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "out" && stock <= 0) ||
        (stockFilter === "low" && stock > 0 && stock <= 5) ||
        (stockFilter === "available" && stock > 5);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "available" && available) ||
        (statusFilter === "unavailable" && !available);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesMounting &&
        matchesStore &&
        matchesPrice &&
        matchesStock &&
        matchesStatus
      );
    });
  }, [
    products,
    productSearch,
    categoryFilter,
    mountingFilter,
    storeFilter,
    minPriceFilter,
    maxPriceFilter,
    stockFilter,
    statusFilter,
  ]);

  const filteredActiveProducts = useMemo(() => {
    return filteredProducts.filter((product) => product.available !== false).length;
  }, [filteredProducts]);

  return (
    <AdminShell
      title="Produtos"
      subtitle="Catálogo real, preços, disponibilidade e separação por loja."
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
              Catálogo
            </p>
            <h3 className="mt-1 text-2xl font-black text-slate-900">
              Produtos cadastrados
            </h3>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Produtos carregados do banco e vinculados às lojas. Esta tela prepara
              a próxima evolução para produto global, disponibilidade por loja e estoque.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={selectedStoreId}
              onChange={(event) => handleStoreChange(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm outline-none"
            >
              {canSeeAllStores ? <option value="all">Todas as lojas</option> : null}

              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => loadProducts(selectedStoreId)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Atualizar
            </button>

            <button
              type="button"
              onClick={() => {
                if (!showCreateForm || formMode === "edit") {
                  resetForm();
                  setShowCreateForm(true);
                } else {
                  setShowCreateForm(false);
                  resetForm();
                }

                setError("");
                setSuccess("");
              }}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600"
            >
              {showCreateForm ? "Fechar" : "Novo produto"}
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Total de produtos</div>
            <div className="mt-2 text-3xl font-black text-slate-900">
              {loading ? "..." : filteredProducts.length}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Disponíveis</div>
            <div className="mt-2 text-3xl font-black text-slate-900">
              {loading ? "..." : filteredActiveProducts}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Categorias</div>
            <div className="mt-2 text-3xl font-black text-slate-900">
              {loading ? "..." : categoriesCount}
            </div>
          </div>
        </div>

        {showCreateForm ? (
          <form
            onSubmit={handleSubmitProduct}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-4">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
                Cadastro
              </p>
              <h3 className="mt-1 text-xl font-black text-slate-900">
                {formMode === "edit" ? "Editar produto" : "Novo produto"}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {formMode === "edit"
                  ? "Atualize nome, preço, categoria, disponibilidade e loja vinculada."
                  : "Crie um produto para uma loja ou replique para todas as lojas ativas. Em etapa futura isso vira produto global com disponibilidade por loja."}
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Nome do produto
                </span>
                <input
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  placeholder="Ex: Pizza Calabresa"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none"
                />
              </label>

              {isBeverageForm ? (
                <div className="rounded-3xl border border-orange-100 bg-orange-50/60 p-4 lg:col-span-2">
                  <div className="mb-3">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">
                      Assistente de bebida
                    </p>
                    <h4 className="mt-1 text-base font-black text-slate-900">
                      Padronizar nome por marca, embalagem e volume
                    </h4>
                    <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">
                      Cada tamanho deve ser um produto separado para controlar preço e estoque por loja.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="space-y-1">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Marca
                      </span>
                      <select
                        value={beverageBrand}
                        onChange={(event) => setBeverageBrand(event.target.value)}
                        className="w-full rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm font-semibold outline-none"
                      >
                        {beverageBrands.map((brand) => (
                          <option key={brand} value={brand}>
                            {brand}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Embalagem
                      </span>
                      <select
                        value={beveragePackage}
                        onChange={(event) => setBeveragePackage(event.target.value)}
                        className="w-full rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm font-semibold outline-none"
                      >
                        {beveragePackages.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Volume
                      </span>
                      <select
                        value={beverageVolume}
                        onChange={(event) => setBeverageVolume(event.target.value)}
                        className="w-full rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm font-semibold outline-none"
                      >
                        {beverageVolumes.map((volume) => (
                          <option key={volume} value={volume}>
                            {volume}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Nome sugerido
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-900">
                        {beverageSuggestedName}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={applyBeverageSuggestion}
                      className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-orange-600"
                    >
                      Usar este nome
                    </button>
                  </div>
                </div>
              ) : null}

              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Categoria
                </span>
                <select
                  value={form.category}
                  onChange={(event) => {
                    const value = event.target.value;
                    updateForm("category", value);
                    if (normalizeCategory(value) === "bebida") {
                      updateForm("customizationType", "bebida");
                    }
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none"
                >
                  {categoryOptions.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.icon ? `${category.icon} ` : ""}{category.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Tipo de montagem
                </span>
                <select
                  value={form.customizationType}
                  onChange={(event) => updateForm("customizationType", event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none"
                >
                  <option value="auto">Automático pela categoria</option>
                  <option value="pizza">Pizza</option>
                  <option value="batata">Batata / acompanhamento montável</option>
                  <option value="simples">Produto simples</option>
                  <option value="bebida">Bebida</option>
                  <option value="sobremesa">Sobremesa</option>
                  <option value="combo">Combo</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Nova categoria
                </span>
                <input
                  value={form.categoryCustom}
                  onChange={(event) => {
                    const value = event.target.value;
                    updateForm("categoryCustom", value);
                    if (normalizeCategory(value) === "bebida") {
                      updateForm("customizationType", "bebida");
                    }
                  }}
                  placeholder="Ex: Lanche, Massa, Combo..."
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none"
                />
                <span className="text-[11px] font-medium text-slate-400">
                  Se preencher aqui, esta categoria será usada no lugar do seletor. "Porção" será tratado como Acompanhamento.
                </span>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Preço por loja
                </span>
                <input
                  value={form.price}
                  onChange={(event) => updateForm("price", event.target.value)}
                  placeholder="Ex: 49,90"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Estoque da loja
                </span>
                <input
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(event) => updateForm("stock", event.target.value)}
                  placeholder="Ex: 10"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Loja
                </span>
                <select
                  value={form.storeId}
                  disabled={formMode === "create" && form.allStores}
                  onChange={(event) => updateForm("storeId", event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">Selecione uma loja</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </label>

              {formMode === "create" ? (
                <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.allStores}
                    onChange={(event) => updateForm("allStores", event.target.checked)}
                  />
                  <span className="text-sm font-semibold text-slate-700">
                    Criar este produto em todas as lojas ativas
                  </span>
                </label>
              ) : null}

              <div className="space-y-2 lg:col-span-2">
                <label className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    URL da imagem
                  </span>
                  <input
                    value={form.image}
                    onChange={(event) => updateForm("image", event.target.value)}
                    placeholder="/uploads/products/imagem-do-produto.webp"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none"
                  />
                </label>

                <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
                      {form.image ? (
                        <img
                          src={form.image}
                          alt="Preview do produto"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-lg">🖼️</span>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Upload de imagem
                      </p>
                      <p className="text-xs text-slate-500">
                        JPG, PNG ou WEBP até 5MB.
                      </p>
                    </div>
                  </div>

                  <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-slate-800">
                    {uploadingImage ? "Enviando..." : "Enviar imagem"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={uploadingImage}
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        handleImageUpload(file);
                        event.target.value = "";
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <label className="space-y-1 lg:col-span-2">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Descrição
                </span>
                <textarea
                  value={form.description}
                  onChange={(event) => updateForm("description", event.target.value)}
                  placeholder="Descrição do produto"
                  className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none"
                />
              </label>

              <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.available}
                  onChange={(event) => updateForm("available", event.target.checked)}
                />
                <span className="text-sm font-semibold text-slate-700">
                  Produto disponível
                </span>
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-60"
              >
                {saving
                  ? "Salvando..."
                  : formMode === "edit"
                    ? "Salvar alterações"
                    : "Salvar produto"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  resetForm();
                }}
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : null}

        {success ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-700 shadow-sm">
            {success}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            Carregando produtos...
          </div>
        ) : null}

        {!loading && !error && products.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            Nenhum produto encontrado.
          </div>
        ) : null}

        {!loading && !error && products.length > 0 && filteredProducts.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            Nenhum produto encontrado com os filtros selecionados.
          </div>
        ) : null}

        {!loading && !error && filteredProducts.length > 0 ? (
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-lg font-bold text-slate-900">
                Lista de produtos
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Produtos reais carregados de <code>/api/admin/products</code>.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold text-slate-600">
                      Produto
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-600">
                      Categoria
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-600">
                      Montagem
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-600">
                      Loja
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-600">
                      Preço
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-600">
                      Estoque
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-600">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-slate-600">
                      Ações
                    </th>
                  </tr>

                  <tr className="border-t border-slate-200 bg-white">
                    <th className="px-5 py-3 text-left">
                      <input
                        value={productSearch}
                        onChange={(event) => setProductSearch(event.target.value)}
                        placeholder="Buscar produto"
                        className="w-56 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                      />
                    </th>

                    <th className="px-5 py-3 text-left">
                      <select
                        value={categoryFilter}
                        onChange={(event) => setCategoryFilter(event.target.value)}
                        className="w-40 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                      >
                        <option value="all">Todas</option>
                        {categoryOptions.map((category) => (
                          <option key={category.value} value={category.value}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                    </th>

                    <th className="px-5 py-3 text-left">
                      <select
                        value={mountingFilter}
                        onChange={(event) => setMountingFilter(event.target.value)}
                        className="w-36 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                      >
                        <option value="all">Todas</option>
                        {mountingOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </th>

                    <th className="px-5 py-3 text-left">
                      <select
                        value={storeFilter}
                        onChange={(event) => setStoreFilter(event.target.value)}
                        className="w-40 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                      >
                        <option value="all">Todas</option>
                        {stores.map((store) => (
                          <option key={store.id} value={store.id}>
                            {store.name}
                          </option>
                        ))}
                      </select>
                    </th>

                    <th className="px-5 py-3 text-left">
                      <div className="flex gap-2">
                        <input
                          value={minPriceFilter}
                          onChange={(event) => setMinPriceFilter(event.target.value)}
                          placeholder="mín"
                          className="w-20 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                        />
                        <input
                          value={maxPriceFilter}
                          onChange={(event) => setMaxPriceFilter(event.target.value)}
                          placeholder="máx"
                          className="w-20 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                        />
                      </div>
                    </th>

                    <th className="px-5 py-3 text-left">
                      <select
                        value={stockFilter}
                        onChange={(event) => setStockFilter(event.target.value)}
                        className="w-36 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                      >
                        <option value="all">Todos</option>
                        <option value="out">Sem estoque</option>
                        <option value="low">Baixo</option>
                        <option value="available">Com estoque</option>
                      </select>
                    </th>

                    <th className="px-5 py-3 text-left">
                      <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        className="w-36 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                      >
                        <option value="all">Todos</option>
                        <option value="available">Disponível</option>
                        <option value="unavailable">Indisponível</option>
                      </select>
                    </th>

                    <th className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setProductSearch("");
                          setCategoryFilter("all");
                          setMountingFilter("all");
                          setStoreFilter("all");
                          setMinPriceFilter("");
                          setMaxPriceFilter("");
                          setStockFilter("all");
                          setStatusFilter("all");
                        }}
                        className="whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
                      >
                        Limpar
                      </button>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredProducts.map((product) => (
                    <tr key={product.productStoreId || `${product.id}-${product.storeId}`}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-lg">🍕</span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">
                              {product.name}
                            </p>
                            <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                              {product.description || "Sem descrição"}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-400">
                              ID: {product.id}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-slate-700">
                        {product.category || "Sem categoria"}
                      </td>

                      <td className="px-5 py-4 text-slate-700">
                        {product.customizationType || "auto"}
                      </td>

                      <td className="px-5 py-4 text-slate-700">
                        {product.store?.name || product.storeId}
                      </td>

                      <td className="px-5 py-4 font-bold text-slate-950">
                        {moneyFromCents(product.price_cents)}
                      </td>

                      <td className="px-5 py-4 font-semibold text-slate-700">
                        {Number(product.stock ?? 0)}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-col items-start gap-2">
                          {product.available === false ? (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                              Indisponível
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                              Disponível
                            </span>
                          )}

                          <button
                            type="button"
                            disabled={busyProductId === product.id}
                            onClick={() => toggleProductAvailability(product)}
                            className={[
                              "rounded-full px-3 py-1 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60",
                              product.available === false
                                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                            ].join(" ")}
                          >
                            {busyProductId === product.id
                              ? "Atualizando..."
                              : product.available === false
                                ? "Ativar"
                                : "Desativar"}
                          </button>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => startEditProduct(product)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </AdminShell>
  );
}
