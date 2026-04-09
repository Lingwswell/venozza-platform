import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "orders.json");

type OrderStatus =
  | "novo"
  | "confirmado"
  | "preparo"
  | "forno"
  | "pronto"
  | "saiu_entrega"
  | "entregue"
  | "cancelado";

type OrderRecord = {
  orderId: string;
  customerName: string;
  phone: string;
  address: string;
  notes: string;
  items: unknown[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
};

function ensureDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, "[]", "utf-8");
  }
}

function readOrders(): OrderRecord[] {
  ensureDb();

  try {
    const raw = fs.readFileSync(DB_PATH, "utf-8").trim();

    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOrders(orders: OrderRecord[]) {
  ensureDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(orders, null, 2), "utf-8");
}

function nextOrderCode(existing: OrderRecord[]) {
  const numbers = existing
    .map((item) => {
      const code = String(item.orderId || "");
      const match = code.match(/^VZ-(\d+)$/);
      return match ? Number(match[1]) : 0;
    })
    .filter((n) => Number.isFinite(n));

  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return `VZ-${String(next).padStart(4, "0")}`;
}

export async function GET() {
  const orders = readOrders();
  return NextResponse.json({ ok: true, orders });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const orders = readOrders();

    const newOrder: OrderRecord = {
      orderId: nextOrderCode(orders),
      customerName: String(body.customerName || "").trim(),
      phone: String(body.phone || "").trim(),
      address: String(body.address || "").trim(),
      notes: String(body.notes || "").trim(),
      items: Array.isArray(body.items) ? body.items : [],
      subtotal: Number(body.subtotal || 0),
      deliveryFee: Number(body.deliveryFee || 0),
      total: Number(body.total || 0),
      paymentMethod: String(body.paymentMethod || "pix"),
      status: "novo",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!newOrder.customerName) {
      return NextResponse.json(
        { ok: false, error: "Nome é obrigatório." },
        { status: 400 }
      );
    }

    if (!newOrder.phone) {
      return NextResponse.json(
        { ok: false, error: "Telefone é obrigatório." },
        { status: 400 }
      );
    }

    if (!newOrder.address) {
      return NextResponse.json(
        { ok: false, error: "Endereço é obrigatório." },
        { status: 400 }
      );
    }

    if (!newOrder.items.length) {
      return NextResponse.json(
        { ok: false, error: "Carrinho vazio." },
        { status: 400 }
      );
    }

    const nextOrders = [newOrder, ...orders];
    writeOrders(nextOrders);

    return NextResponse.json({ ok: true, order: newOrder });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Erro ao salvar pedido." },
      { status: 500 }
    );
  }
}
