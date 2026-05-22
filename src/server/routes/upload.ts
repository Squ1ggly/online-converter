import path from "path";
import fs from "fs";
import { getOrCreateSession } from "../services/session";
import { JOBS_DIR } from "../services/magick";
import { uploadStore } from "../services/uploadStore";
import { logger } from "../services/logger";

async function assembleChunks(uploadId: string, ext: string, total: number): Promise<string> {
  const outPath = path.join(JOBS_DIR, "uploads", uploadId, `file.${ext}`);
  const ws = fs.createWriteStream(outPath);

  for (let i = 0; i < total; i++) {
    const chunkPath = path.join(JOBS_DIR, "uploads", uploadId, "chunks", String(i));
    const data = fs.readFileSync(chunkPath);
    await new Promise<void>((resolve, reject) =>
      ws.write(data, (err) => (err ? reject(err) : resolve()))
    );
    fs.unlinkSync(chunkPath);
  }

  await new Promise<void>((resolve, reject) => {
    ws.end();
    ws.on("finish", resolve);
    ws.on("error", reject);
  });

  return outPath;
}

export async function receiveChunk(req: Request): Promise<Response> {
  const { sessionId, cookie } = getOrCreateSession(req);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const uploadId = form.get("uploadId") as string;
  const index    = Number(form.get("index"));
  const total    = Number(form.get("total"));
  const filename = form.get("filename") as string;
  const data     = form.get("data") as File | null;

  if (!uploadId || !filename || isNaN(index) || isNaN(total) || !data || total < 1 || index >= total) {
    return Response.json({ error: "Invalid chunk metadata" }, { status: 400 });
  }

  let entry = uploadStore.get(uploadId);

  if (!entry) {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "bin";
    fs.mkdirSync(path.join(JOBS_DIR, "uploads", uploadId, "chunks"), { recursive: true });
    entry = {
      uploadId, sessionId, filename, ext,
      totalChunks: total,
      receivedChunks: new Set(),
      assembledPath: null,
      createdAt: Date.now(),
    };
    uploadStore.set(entry);
    logger.info("upload started", { uploadId, filename, sessionId: sessionId.slice(0, 8), chunks: total });
  } else if (entry.sessionId !== sessionId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const chunkPath = path.join(JOBS_DIR, "uploads", uploadId, "chunks", String(index));
  await Bun.write(chunkPath, await data.arrayBuffer());
  entry.receivedChunks.add(index);

  let done = false;
  if (entry.receivedChunks.size === entry.totalChunks) {
    try {
      entry.assembledPath = await assembleChunks(uploadId, entry.ext, entry.totalChunks);
      done = true;
      logger.info("upload assembled", { uploadId, filename });
    } catch (err) {
      logger.error("upload assembly failed", { uploadId, err: String(err) });
      return Response.json({ error: "Failed to assemble upload" }, { status: 500 });
    }
  }

  const headers = new Headers({ "Content-Type": "application/json" });
  if (cookie) headers.set("Set-Cookie", cookie);
  return new Response(JSON.stringify({ uploadId, done }), { headers });
}
