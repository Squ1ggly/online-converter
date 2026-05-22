import path from "path";
import fs from "fs";
import { zipSync } from "fflate";
import type { ConversionJob, ConversionOptions, FileJob } from "../../shared/types";
import { store } from "../services/store";
import { assertFormat, convertImage, ensureJobDirs, JOBS_DIR } from "../services/magick";
import { assertVideoFormat, convertVideo } from "../services/ffmpeg";
import { getOrCreateSession, parseSession } from "../services/session";
import { uploadStore } from "../services/uploadStore";
import { logger } from "../services/logger";

export async function createJob(req: Request): Promise<Response> {
  const { sessionId, cookie } = getOrCreateSession(req);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    logger.warn("createJob bad form data", { sessionId: sessionId.slice(0, 8) });
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const uploadIds = form.getAll("uploadIds") as string[];
  const type = (form.get("type") as string) === "video" ? "video" : "image";
  const targetFormat = (form.get("targetFormat") as string)?.toLowerCase();

  if (!uploadIds.length) {
    logger.warn("createJob no files", { sessionId: sessionId.slice(0, 8) });
    return Response.json({ error: "No files provided" }, { status: 400 });
  }

  try {
    if (type === "video") {
      assertVideoFormat(targetFormat);
    } else {
      assertFormat(targetFormat);
    }
  } catch {
    logger.warn("createJob invalid format", { sessionId: sessionId.slice(0, 8), format: targetFormat });
    return Response.json({ error: "Invalid target format" }, { status: 400 });
  }

  // Validate all uploads belong to this session and are fully assembled
  const uploads = [];
  for (const uploadId of uploadIds) {
    const upload = uploadStore.get(uploadId);
    if (!upload || upload.sessionId !== sessionId || !upload.assembledPath) {
      logger.warn("createJob invalid upload", { uploadId, sessionId: sessionId.slice(0, 8) });
      return Response.json({ error: "Invalid or incomplete upload" }, { status: 400 });
    }
    uploads.push(upload);
  }

  const jobId = crypto.randomUUID();
  const { inputDir, outputDir } = ensureJobDirs(jobId);
  const fileJobs: FileJob[] = [];

  for (const upload of uploads) {
    const fileId = crypto.randomUUID();
    const inputPath = path.join(inputDir, `${fileId}.${upload.ext}`);

    // Move assembled file into the job's input dir (same filesystem, no copy)
    fs.renameSync(upload.assembledPath!, inputPath);
    uploadStore.delete(upload.uploadId);

    fileJobs.push({
      id: fileId,
      originalName: upload.filename,
      size: fs.statSync(inputPath).size,
      status: "pending",
    });
  }

  const options: ConversionOptions = {};
  if (type === "image") {
    const quality = form.get("quality") ? Number(form.get("quality")) : undefined;
    const resize = (form.get("resize") as string) || undefined;
    if (quality !== undefined && !isNaN(quality)) options.quality = quality;
    if (resize) options.resize = resize;
  } else {
    const videoBitrate = (form.get("videoBitrate") as string) || undefined;
    const audioBitrate = (form.get("audioBitrate") as string) || undefined;
    const resolution = (form.get("resolution") as string) || undefined;
    const fps = form.get("fps") ? Number(form.get("fps")) : undefined;
    if (videoBitrate) options.videoBitrate = videoBitrate;
    if (audioBitrate) options.audioBitrate = audioBitrate;
    if (resolution) options.resolution = resolution;
    if (fps && !isNaN(fps)) options.fps = fps;
  }

  const job: ConversionJob = {
    id: jobId,
    sessionId,
    type,
    targetFormat,
    status: "processing",
    files: fileJobs,
    createdAt: Date.now(),
    options,
  };

  store.set(job);
  logger.info("job created", {
    jobId,
    sessionId: sessionId.slice(0, 8),
    type,
    format: targetFormat,
    files: fileJobs.length,
  });

  void processJob(job, inputDir, outputDir);

  const headers = new Headers({ "Content-Type": "application/json" });
  if (cookie) headers.set("Set-Cookie", cookie);
  return new Response(JSON.stringify({ jobId }), { headers });
}

