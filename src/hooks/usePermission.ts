type Role =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "MANAGER"
  | "OPERATOR"
  | "KITCHEN"
  | "DRIVER";

export function usePermission(role?: Role) {
  function can(action: string) {
    if (!role) return false;

    if (role === "SUPER_ADMIN") return true;

    // regra simples (expandimos depois)
    if (action === "orders:read") return true;

    return false;
  }

  return { can };
}
