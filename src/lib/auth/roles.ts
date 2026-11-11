// Papeis da plataforma. Unica fonte de verdade: use estas funcoes em vez de
// comparar textos soltos ("owner", "operator"...) espalhados pelo codigo.
// Arquivo sem dependencias de servidor: pode ser usado em paginas "use client".

export const ROLES = [
  "super_admin",
  "owner",
  "franchisee",
  "manager",
  "operator",
  "kitchen_operator",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super admin (plataforma)",
  owner: "Dono da rede",
  franchisee: "Franqueado",
  manager: "Gerente de loja",
  operator: "Operador de loja",
  kitchen_operator: "Operador da cozinha central",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  super_admin: "Acesso total à plataforma.",
  owner: "Todas as lojas da rede, cardápio, usuários e relatórios.",
  franchisee: "As lojas dele: pedidos, monitor, relatórios, equipe e configurações.",
  manager: "Uma loja: pedidos, KDS, produtos disponíveis, configurações e equipe.",
  operator: "KDS e pedidos da loja; pode abrir/fechar a loja.",
  kitchen_operator: "KDS da cozinha central.",
};

/** Converte o texto do banco/token para um papel conhecido (ou null). */
export function normalizeRole(raw: unknown): Role | null {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "admin") return "owner"; // nome antigo
  return (ROLES as readonly string[]).includes(value) ? (value as Role) : null;
}

/** Enxerga todas as lojas da rede. */
export function isNetworkRole(role: Role | null): boolean {
  return role === "super_admin" || role === "owner";
}

/** Pode olhar varias lojas ao mesmo tempo (seletor de loja, monitor, relatorios). */
export function isMultiStoreRole(role: Role | null): boolean {
  return isNetworkRole(role) || role === "franchisee";
}

export const can = {
  manageCatalog: (r: Role | null) => isNetworkRole(r),
  manageStores: (r: Role | null) => isNetworkRole(r),
  manageUsers: (r: Role | null) => isMultiStoreRole(r) || r === "manager",
  viewMonitor: (r: Role | null) => isMultiStoreRole(r),
  viewReports: (r: Role | null) => isMultiStoreRole(r) || r === "manager",
  editStoreSettings: (r: Role | null) => isMultiStoreRole(r) || r === "manager",
  openCloseStore: (r: Role | null) => r !== null && r !== "kitchen_operator",
  operateStoreKds: (r: Role | null) => r !== null && r !== "kitchen_operator",
  editProductAvailability: (r: Role | null) => isMultiStoreRole(r) || r === "manager",
};

/** Quais papeis cada um pode criar/editar na tela de usuarios. */
export function assignableRoles(role: Role | null): Role[] {
  switch (role) {
    case "super_admin":
      return ["owner", "franchisee", "manager", "operator", "kitchen_operator"];
    case "owner":
      return ["owner", "franchisee", "manager", "operator", "kitchen_operator"];
    case "franchisee":
      return ["manager", "operator"];
    case "manager":
      return ["operator"];
    default:
      return [];
  }
}
