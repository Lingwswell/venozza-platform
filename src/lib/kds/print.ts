// Impressao do pedido em impressora termica (bobina de 80 mm ou 58 mm).
// Usa um iframe escondido + window.print(): funciona com qualquer impressora instalada no computador.
// Para imprimir sem a janela de confirmacao, abra o Chrome do KDS com --kiosk-printing.

export type PrintableItem = {
  name: string;
  quantity: number;
  total_cents: number;
  size?: string | null;
  crust?: string | null;
  note?: string | null;
  addons_json?: string | null;
};

export type PrintableOrder = {
  orderCode: string;
  customerName: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  paymentMethod?: string | null;
  orderType?: string | null;
  subtotal_cents?: number | null;
  freight_cents?: number | null;
  total_cents: number;
  createdAt: string;
  items?: PrintableItem[];
  store?: { name: string } | null;
};

const PAYMENT: Record<string, string> = {
  pix: "PIX",
  credito: "Cartão de crédito",
  debito: "Cartão de débito",
  dinheiro: "Dinheiro",
};

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(cents: number | null | undefined) {
  return ((Number(cents) || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function addonsOf(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function receiptHtml(order: PrintableOrder, paperWidthMm = 80) {
  const pickup = order.orderType === "retirada";
  const when = new Date(order.createdAt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const items = (order.items || [])
    .map((item) => {
      // Tamanho e borda ja aparecem nos addons quando vieram do site/app; evita repetir.
      const addons = addonsOf(item.addons_json);
      const extras = [
        ...(item.size && !addons.some((a) => a.includes(item.size!)) ? [item.size] : []),
        ...(item.crust && !addons.some((a) => a.includes(item.crust!)) ? [item.crust] : []),
        ...addons,
      ];
      return `
        <div class="item">
          <div class="row"><b>${esc(item.quantity)}x ${esc(item.name)}</b><span>${money(item.total_cents)}</span></div>
          ${extras.map((e) => `<div class="extra">- ${esc(e)}</div>`).join("")}
          ${item.note ? `<div class="note">OBS: ${esc(item.note)}</div>` : ""}
        </div>`;
    })
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(order.orderCode)}</title>
<style>
  @page { size: ${paperWidthMm}mm auto; margin: 2mm; }
  * { box-sizing: border-box; }
  body { width: ${paperWidthMm - 6}mm; margin: 0; font-family: "Courier New", monospace; font-size: 12px; color: #000; }
  h1 { font-size: 16px; text-align: center; margin: 0 0 2px; }
  .center { text-align: center; }
  .big { font-size: 20px; font-weight: bold; text-align: center; margin: 4px 0; }
  .type { font-size: 16px; font-weight: bold; text-align: center; border: 2px solid #000; padding: 3px; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; gap: 6px; }
  .item { margin: 4px 0; }
  .extra { padding-left: 8px; }
  .note { padding-left: 8px; font-weight: bold; }
  hr { border: 0; border-top: 1px dashed #000; margin: 5px 0; }
  .total { font-size: 15px; font-weight: bold; }
</style></head><body>
  <h1>${esc(order.store?.name || "")}</h1>
  <div class="center">${esc(when)}</div>
  <div class="big">${esc(order.orderCode)}</div>
  <div class="type">${pickup ? "RETIRADA NA LOJA" : "ENTREGA"}</div>
  <div><b>Cliente:</b> ${esc(order.customerName)}</div>
  ${order.phone ? `<div><b>Tel:</b> ${esc(order.phone)}</div>` : ""}
  ${!pickup && order.address ? `<div><b>Endereço:</b> ${esc(order.address)}</div>` : ""}
  ${order.notes ? `<div class="note">OBS: ${esc(order.notes)}</div>` : ""}
  <hr>
  ${items}
  <hr>
  ${typeof order.subtotal_cents === "number" ? `<div class="row"><span>Subtotal</span><span>${money(order.subtotal_cents)}</span></div>` : ""}
  ${!pickup && typeof order.freight_cents === "number" ? `<div class="row"><span>Entrega</span><span>${money(order.freight_cents)}</span></div>` : ""}
  <div class="row total"><span>TOTAL</span><span>${money(order.total_cents)}</span></div>
  <div><b>Pagamento:</b> ${esc(PAYMENT[order.paymentMethod || ""] || order.paymentMethod || "-")}</div>
  <hr>
  <div class="center">Obrigado pela preferência!</div>
</body></html>`;
}

/** Imprime sem abrir aba nova (iframe escondido). */
export function printOrder(order: PrintableOrder, paperWidthMm = 80) {
  if (typeof window === "undefined") return;
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);

  const doc = frame.contentWindow?.document;
  if (!doc || !frame.contentWindow) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(receiptHtml(order, paperWidthMm));
  doc.close();

  const win = frame.contentWindow;
  const cleanup = () => window.setTimeout(() => frame.remove(), 1000);
  window.setTimeout(() => {
    try {
      win.focus();
      win.print();
    } finally {
      cleanup();
    }
  }, 250);
}
