export type JobType = "image" | "video";

export type ImageFormat =
  | "avif" | "bmp" | "gif" | "heic" | "jpeg"
  | "jpg" | "pdf" | "png" | "svg" | "tiff" | "webp";

export type VideoFormat = "avi" | "flv" | "gif" | "m4v" | "mkv" | "mov" | "mp4" | "webm";

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface FileJob {
  id: string;
  originalName: string;
  size: number;
  status: JobStatus;
  error?: string;
  progress?: number; // 0–100, only present during video processing
}

export interface ConversionJob {
  id: string;
  sessionId: string;
  type: JobType;
  targetFormat: string;
  status: JobStatus;
  files: FileJob[];
  createdAt: number;
  completedAt?: number;
  options: ConversionOptions;
}

export interface ConversionOptions {
  // Image
  quality?: number;
  resize?: string;
  // Video
  videoBitrate?: string;
  audioBitrate?: string;
  resolution?: string;
  fps?: number;
}
