function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;

  return (
    localStorage.getItem("venozza_token") ||
    sessionStorage.getItem("venozza_token")
  );
}

export async function fetchWithAuth(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = getStoredToken();

  const headers = new Headers(init.headers || {});

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
    cache: init.cache ?? "no-store",
  });
}
