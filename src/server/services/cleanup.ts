import fs from "fs";
import path from "path";
import { store } from "./store";
import { JOBS_DIR } from "./magick";

const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes hard TTL

function removeJob(jobId: string) {
  fs.rm(path.join(JOBS_DIR, jobId), { recursive: true, force: true }, () => {});
  store.delete(jobId);
}

function tick() {
  const now = Date.now();
  for (const job of store.all()) {
    if (now - job.createdAt > MAX_AGE_MS) {
      removeJob(job.id);
    }
  }
}

export function startCleanup(): void {
  setInterval(tick, 60 * 1000); // run every minute
}
