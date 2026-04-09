"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler as EventListener);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler as EventListener);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-24 left-1/2 z-[999] w-[92%] max-w-sm -translate-x-1/2 rounded-2xl border border-orange-900/40 bg-[#1a120b] p-4 shadow-2xl">
      <p className="text-sm font-bold text-white">Instalar app VenoZza</p>
      <p className="mt-1 text-xs text-neutral-400">
        Tenha acesso rápido na tela inicial do celular.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleInstall}
          className="flex-1 rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-500"
        >
          Instalar
        </button>
        <button
          onClick={() => setVisible(false)}
          className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-300 hover:bg-neutral-800"
        >
          Agora não
        </button>
      </div>
    </div>
  );
}
