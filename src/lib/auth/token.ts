export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;

  return (
    localStorage.getItem("venozza_token") ||
    sessionStorage.getItem("venozza_token")
  );
}

export function clearAuthToken() {
  if (typeof window === "undefined") return;

  localStorage.removeItem("venozza_token");
  sessionStorage.removeItem("venozza_token");
  localStorage.removeItem("venozza_user");
  sessionStorage.removeItem("venozza_user");
    document.cookie = "venozza_token=; path=/; max-age=0; SameSite=Lax";
}
