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

// Returns total duration in microseconds, or 0 if ffprobe fails / is unavailable.
async function ffprobeDuration(inputPath: string): Promise<number> {
  try {
    const proc = Bun.spawn({
      cmd: ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", inputPath],
      env: { PATH: process.env.PATH },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "ignore",
    });
    const stdoutPromise = new Response(proc.stdout).text().catch(() => "");
    const exitCode = await proc.exited;
    const text = await Promise.race([stdoutPromise, new Promise<string>(r => setTimeout(() => r(""), 2000))]);
    if (exitCode !== 0) return 0;
    const secs = parseFloat(text.trim());
    return isNaN(secs) || secs <= 0 ? 0 : Math.round(secs * 1_000_000);
  } catch {
    return 0;
  }
}

export async function convertVideo(
  inputPath: string,
  outputPath: string,
  options: ConversionOptions = {},
  onProgress?: (pct: number) => void,
  jobId?: string,
  fileId?: string,
): Promise<void> {
  assertSafePath(inputPath);
  assertSafePath(outputPath);

  const totalDurationUs = await ffprobeDuration(inputPath);

  const args: string[] = [
    "-i", inputPath,
    "-y",
    "-progress", "pipe:1", // structured progress to stdout
    "-nostats",             // suppress default stderr progress noise
  ];

  if (options.videoBitrate) args.push("-b:v", options.videoBitrate);
  if (options.audioBitrate) args.push("-b:a", options.audioBitrate);
  if (options.resolution) {
    if (!/^\d+x\d+$/.test(options.resolution)) throw new Error(`Invalid resolution: ${options.resolution}`);
    args.push("-vf", `scale=${options.resolution.replace("x", ":")}`);
  }
  if (options.fps) args.push("-r", String(Math.max(1, Math.min(120, options.fps))));

  args.push(outputPath);

  const format = path.extname(outputPath).slice(1);
  logger.info("ffmpeg start", {
    jobId, fileId, format,
    durationSec: totalDurationUs ? Math.round(totalDurationUs / 1_000_000) : undefined,
    videoBitrate: options.videoBitrate,
    audioBitrate: options.audioBitrate,
    resolution: options.resolution,
    fps: options.fps,
  });

  const proc = Bun.spawn({
    cmd: ["ffmpeg", ...args],
    env: { PATH: process.env.PATH, HOME: JOBS_DIR },
    stdin: "ignore",
    stdout: "pipe",  // receives -progress pipe:1 output
    stderr: "pipe",  // drained to prevent buffer deadlock
    cwd: JOBS_DIR,
  });

  // Drain stderr concurrently to prevent pipe buffer deadlock.
  const stderrPromise = new Response(proc.stderr).text().catch(() => "");

  // Stream-parse stdout for progress updates as they arrive.
  const progressPromise = (async () => {
    const decoder = new TextDecoder();
    let buffer = "";
    for await (const chunk of proc.stdout) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("out_time_us=") && totalDurationUs > 0) {
          const us = parseInt(trimmed.slice("out_time_us=".length), 10);
          if (!isNaN(us) && us > 0) {
            onProgress?.(Math.min(99, Math.round((us / totalDurationUs) * 100)));
          }
        }
      }
    }
  })().catch(() => {});

  let timedOut = false;
  const killTimer = setTimeout(() => {
    timedOut = true;
    logger.warn("ffmpeg timeout — killing process", { jobId, fileId });
    proc.kill();
  }, 10 * 60 * 1000);

  const exitCode = await proc.exited;
  clearTimeout(killTimer);

  // Collect remaining output — both streams should close immediately after process exits.
  const stderr = await Promise.race([stderrPromise, new Promise<string>(r => setTimeout(() => r(""), 500))]);
  await Promise.race([progressPromise, new Promise(r => setTimeout(r, 500))]);

  if (exitCode !== 0) {
    const errorLine = timedOut
      ? "FFmpeg timed out after 10 minutes"
      : (stderr.split("\n").filter((l) => l.includes("Error") || l.includes("Invalid") || l.includes("No such")).pop()
          ?? stderr.split("\n").filter(Boolean).slice(-2).join(" ")
          ?? "FFmpeg conversion failed");
    logger.error("ffmpeg failed", { jobId, fileId, exitCode, err: errorLine.trim() });
    throw new Error(errorLine.trim());
  }

  onProgress?.(100);
  logger.info("ffmpeg done", { jobId, fileId });
}
