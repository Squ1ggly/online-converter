import { useRef, useState, useCallback } from "react";

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
  accept?: string;
  hint?: string;
}

export function DropZone({ files, onChange, accept = "image/*,.pdf,.svg,.heic,.avif", hint = "JPEG · PNG · WebP · AVIF · GIF · TIFF · BMP · HEIC · PDF · SVG" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const addFiles = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      onChange([...files, ...Array.from(list)]);
    },
    [files, onChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const removeFile = (idx: number) => onChange(files.filter((_, i) => i !== idx));

  const zoneClass = [
    "dropzone",
    dragging && "dropzone--over",
    files.length > 0 && "dropzone--filled",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={zoneClass}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onClick={() => !files.length && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      aria-label="Drop images here or click to browse"
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="dropzone-input"
        onChange={(e) => addFiles(e.target.files)}
        onClick={(e) => e.stopPropagation()}
      />

      {files.length === 0 ? (
        <div className="dropzone-empty">
          <div className="dropzone-upload-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <p className="dropzone-text">Drop files here or <span className="dropzone-browse">browse</span></p>
          <p className="dropzone-hint">{hint}</p>
        </div>
      ) : (
        <div className="dropzone-list" onClick={(e) => e.stopPropagation()}>
          <div className="dropzone-list-header">
            <span className="dropzone-file-count">{files.length} file{files.length > 1 ? "s" : ""}</span>
            <button className="dropzone-clear-btn" onClick={() => onChange([])}>Clear all</button>
          </div>
          {files.map((file, i) => (
            <div key={i} className="dropzone-file">
              <span className="dropzone-file-name">{file.name}</span>
              <span className="dropzone-file-size">{fmtBytes(file.size)}</span>
              <button
                className="dropzone-file-remove"
                onClick={() => removeFile(i)}
                aria-label={`Remove ${file.name}`}
              >
                ×
              </button>
            </div>
          ))}
          <button className="dropzone-add-btn" onClick={() => inputRef.current?.click()}>
            + Add more files
          </button>
        </div>
      )}
    </div>
  );
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
}
