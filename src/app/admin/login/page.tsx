"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("admin@venozza.com");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Preencha os campos e acesse o painel");
  const [messageType, setMessageType] = useState<"info" | "error" | "success">("info");

  const messageClasses = useMemo(() => {
    if (messageType === "error") {
      return "border-red-200 bg-red-50 text-red-700";
    }
    if (messageType === "success") {
      return "border-sky-200 bg-sky-50 text-sky-700";
    }
    return "border-slate-200 bg-slate-50 text-slate-700";
  }, [messageType]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();

    if (!normalizedEmail) {
      setMessageType("error");
      setMessage("O campo de e-mail é obrigatório.");
      return;
    }

    if (!normalizedPassword) {
      setMessageType("error");
      setMessage("Por favor, insira a senha de acesso.");
      return;
    }

    setLoading(true);
    setMessageType("info");
    setMessage("Validando credenciais...");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          password: normalizedPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessageType("error");
        setMessage(data?.error || "Falha no login.");
        setLoading(false);
        return;
      }

      const storage = remember ? localStorage : sessionStorage;
      storage.setItem("venozza_token", data.token);
      storage.setItem("venozza_user", JSON.stringify(data.user));

      if (remember) {
        localStorage.setItem("venozza_remember", "true");
        localStorage.setItem("venozza_saved_email", normalizedEmail);
      } else {
        localStorage.removeItem("venozza_remember");
        localStorage.removeItem("venozza_saved_email");
      }

      setMessageType("success");
      setMessage("Login autorizado! Redirecionando para o painel...");

      setTimeout(() => {
        router.push("/admin/dashboard");
        router.refresh();
      }, 700);
    } catch {
      setMessageType("error");
      setMessage("Erro ao conectar com a API de login.");
    } finally {
      setLoading(false);
    }
  }

  function handleForgotPassword() {
    setMessageType("info");
    setMessage("Recuperação de senha ainda será implementada no painel.");
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(145deg,#eef2f9_0%,#e0e7f0_100%)] px-4 py-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md items-center justify-center">
        <div className="w-full overflow-hidden rounded-[2rem] bg-white/95 shadow-[0_25px_45px_-12px_rgba(0,0,0,0.25),0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="px-8 py-9 sm:px-10">
            <div className="mb-7 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#4f46e5,#3b0ca3)] text-[28px] text-white shadow-[0_8px_18px_rgba(79,70,229,0.25)]">
                🧑‍💼
              </div>

              <h1 className="bg-[linear-gradient(120deg,#1e1b4b,#312e81)] bg-clip-text text-[2rem] font-extrabold tracking-tight text-transparent">
                ADMIN VENOZZA
              </h1>
              <p className="mt-1 text-[0.95rem] text-slate-500">
                painel de controle inteligente
              </p>
            </div>

            <div className="mb-8 rounded-3xl border border-[#e2edff] bg-slate-100 px-4 py-4 text-center">
              <div className="text-sm font-semibold text-slate-800">
                🔐 Acesso restrito ao administrativo
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Use as credenciais iniciais: <strong>admin@venozza.com</strong> + sua senha do sistema
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.5px] text-slate-700">
                  <span className="text-indigo-600">✉️</span>
                  E-mail
                </label>

                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    @
                  </span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-3xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-[15px] font-medium text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-4 focus:ring-indigo-200"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.5px] text-slate-700">
                  <span className="text-indigo-600">🔒</span>
                  Senha
                </label>

                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    🔑
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    placeholder="**********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-3xl border border-slate-200 bg-white py-3 pl-10 pr-12 text-[15px] font-medium text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-4 focus:ring-indigo-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    title="Mostrar ou esconder senha"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-indigo-600"
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 text-sm">
                <label className="flex cursor-pointer items-center gap-2 text-slate-600">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  <span>Manter sessão</span>
                </label>

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="font-medium text-indigo-600 hover:underline"
                >
                  Esqueceu a senha?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-[1.5rem] bg-[linear-gradient(95deg,#4f46e5,#6d28d9)] px-4 py-3 text-base font-bold text-white shadow-[0_5px_12px_rgba(79,70,229,0.25)] transition hover:scale-[0.99] hover:bg-[linear-gradient(95deg,#4338ca,#5b21b6)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span>{loading ? "⏳" : "↪"}</span>
                <span>{loading ? "Entrando..." : "Entrar"}</span>
              </button>

              <div className={`rounded-2xl border-l-4 px-4 py-3 text-sm font-medium ${messageClasses}`}>
                {messageType === "error" ? "⚠️ " : messageType === "success" ? "✅ " : "ℹ️ "}
                {message}
              </div>
            </form>

            <div className="mt-8 border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
              🛡️ Ambiente seguro • Venozza © 2025
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
