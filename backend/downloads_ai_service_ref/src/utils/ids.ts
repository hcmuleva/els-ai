import { randomUUID } from "node:crypto";

export function newJobId(): string {
  return `job_${randomUUID()}`;
}

export function newContentId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}
