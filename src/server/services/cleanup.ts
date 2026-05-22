import fs from "fs";
import path from "path";
import { store } from "./store";
import { JOBS_DIR } from "./magick";

const MAX_AGE_MS = 30 * 60 * 1000;       // 30 minutes hard TTL
const POST_DOWNLOAD_MS = 2 * 60 * 1000;  // 2 minutes after all files downloaded

function removeJob(jobId: string) {
  fs.rm(path.join(JOBS_DIR, jobId), { recursive: true, force: true }, () => {});
  store.delete(jobId);
}

function tick() {
  const now = Date.now();
  for (const job of store.all()) {
    // Hard TTL — remove regardless of state
    if (now - job.createdAt > MAX_AGE_MS) {
      removeJob(job.id);
      continue;
    }

    // Fast cleanup — all completed files have been downloaded
    if (job.status === "completed" || job.status === "failed") {
      const completedFiles = job.files.filter((f) => f.status === "completed");
      const allDownloaded = completedFiles.length > 0 && completedFiles.every((f) => f.downloaded);
      if (allDownloaded && job.completedAt && now - job.completedAt > POST_DOWNLOAD_MS) {
        removeJob(job.id);
      }
    }
  }
}

export function startCleanup(): void {
  setInterval(tick, 60 * 1000); // run every minute
}
