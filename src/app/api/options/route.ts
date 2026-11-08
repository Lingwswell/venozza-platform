import { NextResponse } from "next/server";
import { AppError } from "@/lib/api/errors";
import { loadOptionCatalog } from "@/lib/options-catalog";
import { clientKey, rateLimit } from "@/lib/rate-limit";

// Opcoes (tamanho, borda, massa, bebidas...) da loja. Dado publico: o cardapio do cliente usa.
export async function GET(req: Request) {
  if (!rateLimit(`options:${clientKey(req)}`, 1200, 60 * 1000)) {
    return NextResponse.json(
      { ok: false, error: "Muitas consultas. Tente novamente em instantes." },
      { status: 429 }
    );
  }

  const storeId = (req.headers.get("x-store-id") || "").trim();

  if (!storeId) {
    return NextResponse.json(
      { ok: false, error: "Loja não informada." },
      { status: 400 }
    );
  }

  try {
    const catalog = await loadOptionCatalog(storeId);

    return NextResponse.json(
      { ok: true, ...catalog },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }

    console.error("[api/options][GET]", error);

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar opções." },
      { status: 500 }
    );
  }
}
