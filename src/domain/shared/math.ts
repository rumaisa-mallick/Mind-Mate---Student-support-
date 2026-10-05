/**
 * Pure math helpers shared by the domain layer.
 * No I/O, no framework imports — see docs/PLAN.md §3.1 and §13.
 */

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const clamp01 = (value: number): number => clamp(value, 0, 1);

export const round1 = (value: number): number => Math.round(value * 10) / 10;

/**
 * Piecewise-linear interpolation from `lo` (output 0) to `hi` (output 1),
 * clamped to [0, 1]. Used to turn a raw measurement into a normalised 0..1
 * need/score factor using configured anchors.
 */
export const piecewise = (value: number, lo: number, hi: number): number => {
  if (hi === lo) return value >= hi ? 1 : 0;
  return clamp01((value - lo) / (hi - lo));
};

/** Interpolates inversely: higher raw input produces a LOWER factor. */
export const piecewiseInverted = (value: number, lo: number, hi: number): number => {
  if (hi === lo) return value <= lo ? 1 : 0;
  return clamp01((hi - value) / (hi - lo));
};
