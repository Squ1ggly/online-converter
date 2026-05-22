import fs from "fs";
import path from "path";
import { store } from "./store";
import { JOBS_DIR } from "./magick";
import { logger } from "./logger";

const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes hard TTL

function removeJob(jobId: string) {
  fs.rm(path.join(JOBS_DIR, jobId), { recursive: true, force: true }, (err) => {
    if (err) logger.warn("cleanup rm failed", { jobId, err: err.message });
  });
  store.delete(jobId);
}

function tick() {
  const now = Date.now();
  let removed = 0;
  for (const job of store.all()) {
    const ageMs = now - job.createdAt;
    if (ageMs > MAX_AGE_MS) {
      logger.info("cleanup removing job", { jobId: job.id, ageSec: Math.round(ageMs / 1000) });
      removeJob(job.id);
      removed++;
    }
  }
  if (removed > 0) {
    logger.info("cleanup tick done", { removed });
  }
}

export function startCleanup(): void {
  logger.info("cleanup scheduler started", { intervalSec: 60, ttlMin: 30 });
  setInterval(tick, 60 * 1000);
}
