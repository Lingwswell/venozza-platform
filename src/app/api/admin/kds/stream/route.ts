import { getAuthContextFromRequest } from "@/lib/auth/context";
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

    const auth = await getAuthContextFromRequest(authRequest);

    if (!auth.tenantId) {
      return new Response("tenantId obrigatório", { status: 400 });
    }

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

        const tenantUnsub = adapter.subscribe(
          getTenantChannel(auth.tenantId!),
          sendJson
        );

        const storeUnsub =
          auth.storeId
            ? adapter.subscribe(
                getStoreChannel(auth.tenantId!, auth.storeId),
                sendJson
              )
            : () => {};

        const heartbeat = setInterval(() => {
          sendJson({ type: "heartbeat", ts: Date.now() });
        }, 15000);

        req.signal.addEventListener("abort", () => {
          clearInterval(heartbeat);
          tenantUnsub();
          storeUnsub();
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
