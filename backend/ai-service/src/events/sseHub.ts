import type { Response } from "express";
import type { GenerationEvent } from "../generation/types.js";

/**
 * ASSUMPTION: swap this for @els-ai/event-bus if ai-service ever runs with
 * more than one replica — a local EventEmitter-style hub only delivers
 * events to clients connected to *this* process. The publish/subscribe
 * shape below (subscribe(jobId, cb) / publish(jobId, event)) is written so
 * that swap is a drop-in: replace the two methods' bodies with the bus's
 * pub/sub calls, keep the same signatures.
 */
class SseHub {
  private clients = new Map<string, Set<Response>>();

  subscribe(jobId: string, res: Response) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(`retry: 2000\n\n`);

    const set = this.clients.get(jobId) ?? new Set<Response>();
    set.add(res);
    this.clients.set(jobId, set);

    res.on("close", () => {
      this.clients.get(jobId)?.delete(res);
    });
  }

  publish(jobId: string, event: GenerationEvent) {
    const set = this.clients.get(jobId);
    if (!set || set.size === 0) return;
    const payload = `event: ${event.event}\ndata: ${JSON.stringify(event)}\n\n`;
    for (const res of set) {
      res.write(payload);
    }
  }

  closeAll(jobId: string) {
    const set = this.clients.get(jobId);
    if (!set) return;
    for (const res of set) res.end();
    this.clients.delete(jobId);
  }
}

export const sseHub = new SseHub();