async function processJob(
  job: ConversionJob,
  inputDir: string,
  outputDir: string
): Promise<void> {
  let anyFailed = false;
  const start = Date.now();

  const convert = job.type === "video" ? convertVideo : convertImage;

  const processor = async (fileJob: FileJob) => {
    const ext = fileJob.originalName.split(".").pop()?.toLowerCase() ?? "bin";
    const inputPath = path.join(inputDir, `${fileJob.id}.${ext}`);
    const outputPath = path.join(outputDir, `${fileJob.id}.${job.targetFormat}`);

    fileJob.status = "processing";
    store.set(job);

    const fileStart = Date.now();
    try {
      await convert(inputPath, outputPath, job.options, job.id, fileJob.id);
      fileJob.status = "completed";
      logger.info("file converted", {
        jobId: job.id,
        fileId: fileJob.id,
        name: fileJob.originalName,
        ms: Date.now() - fileStart,
      });
    } catch (err) {
      fileJob.status = "failed";
      fileJob.error = err instanceof Error ? err.message : "Conversion failed";
      anyFailed = true;
      logger.error("file conversion failed", {
        jobId: job.id,
        fileId: fileJob.id,
        name: fileJob.originalName,
        ms: Date.now() - fileStart,
        err: fileJob.error,
      });
    }

    store.set(job);
  };

  try {
    if (job.type === "video") {
      for (const fileJob of job.files) await processor(fileJob);
    } else {
      await Promise.all(job.files.map(processor));
    }
  } catch (err) {
    logger.error("job processing uncaught error", { jobId: job.id, err: String(err) });
    anyFailed = true;
  } finally {
    job.status = anyFailed ? "failed" : "completed";
    job.completedAt = Date.now();
    store.set(job);

    const completed = job.files.filter((f) => f.status === "completed").length;
    const failed = job.files.filter((f) => f.status === "failed").length;
    logger.info("job done", { jobId: job.id, status: job.status, completed, failed, ms: Date.now() - start });
  }
}

export function getJob(jobId: string, req: Request): Response {
  const sessionId = parseSession(req);
  const job = store.get(jobId);
  if (!job || job.sessionId !== sessionId) {
    if (job) logger.warn("getJob session mismatch", { jobId });
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json(job);
}

export function downloadFile(jobId: string, fileId: string, req: Request): Response {
  const sessionId = parseSession(req);
  const job = store.get(jobId);
  if (!job || job.sessionId !== sessionId) {
    if (job) logger.warn("downloadFile session mismatch", { jobId });
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const fileJob = job.files.find((f) => f.id === fileId);
  if (!fileJob || fileJob.status !== "completed") {
    logger.warn("downloadFile not ready", { jobId, fileId });
    return Response.json({ error: "File not ready" }, { status: 404 });
  }

  const filePath = path.join(JOBS_DIR, jobId, "output", `${fileId}.${job.targetFormat}`);
  const file = Bun.file(filePath);
  const stem = fileJob.originalName.replace(/\.[^/.]+$/, "");

  logger.info("file downloaded", { jobId, fileId, name: fileJob.originalName });

  return new Response(file, {
    headers: {
      "Content-Disposition": `attachment; filename="${stem}.${job.targetFormat}"`,
      "Content-Type": file.type || "application/octet-stream",
    },
  });
}

export async function downloadAll(jobId: string, req: Request): Promise<Response> {
  const sessionId = parseSession(req);
  const job = store.get(jobId);
  if (!job || job.sessionId !== sessionId) {
    if (job) logger.warn("downloadAll session mismatch", { jobId });
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const completed = job.files.filter((f) => f.status === "completed");
  if (!completed.length) {
    logger.warn("downloadAll no completed files", { jobId });
    return Response.json({ error: "No completed files" }, { status: 404 });
  }

  const entries: Record<string, Uint8Array> = {};

  for (const fileJob of completed) {
    const stem = fileJob.originalName.replace(/\.[^/.]+$/, "");
    const filePath = path.join(JOBS_DIR, jobId, "output", `${fileJob.id}.${job.targetFormat}`);
    entries[`${stem}.${job.targetFormat}`] = new Uint8Array(await Bun.file(filePath).arrayBuffer());
  }

  const zipped = zipSync(entries, { level: 6 });

  logger.info("zip downloaded", { jobId, files: completed.length, bytes: zipped.byteLength });

  return new Response(zipped, {
    headers: {
      "Content-Disposition": `attachment; filename="converted.zip"`,
      "Content-Type": "application/zip",
    },
  });
}

export function deleteJob(jobId: string, req: Request): Response {
  const sessionId = parseSession(req);
  const job = store.get(jobId);
  if (!job || job.sessionId !== sessionId) {
    if (job) logger.warn("deleteJob session mismatch", { jobId });
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  fs.rm(path.join(JOBS_DIR, jobId), { recursive: true, force: true }, (err) => {
    if (err) logger.warn("deleteJob rm failed", { jobId, err: err.message });
  });
  store.delete(jobId);

  logger.info("job deleted", { jobId });
  return new Response(null, { status: 204 });
}
