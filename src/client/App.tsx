import { useState, useEffect } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Header } from "./components/Header";
import { DropZone } from "./components/DropZone";
import { FormatSelect } from "./components/FormatSelect";
import { VideoFormatSelect } from "./components/VideoFormatSelect";
import { OptionsPanel } from "./components/OptionsPanel";
import { VideoOptionsPanel } from "./components/VideoOptionsPanel";
import { JobCard } from "./components/JobCard";
import { Footer } from "./components/Footer";
import type {
  ConversionJob,
  ConversionOptions,
  ImageFormat,
  VideoFormat,
} from "../shared/types";

export function App() {
  // Image tab state
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imageFormat, setImageFormat] = useState<ImageFormat>("jpg");
  const [imageOptions, setImageOptions] = useState<ConversionOptions>({ quality: 100 });
  const [imageAdvanced, setImageAdvanced] = useState(false);

  // Video tab state
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [videoFormat, setVideoFormat] = useState<VideoFormat>("mp4");
  const [videoOptions, setVideoOptions] = useState<ConversionOptions>({});
  const [videoAdvanced, setVideoAdvanced] = useState(false);

  // Shared state
  const [job, setJob] = useState<ConversionJob | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll for updates while job is running
  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") return;
    const id = setInterval(async () => {
      const res = await fetch(`/api/jobs/${job.id}`);
      if (res.ok) setJob(await res.json());
    }, 1000);
    return () => clearInterval(id);
  }, [job?.id, job?.status]);

  const handleConvert = async (type: "image" | "video") => {
    const files = type === "image" ? imageFiles : videoFiles;
    if (!files.length) return;

    setUploading(true);
    setError(null);
    setJob(null);

    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    form.append("type", type);

    if (type === "image") {
      form.append("targetFormat", imageFormat);
      if (imageOptions.quality !== undefined) form.append("quality", String(imageOptions.quality));
      if (imageOptions.resize) form.append("resize", imageOptions.resize);
    } else {
      form.append("targetFormat", videoFormat);
      if (videoOptions.videoBitrate) form.append("videoBitrate", videoOptions.videoBitrate);
      if (videoOptions.audioBitrate) form.append("audioBitrate", videoOptions.audioBitrate);
      if (videoOptions.resolution) form.append("resolution", videoOptions.resolution);
      if (videoOptions.fps) form.append("fps", String(videoOptions.fps));
    }

    try {
      const res = await fetch("/api/jobs", { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json()).error ?? "Upload failed");
      const { jobId } = await res.json();
      const jobRes = await fetch(`/api/jobs/${jobId}`);
      setJob(await jobRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="app">
      <Header />
      <main className="main">
        <Tabs.Root className="tabs-root" defaultValue="image">
          <Tabs.List className="tabs-list">
            <Tabs.Trigger className="tabs-trigger" value="image">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                <rect x="1" y="2" width="13" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <circle cx="5" cy="6" r="1.2" fill="currentColor"/>
                <path d="M2 11.5 L5.5 8 L8 10 L10 8.5 L13 11.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
              </svg>
              Images
            </Tabs.Trigger>
            <Tabs.Trigger className="tabs-trigger" value="video">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                <rect x="1" y="2.5" width="9" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M10.5 5.5 L14 3.5 L14 11.5 L10.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
              </svg>
              Video
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content className="tabs-content" value="image">
            <div className="converter">
              <DropZone
                files={imageFiles}
                onChange={setImageFiles}
                accept="image/*,.pdf,.svg,.heic,.avif"
                hint="JPEG · PNG · WebP · AVIF · GIF · TIFF · BMP · HEIC · PDF · SVG"
              />
              <div className="config-panel">
                <div className="config-row config-row--between">
                  <div className="config-field">
                    <label className="config-label">Output Format</label>
                    <FormatSelect value={imageFormat} onChange={setImageFormat} />
                  </div>
                  <button className="advanced-toggle" onClick={() => setImageAdvanced(v => !v)}>
                    Advanced {imageAdvanced ? "▴" : "▾"}
                  </button>
                </div>
                {imageAdvanced && <OptionsPanel options={imageOptions} onChange={setImageOptions} />}
              </div>
              {error && <p className="error-banner">{error}</p>}
              <button
                className="convert-btn"
                onClick={() => handleConvert("image")}
                disabled={!imageFiles.length || uploading}
              >
                {uploading
                  ? "Uploading…"
                  : imageFiles.length
                  ? `Convert ${imageFiles.length} image${imageFiles.length > 1 ? "s" : ""} → ${imageFormat.toUpperCase()}`
                  : "Select images to convert"}
              </button>
            </div>
          </Tabs.Content>

          <Tabs.Content className="tabs-content" value="video">
            <div className="converter">
              <DropZone
                files={videoFiles}
                onChange={setVideoFiles}
                accept="video/*,.mkv,.m4v,.flv"
                hint="MP4 · MOV · MKV · AVI · WebM · FLV · M4V"
              />
              <div className="config-panel">
                <div className="config-row config-row--between">
                  <div className="config-field">
                    <label className="config-label">Output Format</label>
                    <VideoFormatSelect value={videoFormat} onChange={setVideoFormat} />
                  </div>
                  <button className="advanced-toggle" onClick={() => setVideoAdvanced(v => !v)}>
                    Advanced {videoAdvanced ? "▴" : "▾"}
                  </button>
                </div>
                {videoAdvanced && <VideoOptionsPanel options={videoOptions} onChange={setVideoOptions} />}
              </div>
              {error && <p className="error-banner">{error}</p>}
              <button
                className="convert-btn"
                onClick={() => handleConvert("video")}
                disabled={!videoFiles.length || uploading}
              >
                {uploading
                  ? "Uploading…"
                  : videoFiles.length
                  ? `Convert ${videoFiles.length} video${videoFiles.length > 1 ? "s" : ""} → ${videoFormat.toUpperCase()}`
                  : "Select videos to convert"}
              </button>
            </div>
          </Tabs.Content>
        </Tabs.Root>

        {job && (
          <div className="results-section">
            <JobCard job={job} onDismiss={() => setJob(null)} />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
