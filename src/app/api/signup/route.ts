import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/db";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { NetworkInputError, createNetwork } from "@/lib/billing/network";

// Cadastro publico de uma rede nova (pagina /comecar). Desligue com PUBLIC_SIGNUP=off.

function signupEnabled() {
  return String(process.env.PUBLIC_SIGNUP || "on").toLowerCase() !== "off";
}

export async function GET() {
  if (!signupEnabled()) return NextResponse.json({ ok: true, enabled: false, plans: [] });
  const plans = await prisma.plan.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, description: true, priceCents: true, trialDays: true, maxStores: true },
  });
  return NextResponse.json({ ok: true, enabled: true, plans });
}

export async function POST(req: Request) {
  try {
    if (!signupEnabled()) {
      return NextResponse.json({ ok: false, error: "Cadastro fechado no momento." }, { status: 403 });
    }
    if (!rateLimit(`signup-ip:${clientKey(req)}`, 5, 60 * 60 * 1000)) {
      return NextResponse.json({ ok: false, error: "Muitas tentativas. Tente de novo mais tarde." }, { status: 429 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    // Campo escondido: robo preenche, gente nao.
    if (String(body.website || "").trim()) return NextResponse.json({ ok: false, error: "Cadastro recusado." }, { status: 400 });

    const { user } = await createNetwork({
      name: body.name,
      ownerName: body.ownerName,
      ownerEmail: body.ownerEmail,
      ownerPassword: body.ownerPassword,
      planId: body.planId,
      // O prazo de teste vem do plano; o cadastro publico nao escolhe.
    });

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET não configurado");
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, tenantId: user.tenantId, storeId: user.storeId },
      secret,
      { expiresIn: "7d" }
    );

    return NextResponse.json({ ok: true, token, user: { ...user, platformAdmin: false } }, { status: 201 });
  } catch (error) {
    if (error instanceof NetworkInputError) {
      return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
    }
    console.error("[api/signup][POST]", error);
    return NextResponse.json({ ok: false, error: "Erro ao criar sua conta." }, { status: 500 });
  }
}
