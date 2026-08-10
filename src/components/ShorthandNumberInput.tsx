import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { formatShorthandNumber, parseShorthandNumber } from "../utils/numberInput";

interface Props {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  integer?: boolean;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

function constrainValue(
  value: number,
  min: number | undefined,
  max: number | undefined,
  integer: boolean,
) {
  let constrained = integer ? Math.trunc(value) : value;
  if (min !== undefined) constrained = Math.max(min, constrained);
  if (max !== undefined) constrained = Math.min(max, constrained);
  return constrained;
}

export default function ShorthandNumberInput({
  value,
  onValueChange,
  min,
  max,
  integer = false,
  className,
  ariaLabel,
  disabled = false,
}: Props) {
  const [draft, setDraft] = useState(formatShorthandNumber(value));
  const [invalid, setInvalid] = useState(false);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setDraft(formatShorthandNumber(value));
  }, [value]);

  const parseAndConstrain = (input: string) => {
    const parsed = parseShorthandNumber(input);
    if (parsed === null) return null;
    return constrainValue(parsed, min, max, integer);
  };

  const commit = () => {
    const parsed = parseAndConstrain(draft);
    if (parsed === null) {
      setDraft(formatShorthandNumber(value));
      setInvalid(false);
      return;
    }
    onValueChange(parsed);
    setDraft(formatShorthandNumber(parsed));
    setInvalid(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.currentTarget.blur();
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      disabled={disabled}
      title="Accepts numbers such as 22.52B, 1.5M, 2e6, or 1,000"
      value={draft}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onChange={(event) => {
        const nextDraft = event.target.value;
        const parsed = parseAndConstrain(nextDraft);
        setDraft(nextDraft);
        setInvalid(Boolean(nextDraft.trim()) && parsed === null);
        if (parsed !== null) onValueChange(parsed);
      }}
      onBlur={() => {
        focusedRef.current = false;
        commit();
      }}
      onKeyDown={handleKeyDown}
    />
  );
}
