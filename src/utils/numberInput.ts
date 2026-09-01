const SUFFIX_MULTIPLIERS: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  m: 1e6,
  million: 1e6,
  b: 1e9,
  bn: 1e9,
  billion: 1e9,
  t: 1e12,
  trillion: 1e12,
  qa: 1e15,
  quadrillion: 1e15,
  qi: 1e18,
  quintillion: 1e18,
};

export function parseShorthandNumber(input: string): number | null {
  const normalized = input.trim().replace(/[,_\s]/g, "");
  if (!normalized) return null;

  const match = normalized.match(
    /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)([a-z]+)?$/i,
  );
  if (!match) return null;

  const base = Number(match[1]);
  const suffix = match[2]?.toLowerCase();
  const multiplier = suffix ? SUFFIX_MULTIPLIERS[suffix] : 1;
  if (!Number.isFinite(base) || multiplier === undefined) return null;

  const result = base * multiplier;
  return Number.isFinite(result) ? result : null;
}

const DISPLAY_SUFFIXES = [
  { threshold: 1e18, suffix: "Qi" },
  { threshold: 1e15, suffix: "Qa" },
  { threshold: 1e12, suffix: "T" },
  { threshold: 1e9, suffix: "B" },
  { threshold: 1e6, suffix: "M" },
];

export function formatShorthandNumber(value: number): string {
  const magnitude = Math.abs(value);
  const unit = DISPLAY_SUFFIXES.find(({ threshold }) => magnitude >= threshold);
  if (!unit) return String(value);

  const abbreviated = (value / unit.threshold).toFixed(3);
  const trimmed = abbreviated.replace(/0+$/, "").replace(/\.$/, "");
  const displayValue = trimmed.includes(".") ? trimmed : `${trimmed}.0`;
  return `${displayValue} ${unit.suffix}`;
}
