import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  DEFAULT_STORE_SETTINGS,
  normalizeOpeningHours,
  type StoreSettingsData,
} from "@/lib/store/settings-shared";

type StoreSettingsRow = {
  manualClosed: boolean;
  closedMessage: string | null;
  timezone: string;
  openingHours: unknown;
  deliveryTimeMinMinutes: number;
  deliveryTimeMaxMinutes: number;
  minimumOrderCents: number;
  deliveryFeeCents: number;
  freeDeliveryAboveCents: number | null;
  whatsapp: string | null;
  paymentPix: boolean;
  paymentCash: boolean;
  paymentCredit: boolean;
  paymentDebit: boolean;
};

export function toSettingsData(row: StoreSettingsRow | null): StoreSettingsData {
  if (!row) return { ...DEFAULT_STORE_SETTINGS };

  return {
    manualClosed: row.manualClosed,
    closedMessage: row.closedMessage,
    timezone: row.timezone || DEFAULT_STORE_SETTINGS.timezone,
    openingHours: normalizeOpeningHours(row.openingHours),
    deliveryTimeMinMinutes: row.deliveryTimeMinMinutes,
    deliveryTimeMaxMinutes: row.deliveryTimeMaxMinutes,
    minimumOrderCents: row.minimumOrderCents,
    deliveryFeeCents: row.deliveryFeeCents,
    freeDeliveryAboveCents: row.freeDeliveryAboveCents,
    whatsapp: row.whatsapp,
    paymentPix: row.paymentPix,
    paymentCash: row.paymentCash,
    paymentCredit: row.paymentCredit,
    paymentDebit: row.paymentDebit,
  };
}

export async function loadStoreSettings(storeId: string): Promise<StoreSettingsData> {
  const row = await prisma.storeSettings.findUnique({ where: { storeId } });
  return toSettingsData(row);
}

export class SettingsValidationError extends Error {}

function readInt(value: unknown, field: string, min = 0, max = 10_000_000): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || !Number.isInteger(n)) {
    throw new SettingsValidationError(`Valor inválido em ${field}.`);
  }
  if (n < min || n > max) {
    throw new SettingsValidationError(`${field} fora do limite permitido.`);
  }
  return n;
}

function readText(value: unknown, max: number): string | null {
  if (value === null || typeof value === "undefined") return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, max);
}

/**
 * Converte o corpo do PATCH em dados para o banco. So aceita os campos conhecidos;
 * campos ausentes nao sao alterados.
 */
export function parseSettingsPatch(
  body: Record<string, unknown>
): Prisma.StoreSettingsUncheckedUpdateInput {
  const data: Prisma.StoreSettingsUncheckedUpdateInput = {};

  if ("manualClosed" in body) data.manualClosed = body.manualClosed === true;
  if ("closedMessage" in body) data.closedMessage = readText(body.closedMessage, 200);
  if ("whatsapp" in body) {
    const digits = String(body.whatsapp ?? "").replace(/\D/g, "");
    data.whatsapp = digits ? digits.slice(0, 15) : null;
  }

  if ("timezone" in body) {
    const tz = readText(body.timezone, 60) || DEFAULT_STORE_SETTINGS.timezone;
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
    } catch {
      throw new SettingsValidationError("Fuso horário inválido.");
    }
    data.timezone = tz;
  }

  if ("openingHours" in body) {
    if (body.openingHours === null) {
      data.openingHours = Prisma.DbNull;
    } else {
      const hours = normalizeOpeningHours(body.openingHours);
      if (!hours) {
        throw new SettingsValidationError("Horários inválidos. Use o formato HH:MM.");
      }
      data.openingHours = hours;
    }
  }

  if ("deliveryTimeMinMinutes" in body) {
    data.deliveryTimeMinMinutes = readInt(body.deliveryTimeMinMinutes, "Tempo mínimo", 1, 600);
  }
  if ("deliveryTimeMaxMinutes" in body) {
    data.deliveryTimeMaxMinutes = readInt(body.deliveryTimeMaxMinutes, "Tempo máximo", 1, 600);
  }
  if (
    typeof data.deliveryTimeMinMinutes === "number" &&
    typeof data.deliveryTimeMaxMinutes === "number" &&
    data.deliveryTimeMaxMinutes < data.deliveryTimeMinMinutes
  ) {
    throw new SettingsValidationError("O tempo máximo não pode ser menor que o mínimo.");
  }

  if ("minimumOrderCents" in body) {
    data.minimumOrderCents = readInt(body.minimumOrderCents, "Pedido mínimo");
  }
  if ("deliveryFeeCents" in body) {
    data.deliveryFeeCents = readInt(body.deliveryFeeCents, "Taxa de entrega");
  }
  if ("freeDeliveryAboveCents" in body) {
    data.freeDeliveryAboveCents =
      body.freeDeliveryAboveCents === null || body.freeDeliveryAboveCents === ""
        ? null
        : readInt(body.freeDeliveryAboveCents, "Frete grátis acima de");
  }

  if ("paymentPix" in body) data.paymentPix = body.paymentPix === true;
  if ("paymentCash" in body) data.paymentCash = body.paymentCash === true;
  if ("paymentCredit" in body) data.paymentCredit = body.paymentCredit === true;
  if ("paymentDebit" in body) data.paymentDebit = body.paymentDebit === true;

  return data;
}

// Campos que um operador (funcionario da loja) pode mudar: so abrir/fechar.
export const OPERATOR_FIELDS = ["manualClosed", "closedMessage"] as const;
