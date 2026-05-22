import * as Select from "@radix-ui/react-select";
import { ChevronDownIcon, ChevronUpIcon, CheckIcon } from "@radix-ui/react-icons";
import type { VideoFormat } from "../../shared/types";

interface Props {
  value: VideoFormat;
  onChange: (v: VideoFormat) => void;
}

const FORMAT_GROUPS: Record<string, string[]> = {
  Common: ["mp4", "webm", "mkv"],
  Apple:  ["mov", "m4v"],
  Other:  ["avi", "flv", "gif"],
};

export function VideoFormatSelect({ value, onChange }: Props) {
  return (
    <Select.Root value={value} onValueChange={(v) => onChange(v as VideoFormat)}>
      <Select.Trigger className="sel-trigger" aria-label="Output format">
        <Select.Value />
        <Select.Icon><ChevronDownIcon /></Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content className="sel-content" position="popper" sideOffset={5}>
          <Select.ScrollUpButton className="sel-scroll"><ChevronUpIcon /></Select.ScrollUpButton>
          <Select.Viewport>
            {Object.entries(FORMAT_GROUPS).map(([group, formats]) => (
              <Select.Group key={group}>
                <Select.Label className="sel-group-label">{group}</Select.Label>
                {formats.map((fmt) => (
                  <Select.Item key={fmt} value={fmt} className="sel-item">
                    <Select.ItemText>{fmt.toUpperCase()}</Select.ItemText>
                    <Select.ItemIndicator className="sel-check"><CheckIcon /></Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Group>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="sel-scroll"><ChevronDownIcon /></Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
