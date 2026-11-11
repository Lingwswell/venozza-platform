function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;

  return (
    localStorage.getItem("venozza_token") ||
    sessionStorage.getItem("venozza_token")
  );
}

async function fetchWithAuthRaw(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = getStoredToken();

  const headers = new Headers(init.headers || {});

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Papel, rede e loja vem do token no servidor; o navegador nao manda cabecalhos de permissao.

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
