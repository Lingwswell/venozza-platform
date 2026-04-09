import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { available: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      ok: true,
      items: products,
    });
  } catch (error) {
    console.error("Erro ao listar produtos:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Erro ao buscar produtos",
      },
      { status: 500 }
    );
  }
}
