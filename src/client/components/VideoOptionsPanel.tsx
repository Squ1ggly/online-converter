import * as Label from "@radix-ui/react-label";
import type { ConversionOptions } from "../../shared/types";

interface Props {
  options: ConversionOptions;
  onChange: (o: ConversionOptions) => void;
}

export function VideoOptionsPanel({ options, onChange }: Props) {
  const set = (patch: Partial<ConversionOptions>) => onChange({ ...options, ...patch });

  return (
    <div className="options-panel">
      <div className="option-row">
        <Label.Root className="option-label" htmlFor="resolution">Resolution</Label.Root>
        <input
          id="resolution"
          type="text"
          placeholder="e.g. 1280x720"
          value={options.resolution ?? ""}
          onChange={(e) => set({ resolution: e.target.value || undefined })}
          className="option-input"
        />
      </div>

      <div className="option-row">
        <Label.Root className="option-label" htmlFor="fps">FPS</Label.Root>
        <input
          id="fps"
          type="number"
          placeholder="e.g. 30"
          min={1}
          max={120}
          value={options.fps ?? ""}
          onChange={(e) => set({ fps: e.target.value ? Number(e.target.value) : undefined })}
          className="option-input option-input--short"
        />
      </div>

      <div className="option-row">
        <Label.Root className="option-label" htmlFor="videoBitrate">Video bitrate</Label.Root>
        <input
          id="videoBitrate"
          type="text"
          placeholder="e.g. 2M"
          value={options.videoBitrate ?? ""}
          onChange={(e) => set({ videoBitrate: e.target.value || undefined })}
          className="option-input option-input--short"
        />
      </div>

      <div className="option-row">
        <Label.Root className="option-label" htmlFor="audioBitrate">Audio bitrate</Label.Root>
        <input
          id="audioBitrate"
          type="text"
          placeholder="e.g. 192k"
          value={options.audioBitrate ?? ""}
          onChange={(e) => set({ audioBitrate: e.target.value || undefined })}
          className="option-input option-input--short"
        />
      </div>
    </div>
  );
}
