import { NextRequest } from "next/server";
import { runScan } from "@/lib/scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function sseHeaders() {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive"
  };
}

function formatSse(event: string, data: unknown) {
  return `event: ${event}
data: ${JSON.stringify(data)}

`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const pages = clampInt(url.searchParams.get("pages"), 1, 10, 4);
  const maxPerPage = clampInt(url.searchParams.get("maxPerPage"), 5, 50, 24);
  const minScore = clampFloat(url.searchParams.get("minScore"), 0, 1, 0.15);

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode(formatSse(event, payload)));
      };

      try {
        await runScan({
          pagesPerKeyword: pages,
          maxPerPage,
          minScore,
          onProgress: (p) => send("progress", p),
          onResult: (r) => send("result", { item: r })
        });
        send("done", { 
          type: "done", 
          message: "Scan complete." 
        });
      } catch (e: any) {
        send("error", { 
          type: "error", 
          message: e?.message ?? "Unknown error" 
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, { headers: sseHeaders() });
}

function clampInt(v: string | null, min: number, max: number, fallback: number) {
  const n = v ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function clampFloat(v: string | null, min: number, max: number, fallback: number) {
  const n = v ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
