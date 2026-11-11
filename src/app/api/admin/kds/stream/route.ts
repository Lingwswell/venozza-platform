import { ScopeError, getAdminScope, type AdminScope } from "@/lib/auth/scope";
import {
  getKdsRealtimeAdapter,
  getStoreChannel,
  getTenantChannel,
} from "@/lib/realtime/kds-realtime";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token")?.trim();

    console.log("[kds/stream] token recebido?", token ? "SIM" : "NAO");
    const authRequest = token
      ? new Request(req.url, {
          method: "GET",
          headers: {
            authorization: `Bearer ${token}`,
          },
        })
      : req;

    let scope: AdminScope;
    try {
      scope = await getAdminScope(authRequest);
    } catch (error) {
      if (error instanceof ScopeError) return new Response(error.message, { status: error.status });
      throw error;
    }
    const tenantId = scope.tenantId;

    const adapter = getKdsRealtimeAdapter();

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        const sendJson = (payload: unknown) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
          );
        };

        sendJson({ type: "connected", ts: Date.now() });

        // Rede toda: canal da rede. Usuario de loja: so os canais das lojas dele.
        const unsubs = scope.networkWide
          ? [adapter.subscribe(getTenantChannel(tenantId), sendJson)]
          : scope.storeIds.map((storeId) =>
              adapter.subscribe(getStoreChannel(tenantId, storeId), sendJson)
            );

        const heartbeat = setInterval(() => {
          sendJson({ type: "heartbeat", ts: Date.now() });
        }, 15000);

        req.signal.addEventListener("abort", () => {
          clearInterval(heartbeat);
          for (const unsub of unsubs) unsub();
          try {
            controller.close();
          } catch {
            // stream já encerrada
          }
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[api/admin/kds/stream][GET]", error);
    return new Response("Erro ao abrir stream", { status: 500 });
  }
}
