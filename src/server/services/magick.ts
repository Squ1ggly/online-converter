import path from "path";
import fs from "fs";
import type { ConversionOptions, ImageFormat } from "../../shared/types";
import { logger } from "./logger";

export const JOBS_DIR = "/tmp/online-converter";

const ALLOWED_FORMATS = new Set([
  "avif", "bmp", "gif", "heic", "jpeg", "jpg", "pdf", "png", "svg", "tiff", "webp",
]);

// Prevent path traversal - all paths must stay within JOBS_DIR
function assertSafePath(p: string): void {
  const resolved = path.resolve(p);
  const base = path.resolve(JOBS_DIR);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error(`Unsafe path rejected: ${p}`);
  }
}

export function assertFormat(format: string): asserts format is ImageFormat {
  if (!ALLOWED_FORMATS.has(format.toLowerCase())) {
    throw new Error(`Unsupported format: ${format}`);
  }
}

export function ensureJobDirs(jobId: string): { inputDir: string; outputDir: string } {
  const inputDir = path.join(JOBS_DIR, jobId, "input");
  const outputDir = path.join(JOBS_DIR, jobId, "output");
  fs.mkdirSync(inputDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });
  return { inputDir, outputDir };
}

export async function convertImage(
  inputPath: string,
  outputPath: string,
  options: ConversionOptions = {},
  jobId?: string,
  fileId?: string,
): Promise<void> {
  assertSafePath(inputPath);
  assertSafePath(outputPath);

  const args: string[] = [inputPath];

  if (options.quality !== undefined) {
    args.push("-quality", String(Math.max(1, Math.min(100, options.quality))));
  }
  if (options.resize) {
    // Only allow safe resize patterns: "800x600", "800x", "x600", "50%"
    if (!/^\d*x?\d*%?$/.test(options.resize) || options.resize === "") {
      throw new Error(`Invalid resize value: ${options.resize}`);
    }
    args.push("-resize", options.resize);
  }

  args.push(outputPath);

  const format = path.extname(outputPath).slice(1);
  logger.info("magick start", { jobId, fileId, format, quality: options.quality, resize: options.resize });

  const proc = Bun.spawn({
    cmd: ["convert", ...args],
    env: {
      // Minimal env - restrict what ImageMagick can access
      PATH: process.env.PATH,
      HOME: JOBS_DIR,
      MAGICK_DISK_LIMIT: "1GB",
      MAGICK_MEMORY_LIMIT: "512MB",
      MAGICK_MAP_LIMIT: "512MB",
      MAGICK_TIME_LIMIT: "60",
      MAGICK_THREAD_LIMIT: "2",
    },
    stdout: "ignore",
    stderr: "pipe",
    cwd: JOBS_DIR,
  });

  const stderrPromise = new Response(proc.stderr).text();

  let timedOut = false;
  const killTimer = setTimeout(() => {
    timedOut = true;
    logger.warn("magick timeout — killing process", { jobId, fileId });
    proc.kill();
  }, 65_000);

  const [exitCode, stderr] = await Promise.all([proc.exited, stderrPromise]);
  clearTimeout(killTimer);

  if (exitCode !== 0) {
    const msg = timedOut ? "ImageMagick timed out" : (stderr.trim() || "ImageMagick conversion failed");
    logger.error("magick failed", { jobId, fileId, exitCode, err: msg });
    throw new Error(msg);
  }

  logger.info("magick done", { jobId, fileId });
}
