export interface UploadEntry {
  uploadId: string;
  sessionId: string;
  filename: string;
  ext: string;
  totalChunks: number;
  receivedChunks: Set<number>;
  assembledPath: string | null;
  createdAt: number;
}

const uploads = new Map<string, UploadEntry>();

export const uploadStore = {
  get:    (id: string)        => uploads.get(id),
  set:    (e: UploadEntry)    => uploads.set(e.uploadId, e),
  delete: (id: string)        => uploads.delete(id),
  all:    ()                  => Array.from(uploads.values()),
};
