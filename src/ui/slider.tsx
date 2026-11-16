import { useId } from "react";

type SliderProps = {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

/** A native range input from 0 to `max` that reads "2 of 4". */
export function Slider({
  label,
  value,
  max,
  onChange,
  disabled = false,
}: SliderProps) {
  const id = useId();
  const listId = `${id}-ticks`;
  const text = `${value} of ${max}`;
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="range"
        aria-label={label}
        aria-valuetext={text}
        list={listId}
        min={0}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
      />
      <datalist id={listId}>
        {Array.from({ length: max + 1 }, (_, tick) => (
          <option key={tick} value={tick} />
        ))}
      </datalist>
      <span className="w-14 shrink-0 text-right text-sm tabular-nums text-ink-muted">
        {text}
      </span>
    </div>
  );
}
