import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

type OrderItem = {
  id: number;
  name: string;
  quantity: number;
  price_cents?: number;
  image?: string;
  note?: string;
  addons?: string[];
  size?: string;
  crust?: string;
};

type OrderPayload = {
  customerName?: string;
  phone?: string;
  address?: string;
  notes?: string;
  items?: OrderItem[];
  subtotal?: number;
  subtotal_cents?: number;
  deliveryFee?: number;
  freight_cents?: number;
  total?: number;
  total_cents?: number;
  paymentMethod?: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(ORDERS_FILE)) {
    fs.writeFileSync(ORDERS_FILE, "[]", "utf-8");
  }
}

function readOrders() {
  ensureStorage();

  try {
    const raw = fs.readFileSync(ORDERS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOrders(data: unknown[]) {
  ensureStorage();
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function GET() {
  try {
    const orders = readOrders();
    return NextResponse.json({ ok: true, orders });
  } catch (error) {
    console.error("[api/orders][GET]", error);
    return NextResponse.json(
      { ok: false, error: "Erro ao listar pedidos." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OrderPayload;

    const items = Array.isArray(body.items) ? body.items : [];

    if (!body.customerName?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Nome é obrigatório." },
        { status: 400 }
      );
    }

    if (!body.phone?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Telefone é obrigatório." },
        { status: 400 }
      );
    }

    if (!body.address?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Endereço é obrigatório." },
        { status: 400 }
      );
    }

    if (items.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Carrinho vazio." },
        { status: 400 }
      );
    }

    const subtotal_cents =
      typeof body.subtotal_cents === "number"
        ? body.subtotal_cents
        : items.reduce(
            (sum, item) =>
              sum + Number(item.price_cents || 0) * Number(item.quantity || 0),
            0
          );

    const freight_cents =
      typeof body.freight_cents === "number"
        ? body.freight_cents
        : Math.round(Number(body.deliveryFee || 0) * 100);

    const total_cents =
      typeof body.total_cents === "number"
        ? body.total_cents
        : subtotal_cents + freight_cents;

    const orders = readOrders();

    const orderCode = `VZ-${Date.now()}`;

    const order = {
      id: Date.now(),
      orderId: orderCode,
      orderCode,
      customerName: body.customerName,
      phone: body.phone,
      address: body.address,
      notes: body.notes || "",
      items,
      subtotal: subtotal_cents / 100,
      subtotal_cents,
      deliveryFee: freight_cents / 100,
      freight_cents,
      total: total_cents / 100,
      total_cents,
      paymentMethod: body.paymentMethod || "pix",
      status: "novo",
      createdAt: new Date().toISOString(),
    };

    orders.unshift(order);
    writeOrders(orders);

    return NextResponse.json({
      ok: true,
      order,
    });
  } catch (error) {
    console.error("[api/orders][POST]", error);
    return NextResponse.json(
      { ok: false, error: "Erro ao salvar pedido." },
      { status: 500 }
    );
  }
}
