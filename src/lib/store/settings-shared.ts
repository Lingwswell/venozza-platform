// Regras de configuracao da loja que rodam tanto no servidor quanto no navegador.
// Nao importar prisma aqui: este arquivo e usado por paginas "use client".

export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export const DAY_LABELS: Record<DayKey, string> = {
  mon: "Segunda-feira",
  tue: "Terça-feira",
  wed: "Quarta-feira",
  thu: "Quinta-feira",
  fri: "Sexta-feira",
  sat: "Sábado",
  sun: "Domingo",
};

export type DayHours = {
  active: boolean;
  open: string; // "HH:MM"
  close: string; // "HH:MM" — se for <= open, fecha no dia seguinte
};

export type OpeningHours = Record<DayKey, DayHours>;

export type PaymentMethodKey = "pix" | "credito" | "debito" | "dinheiro";

export const PAYMENT_LABELS: Record<PaymentMethodKey, string> = {
  pix: "PIX",
  credito: "Cartão de crédito",
  debito: "Cartão de débito",
  dinheiro: "Dinheiro",
};

export type StoreSettingsData = {
  manualClosed: boolean;
  closedMessage: string | null;
  timezone: string;
  openingHours: OpeningHours | null;
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
  pickupEnabled: boolean;
};

// Usado quando a loja ainda nao tem linha em store_settings.
export const DEFAULT_STORE_SETTINGS: StoreSettingsData = {
  manualClosed: false,
  closedMessage: null,
  timezone: "America/Sao_Paulo",
  openingHours: null, // null = sem horario cadastrado = sempre aberta
  deliveryTimeMinMinutes: 30,
  deliveryTimeMaxMinutes: 45,
  minimumOrderCents: 0,
  deliveryFeeCents: 500,
  freeDeliveryAboveCents: null,
  whatsapp: null,
  paymentPix: true,
  paymentCash: true,
  paymentCredit: false,
  paymentDebit: false,
  pickupEnabled: true,
};

export function defaultOpeningHours(): OpeningHours {
  return DAY_KEYS.reduce((acc, key) => {
    acc[key] = { active: true, open: "18:00", close: "23:00" };
    return acc;
  }, {} as OpeningHours);
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: unknown): value is string {
  return typeof value === "string" && TIME_RE.test(value);
}

export function normalizeOpeningHours(raw: unknown): OpeningHours | null {
  if (!raw || typeof raw !== "object") return null;

  const source = raw as Record<string, unknown>;
  const result = {} as OpeningHours;

  for (const key of DAY_KEYS) {
    const day = source[key] as Partial<DayHours> | undefined;

    if (!day || !isValidTime(day.open) || !isValidTime(day.close)) {
      return null;
    }

    result[key] = {
      active: day.active !== false,
      open: day.open,
      close: day.close,
    };
  }

  return result;
}

export function enabledPaymentMethods(
  settings: StoreSettingsData
): { key: PaymentMethodKey; label: string }[] {
  const list: { key: PaymentMethodKey; enabled: boolean }[] = [
    { key: "pix", enabled: settings.paymentPix },
    { key: "credito", enabled: settings.paymentCredit },
    { key: "debito", enabled: settings.paymentDebit },
    { key: "dinheiro", enabled: settings.paymentCash },
  ];

  return list
    .filter((item) => item.enabled)
    .map((item) => ({ key: item.key, label: PAYMENT_LABELS[item.key] }));
}

export function computeDeliveryFeeCents(
  settings: StoreSettingsData,
  subtotalCents: number
): number {
  if (subtotalCents <= 0) return 0;

  if (
    typeof settings.freeDeliveryAboveCents === "number" &&
    settings.freeDeliveryAboveCents > 0 &&
    subtotalCents >= settings.freeDeliveryAboveCents
  ) {
    return 0;
  }

  return Math.max(0, settings.deliveryFeeCents);
}

function toMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

// Dia da semana e minuto do dia no fuso da loja.
function zonedNow(timezone: string, now: Date): { day: DayKey; minutes: number } {
  let parts: Intl.DateTimeFormatPart[];

  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  }

  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const weekdayMap: Record<string, DayKey> = {
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
    Sat: "sat",
    Sun: "sun",
  };

  return {
    day: weekdayMap[get("weekday")] || "mon",
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

export type OpenStatus = {
  open: boolean;
  reason: "manual" | "hours" | null;
  message: string;
};

export function getOpenStatus(
  settings: StoreSettingsData,
  now: Date = new Date()
): OpenStatus {
  const closedText =
    settings.closedMessage?.trim() || "Estamos fechados no momento.";

  if (settings.manualClosed) {
    return { open: false, reason: "manual", message: closedText };
  }

  const hours = settings.openingHours;
  if (!hours) return { open: true, reason: null, message: "" };

  const { day, minutes } = zonedNow(settings.timezone, now);
  const dayIndex = DAY_KEYS.indexOf(day);
  const previous = DAY_KEYS[(dayIndex + 6) % 7];

  const today = hours[day];
  if (today?.active) {
    const open = toMinutes(today.open);
    const close = toMinutes(today.close);
    const overnight = close <= open;

    if (overnight ? minutes >= open : minutes >= open && minutes < close) {
      return { open: true, reason: null, message: "" };
    }
  }

  // Expediente que comecou ontem e passa da meia-noite.
  const yesterday = hours[previous];
  if (yesterday?.active) {
    const open = toMinutes(yesterday.open);
    const close = toMinutes(yesterday.close);

    if (close <= open && minutes < close) {
      return { open: true, reason: null, message: "" };
    }
  }

  const opensAt = today?.active && minutes < toMinutes(today.open) ? today.open : null;

  return {
    open: false,
    reason: "hours",
    message: settings.closedMessage?.trim()
      ? settings.closedMessage.trim()
      : opensAt
        ? `Fechado agora. Abrimos hoje às ${opensAt}.`
        : "Fechado agora. Confira nosso horário de funcionamento.",
  };
}

export function formatDeliveryTime(settings: StoreSettingsData) {
  const min = settings.deliveryTimeMinMinutes;
  const max = settings.deliveryTimeMaxMinutes;
  return max > min ? `${min}–${max} min` : `${min} min`;
}
