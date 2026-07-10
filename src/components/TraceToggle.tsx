"use client";

interface TraceToggleProps {
  showTrace: boolean;
  onToggle: (value: boolean) => void;
}

export default function TraceToggle({ showTrace, onToggle }: TraceToggleProps) {
  return (
    <label className="trace-toggle" aria-label="詳しい推論過程を表示">
      <span className="trace-toggle__label">詳しい推論過程を表示</span>
      <span className="trace-toggle__switch">
        <input
          type="checkbox"
          className="trace-toggle__input"
          checked={showTrace}
          onChange={(e) => onToggle(e.target.checked)}
          role="switch"
          aria-checked={showTrace}
        />
        <span className="trace-toggle__slider" aria-hidden="true" />
      </span>
    </label>
  );
}
