import path from "path";
import fs from "fs";
import { zipSync } from "fflate";
import type { ConversionJob, ConversionOptions, FileJob } from "../../shared/types";
import { store } from "../services/store";
import { assertFormat, convertImage, ensureJobDirs, JOBS_DIR } from "../services/magick";
import { assertVideoFormat, convertVideo } from "../services/ffmpeg";
import { getOrCreateSession, parseSession } from "../services/session";

export async function createJob(req: Request): Promise<Response> {
  const { sessionId, cookie } = getOrCreateSession(req);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const files = form.getAll("files") as File[];
  const type = (form.get("type") as string) === "video" ? "video" : "image";
  const targetFormat = (form.get("targetFormat") as string)?.toLowerCase();

  if (!files.length) {
    return Response.json({ error: "No files provided" }, { status: 400 });
  }

  try {
    if (type === "video") {
      assertVideoFormat(targetFormat);
    } else {
      assertFormat(targetFormat);
    }
  } catch {
    return Response.json({ error: "Invalid target format" }, { status: 400 });
  }

  const jobId = crypto.randomUUID();
  const { inputDir, outputDir } = ensureJobDirs(jobId);

  const fileJobs: FileJob[] = [];

  for (const file of files) {
    const fileId = crypto.randomUUID();
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const inputPath = path.join(inputDir, `${fileId}.${ext}`);

    await Bun.write(inputPath, await file.arrayBuffer());

    fileJobs.push({
      id: fileId,
      originalName: file.name,
      size: file.size,
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

  // Process asynchronously - don't await
  processJob(job, inputDir, outputDir).catch(console.error);

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

  const convert = job.type === "video" ? convertVideo : convertImage;

  // Images process in parallel; videos sequentially to avoid resource contention
  const processor = async (fileJob: FileJob) => {
    const ext = fileJob.originalName.split(".").pop()?.toLowerCase() ?? "bin";
    const inputPath = path.join(inputDir, `${fileJob.id}.${ext}`);
    const outputPath = path.join(outputDir, `${fileJob.id}.${job.targetFormat}`);

    fileJob.status = "processing";
    store.set(job);

    try {
      await convert(inputPath, outputPath, job.options);
      fileJob.status = "completed";
    } catch (err) {
      fileJob.status = "failed";
      fileJob.error = err instanceof Error ? err.message : "Conversion failed";
      anyFailed = true;
    }

    store.set(job);
  };

  if (job.type === "video") {
    for (const fileJob of job.files) await processor(fileJob);
  } else {
    await Promise.all(job.files.map(processor));
  }

  job.status = anyFailed ? "failed" : "completed";
  job.completedAt = Date.now();
  store.set(job);
}

export function getJob(jobId: string, req: Request): Response {
  const sessionId = parseSession(req);
  const job = store.get(jobId);
  if (!job || job.sessionId !== sessionId) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(job);
}

export function downloadFile(jobId: string, fileId: string, req: Request): Response {
  const sessionId = parseSession(req);
  const job = store.get(jobId);
  if (!job || job.sessionId !== sessionId) return Response.json({ error: "Not found" }, { status: 404 });

  const fileJob = job.files.find((f) => f.id === fileId);
  if (!fileJob || fileJob.status !== "completed") {
    return Response.json({ error: "File not ready" }, { status: 404 });
  }

  const filePath = path.join(JOBS_DIR, jobId, "output", `${fileId}.${job.targetFormat}`);
  const file = Bun.file(filePath);
  const stem = fileJob.originalName.replace(/\.[^/.]+$/, "");

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
  if (!job || job.sessionId !== sessionId) return Response.json({ error: "Not found" }, { status: 404 });

  const completed = job.files.filter((f) => f.status === "completed");
  if (!completed.length) return Response.json({ error: "No completed files" }, { status: 404 });

  const entries: Record<string, Uint8Array> = {};

  for (const fileJob of completed) {
    const stem = fileJob.originalName.replace(/\.[^/.]+$/, "");
    const filePath = path.join(JOBS_DIR, jobId, "output", `${fileJob.id}.${job.targetFormat}`);
    entries[`${stem}.${job.targetFormat}`] = new Uint8Array(await Bun.file(filePath).arrayBuffer());
  }

  const zipped = zipSync(entries, { level: 6 });

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
  if (!job || job.sessionId !== sessionId) return Response.json({ error: "Not found" }, { status: 404 });

  fs.rm(path.join(JOBS_DIR, jobId), { recursive: true, force: true }, () => {});
  store.delete(jobId);

  return new Response(null, { status: 204 });
}
