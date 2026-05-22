const CHUNK_SIZE = 90 * 1024 * 1024; // 90 MB — safely under Cloudflare's 100 MB request limit

export async function uploadFile(
  file: File,
  onProgress?: (chunk: number, totalChunks: number) => void,
): Promise<string> {
  const uploadId = crypto.randomUUID();
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const chunk = file.slice(start, start + CHUNK_SIZE);

    const form = new FormData();
    form.append("uploadId", uploadId);
    form.append("index", String(i));
    form.append("total", String(totalChunks));
    form.append("filename", file.name);
    form.append("data", chunk, file.name);

    const res = await fetch("/api/upload", { method: "POST", body: form });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? "Upload failed");
    }

    onProgress?.(i + 1, totalChunks);
  }

  return uploadId;
}
