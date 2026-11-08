type StoredAdminUser = {
  role?: string | null;
  tenantId?: string | null;
  storeId?: string | null;
};

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;

  return (
    localStorage.getItem("venozza_token") ||
    sessionStorage.getItem("venozza_token")
  );
}

function getStoredAdminUser(): StoredAdminUser | null {
  if (typeof window === "undefined") return null;

  const rawUser =
    localStorage.getItem("venozza_user") ||
    sessionStorage.getItem("venozza_user");

  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser) as StoredAdminUser;
  } catch {
    return null;
  }
}

async function fetchWithAuthRaw(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = getStoredToken();
  const user = getStoredAdminUser();

  const headers = new Headers(init.headers || {});

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (user?.tenantId && !headers.has("x-tenant-id")) {
    headers.set("x-tenant-id", String(user.tenantId));
  }

  if (user?.storeId && !headers.has("x-store-id")) {
    headers.set("x-store-id", String(user.storeId));
  }

  if (user?.role && !headers.has("x-user-role")) {
    headers.set("x-user-role", String(user.role));
  }

  return fetch(input, {
    ...init,
    headers,
    cache: init.cache ?? "no-store",
  });
}

function clearAdminSession() {
  try {
    localStorage.removeItem("venozza_token");
    localStorage.removeItem("venozza_user");
    sessionStorage.removeItem("venozza_token");
    sessionStorage.removeItem("venozza_user");
    document.cookie = "venozza_token=; path=/; max-age=0; SameSite=Lax";
  } catch {
    // armazenamento indisponivel
  }
}

export async function fetchWithAuth(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const response = await fetchWithAuthRaw(input, init);

  if (response.status === 401 && typeof window !== "undefined") {
    clearAdminSession();

    if (!window.location.pathname.startsWith("/admin/login")) {
      window.location.href = "/admin/login?sessao=expirada";
    }
  }

  return response;
}
