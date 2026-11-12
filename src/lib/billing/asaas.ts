// Cliente do Asaas (cobranca recorrente: Pix, boleto e cartao).
// So funciona com ASAAS_API_KEY no .env. ASAAS_ENV=production usa a conta real;
// qualquer outro valor usa o sandbox (testes).

export class AsaasError extends Error {}

export function asaasConfigured() {
  return Boolean(String(process.env.ASAAS_API_KEY || "").trim());
}

function baseUrl() {
  return process.env.ASAAS_ENV === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
}

async function asaas<T>(method: string, path: string, body?: unknown): Promise<T> {
  const key = String(process.env.ASAAS_API_KEY || "").trim();
  if (!key) throw new AsaasError("Cobrança automática não configurada (falta ASAAS_API_KEY).");

  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "venozza-platform",
      access_token: key,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const errors = (data as { errors?: { description?: string }[] } | null)?.errors;
    const message = errors?.map((e) => e.description).filter(Boolean).join(" ") || `Asaas respondeu ${res.status}.`;
    throw new AsaasError(message);
  }
  return data as T;
}

export type AsaasPayment = {
  id: string;
  subscription?: string | null;
  value: number;
  dueDate: string;
  status: string;
  invoiceUrl?: string | null;
  billingType?: string | null;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  description?: string | null;
};

export async function createCustomer(input: { name: string; cpfCnpj: string; email?: string | null; externalReference: string }) {
  const data = await asaas<{ id: string }>("POST", "/customers", {
    name: input.name,
    cpfCnpj: input.cpfCnpj,
    email: input.email || undefined,
    externalReference: input.externalReference,
    notificationDisabled: false,
  });
  return data.id;
}

export async function createSubscription(input: {
  customer: string;
  valueCents: number;
  nextDueDate: string;
  description: string;
  externalReference: string;
}) {
  const data = await asaas<{ id: string }>("POST", "/subscriptions", {
    customer: input.customer,
    // UNDEFINED: o cliente escolhe Pix, boleto ou cartao na pagina da fatura.
    billingType: "UNDEFINED",
    value: Math.round(input.valueCents) / 100,
    nextDueDate: input.nextDueDate,
    cycle: "MONTHLY",
    description: input.description,
    externalReference: input.externalReference,
  });
  return data.id;
}

export async function updateSubscriptionValue(id: string, valueCents: number, description?: string) {
  await asaas("PUT", `/subscriptions/${encodeURIComponent(id)}`, {
    value: Math.round(valueCents) / 100,
    ...(description ? { description } : {}),
    updatePendingPayments: true,
  });
}

export async function cancelSubscription(id: string) {
  await asaas("DELETE", `/subscriptions/${encodeURIComponent(id)}`);
}

export async function listSubscriptionPayments(id: string) {
  const data = await asaas<{ data?: AsaasPayment[] }>(
    "GET",
    `/subscriptions/${encodeURIComponent(id)}/payments?limit=24`
  );
  return data.data || [];
}

/** Status do Asaas -> status da nossa fatura. */
export function invoiceStatusFromAsaas(status: string) {
  switch (status) {
    case "RECEIVED":
    case "CONFIRMED":
    case "RECEIVED_IN_CASH":
      return "paid";
    case "OVERDUE":
      return "overdue";
    case "REFUNDED":
    case "REFUND_REQUESTED":
    case "CHARGEBACK_REQUESTED":
      return "refunded";
    case "DELETED":
      return "canceled";
    default:
      return "pending";
  }
}

/** Data YYYY-MM-DD no fuso de Sao Paulo. */
export function isoDateSP(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
}

/** CPF (11) ou CNPJ (14) so com numeros; null se invalido. */
export function cleanDocument(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 11 || digits.length === 14 ? digits : null;
}
