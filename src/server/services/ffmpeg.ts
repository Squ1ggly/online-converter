import path from "path";
import type { ConversionOptions, VideoFormat } from "../../shared/types";
import { JOBS_DIR } from "./magick";
import { logger } from "./logger";

const ALLOWED_VIDEO_FORMATS = new Set<string>([
  "avi", "flv", "gif", "m4v", "mkv", "mov", "mp4", "webm",
]);

export function assertVideoFormat(format: string): asserts format is VideoFormat {
  if (!ALLOWED_VIDEO_FORMATS.has(format.toLowerCase())) {
    throw new Error(`Unsupported video format: ${format}`);
  }
}

function assertSafePath(p: string): void {
  const resolved = path.resolve(p);
  const base = path.resolve(JOBS_DIR);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error(`Unsafe path rejected: ${p}`);
  }
}

export async function convertVideo(
  inputPath: string,
  outputPath: string,
  options: ConversionOptions = {},
  jobId?: string,
  fileId?: string,
): Promise<void> {
  assertSafePath(inputPath);
  assertSafePath(outputPath);

  const args: string[] = ["-i", inputPath, "-y"];

  if (options.videoBitrate) {
    args.push("-b:v", options.videoBitrate);
  }
  if (options.audioBitrate) {
    args.push("-b:a", options.audioBitrate);
  }
  if (options.resolution) {
    if (!/^\d+x\d+$/.test(options.resolution)) {
      throw new Error(`Invalid resolution: ${options.resolution}`);
    }
    args.push("-vf", `scale=${options.resolution.replace("x", ":")}`);
  }
  if (options.fps) {
    args.push("-r", String(Math.max(1, Math.min(120, options.fps))));
  }

  args.push(outputPath);

  const format = path.extname(outputPath).slice(1);
  logger.info("ffmpeg start", {
    jobId,
    fileId,
    format,
    videoBitrate: options.videoBitrate,
    audioBitrate: options.audioBitrate,
    resolution: options.resolution,
    fps: options.fps,
  });

  const proc = Bun.spawn({
    cmd: ["ffmpeg", ...args],
    env: {
      PATH: process.env.PATH,
      HOME: JOBS_DIR,
    },
    stdin: "ignore",
    stdout: "ignore",
    stderr: "pipe",
    cwd: JOBS_DIR,
  });

  // Drain stderr concurrently to prevent pipe buffer from filling up and deadlocking.
  const stderrPromise = new Response(proc.stderr).text().catch(() => "");

  let timedOut = false;
  const killTimer = setTimeout(() => {
    timedOut = true;
    logger.warn("ffmpeg timeout — killing process", { jobId, fileId });
    proc.kill();
  }, 10 * 60 * 1000);

  // Wait for the process to exit, then collect stderr with a short timeout.
  // Using Promise.all on proc.exited + stderrPromise can hang if Bun's ReadableStream
  // doesn't emit EOF promptly after process exit.
  const exitCode = await proc.exited;
  clearTimeout(killTimer);
  const stderr = await Promise.race([stderrPromise, new Promise<string>(r => setTimeout(() => r(""), 500))]);

  if (exitCode !== 0) {
    const errorLine = timedOut
      ? "FFmpeg timed out after 10 minutes"
      : (stderr.split("\n").filter((l) => l.includes("Error") || l.includes("Invalid") || l.includes("No such")).pop()
          ?? stderr.split("\n").filter(Boolean).slice(-2).join(" ")
          ?? "FFmpeg conversion failed");
    logger.error("ffmpeg failed", { jobId, fileId, exitCode, err: errorLine.trim() });
    throw new Error(errorLine.trim());
  }

  logger.info("ffmpeg done", { jobId, fileId });
}
