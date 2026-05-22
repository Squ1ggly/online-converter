import * as Label from "@radix-ui/react-label";
import type { ConversionOptions } from "../../shared/types";

interface Props {
  options: ConversionOptions;
  onChange: (o: ConversionOptions) => void;
}

export function OptionsPanel({ options, onChange }: Props) {
  const quality = options.quality ?? 85;

  return (
    <div className="options-panel">
      <div className="option-row">
        <Label.Root className="option-label" htmlFor="quality">
          Quality <span className="option-val">{quality}</span>
        </Label.Root>
        <input
          id="quality"
          type="range"
          min={1}
          max={100}
          value={quality}
          onChange={(e) => onChange({ ...options, quality: +e.target.value })}
          className="option-range"
        />
      </div>

      <div className="option-row">
        <Label.Root className="option-label" htmlFor="resize">
          Resize
        </Label.Root>
        <input
          id="resize"
          type="text"
          placeholder="e.g. 800x600 or 50%"
          value={options.resize ?? ""}
          onChange={(e) => onChange({ ...options, resize: e.target.value || undefined })}
          className="option-input"
        />
      </div>
    </div>
  );
}
