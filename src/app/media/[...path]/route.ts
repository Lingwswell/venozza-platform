import { readFile, stat } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

// Serve as imagens enviadas pelo admin (storage/uploads) em tempo de execucao.
// Tambem procura em public/uploads para arquivos antigos enviados antes desta rota.

const ROOTS = [
  path.join(process.cwd(), "storage", "uploads"),
  path.join(process.cwd(), "public", "uploads"),
];

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  _req: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: parts } = await context.params;

  // So nomes simples: bloqueia "..", barras e caracteres estranhos.
  if (!parts.length || parts.some((part) => !/^[a-zA-Z0-9._-]+$/.test(part) || part.startsWith("."))) {
    return new NextResponse("Not found", { status: 404 });
  }

  const contentType = CONTENT_TYPES[path.extname(parts[parts.length - 1]).toLowerCase()];
  if (!contentType) return new NextResponse("Not found", { status: 404 });

  for (const root of ROOTS) {
    const filePath = path.join(root, ...parts);
    if (!filePath.startsWith(root + path.sep)) continue;

    try {
      const info = await stat(filePath);
      if (!info.isFile()) continue;

      const data = await readFile(filePath);
      return new NextResponse(new Uint8Array(data), {
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(info.size),
          // Nome do arquivo tem timestamp: pode ficar em cache por muito tempo.
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      // tenta a proxima pasta
    }
  }

  return new NextResponse("Not found", { status: 404 });
}
