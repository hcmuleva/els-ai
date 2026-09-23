import { randomUUID } from "node:crypto";
export function newJobId() {
    return `job_${randomUUID()}`;
}
export function newContentId(prefix) {
    return `${prefix}_${randomUUID()}`;
}
//# sourceMappingURL=ids.js.map