import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "@/lib/auth/context";
import { lookupAddress, onlyDigits } from "@/lib/address-lookup";

// GET /api/admin/address-lookup?cep=01001000&number=123&street=...
// Preenche endereco pelo CEP e calcula as coordenadas. So para usuarios do admin.

export async function GET(req: Request) {
  try {
    await getAuthContextFromRequest(req);
  } catch {
    return NextResponse.json({ ok: false, error: "Sessão inválida. Entre novamente." }, { status: 401 });
  }

  const url = new URL(req.url);
  const cep = onlyDigits(url.searchParams.get("cep") || "");

  if (cep.length !== 8) {
    return NextResponse.json({ ok: false, error: "CEP deve ter 8 números." }, { status: 400 });
  }

  const result = await lookupAddress({
    zipCode: cep,
    number: url.searchParams.get("number"),
    street: url.searchParams.get("street"),
  });

  if (!result) {
    return NextResponse.json(
      { ok: false, error: "CEP não encontrado (ou serviço de CEP fora do ar)." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, address: result });
}
