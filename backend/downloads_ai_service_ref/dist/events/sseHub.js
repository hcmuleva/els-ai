/**
 * ASSUMPTION: swap this for @els-ai/event-bus if ai-service ever runs with
 * more than one replica — a local EventEmitter-style hub only delivers
 * events to clients connected to *this* process. The publish/subscribe
 * shape below (subscribe(jobId, cb) / publish(jobId, event)) is written so
 * that swap is a drop-in: replace the two methods' bodies with the bus's
 * pub/sub calls, keep the same signatures.
 */
class SseHub {
    clients = new Map();
    subscribe(jobId, res) {
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        });
        res.write(`retry: 2000\n\n`);
        const set = this.clients.get(jobId) ?? new Set();
        set.add(res);
        this.clients.set(jobId, set);
        res.on("close", () => {
            this.clients.get(jobId)?.delete(res);
        });
    }
    publish(jobId, event) {
        const set = this.clients.get(jobId);
        if (!set || set.size === 0)
            return;
        const payload = `event: ${event.event}\ndata: ${JSON.stringify(event)}\n\n`;
        for (const res of set) {
            res.write(payload);
        }
    }
    closeAll(jobId) {
        const set = this.clients.get(jobId);
        if (!set)
            return;
        for (const res of set)
            res.end();
        this.clients.delete(jobId);
    }
}
export const sseHub = new SseHub();
//# sourceMappingURL=sseHub.js.map