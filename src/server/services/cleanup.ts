import fs from "fs";
import path from "path";
import { store } from "./store";
import { uploadStore } from "./uploadStore";
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

  for (const upload of uploadStore.all()) {
    const ageMs = now - upload.createdAt;
    if (ageMs > MAX_AGE_MS) {
      logger.info("cleanup removing abandoned upload", { uploadId: upload.uploadId, ageSec: Math.round(ageMs / 1000) });
      fs.rm(path.join(JOBS_DIR, "uploads", upload.uploadId), { recursive: true, force: true }, () => {});
      uploadStore.delete(upload.uploadId);
      removed++;
    }
  }

  if (removed > 0) {
    logger.info("cleanup tick done", { removed });
  }
}

export function startCleanup(): void {
  const resolved = path.resolve(JOBS_DIR);

  // Refuse to wipe if running as root
  if (process.getuid?.() === 0) {
    logger.warn("startup purge skipped — refusing to run as root", { dir: resolved });
    return;
  }

  // Ensure the path is a safe subdirectory of /tmp, not /tmp itself or anything outside
  if (!resolved.startsWith("/tmp/") || resolved.length <= "/tmp/".length) {
    logger.warn("startup purge skipped — JOBS_DIR looks unsafe", { dir: resolved });
    return;
  }

  // Refuse to wipe if the path is a symlink (could point anywhere)
  try {
    const stat = fs.lstatSync(resolved);
    if (stat.isSymbolicLink()) {
      logger.warn("startup purge skipped — JOBS_DIR is a symlink", { dir: resolved });
      return;
    }
  } catch {
    // Directory doesn't exist yet — nothing to purge
    return;
  }

  fs.rm(resolved, { recursive: true, force: true }, (err) => {
    if (err) logger.warn("startup purge failed", { err: err.message });
    else logger.info("startup purge done", { dir: resolved });
  });

  logger.info("cleanup scheduler started", { intervalSec: 60, ttlMin: 30 });
  setInterval(tick, 60 * 1000);
}
