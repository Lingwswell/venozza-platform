import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getAuthContextFromRequest } from "@/lib/auth/context";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_TYPES = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function sanitizeBaseName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeRole(role: string | null | undefined) {
  if (role === "super_admin") return "super_admin";
  if (role === "owner") return "owner";
  if (role === "operator") return "operator";
  return "customer";
}

export async function POST(req: Request) {
  try {
    let auth: {
      tenantId?: string | null;
      role?: string | null;
    } = {};

    try {
      auth = await getAuthContextFromRequest(req);
    } catch (error) {
      console.warn("[api/admin/uploads/product-image][auth]", error);
    }

    const role = normalizeRole(auth.role);

    if (!auth.tenantId) {
      return NextResponse.json(
        { ok: false, error: "tenantId obrigatório" },
        { status: 400 }
      );
    }

    if (role === "customer") {
      return NextResponse.json(
        { ok: false, error: "Acesso administrativo obrigatório" },
        { status: 403 }
      );
    }

    let formData: FormData;

    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Arquivo de imagem é obrigatório" },
        { status: 400 }
      );
    }

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Arquivo de imagem é obrigatório" },
        { status: 400 }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { ok: false, error: "Arquivo vazio" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Imagem muito grande. Limite: 5MB" },
        { status: 400 }
      );
    }

    const extension = ALLOWED_TYPES.get(file.type);

    if (!extension) {
      return NextResponse.json(
        { ok: false, error: "Formato inválido. Use JPG, PNG ou WEBP." },
        { status: 400 }
      );
    }

    const originalName = file.name || "produto";
    const baseName = sanitizeBaseName(originalName.replace(/\.[^.]+$/, "")) || "produto";
    const tenantPrefix = sanitizeBaseName(auth.tenantId || "tenant");
    const fileName = `${tenantPrefix}-${baseName}-${Date.now()}.${extension}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads", "products");
    await mkdir(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filePath = path.join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    const url = `/uploads/products/${fileName}`;

    return NextResponse.json({
      ok: true,
      url,
      fileName,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error("[api/admin/uploads/product-image][POST]", error);

    return NextResponse.json(
      { ok: false, error: "Erro ao enviar imagem" },
      { status: 500 }
    );
  }
}
