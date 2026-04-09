import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "orders.json");

function readOrders() {
  try {
    if (!fs.existsSync(DB_PATH)) return [];
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await context.params;

  const orders = readOrders();

  const order = orders.find(
    (item: any) =>
      String(item.orderId).trim().toUpperCase() === codigo.trim().toUpperCase()
  );

  if (!order) {
    return NextResponse.json(
      { ok: false, error: "Pedido não encontrado" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, order });
}
