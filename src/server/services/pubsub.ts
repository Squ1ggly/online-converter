import type { Server } from "bun";

let _server: Server<unknown> | null = null;

export function registerServer(s: Server<unknown>): void {
  _server = s;
}

export function publishJob(jobId: string, payload: string): void {
  _server?.publish(`job:${jobId}`, payload);
}
