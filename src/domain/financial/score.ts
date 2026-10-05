/**
 * Financial Need Score (FNS).
 *
 * Design constraints from docs/PLAN.md §4.1:
 *  - transparent: every point is attributable to a named factor
 *  - versioned: results carry the weight-set version that produced them
 *  - non-stigmatising: copy describes *eligibility*, never the student's worth
 *  - provisional-safe: missing inputs renormalise weights instead of guessing
 *
 * Pure module. No I/O, no framework imports.
 */

import { clamp01, piecewise, piecewiseInverted, round1 } from "../shared/math";
import type {
  FactorCode,
  IncomeBand,
  NormalisationAnchors,
  WeightSet,
} from "../../config/pakistan";

export type AccommodationStatus = "FAMILY_HOME" | "CAMPUS" | "RENTED" | "FREE" | "OTHER";
export type AidCoverage = "NONE" | "PARTIAL" | "FULL";

export interface FinancialProfileInput {
  incomeBandCode?: string | null;
  earners?: number | null;
  dependents?: number | null;
  /** Annual tuition in the local currency. */
  annualTuition?: number | null;
  accommodationStatus?: AccommodationStatus | null;
  /** Annual, self-funded accommodation cost. Required to score ACCOMMODATION. */
  annualAccommodationCost?: number | null;
  existingAidCoverage?: AidCoverage | null;
}

export type NeedBand = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export interface FactorContribution {
  code: FactorCode;
  label: string;
  weight: number;
  /** Normalised 0..1 need for this factor. */
  normalised: number;
  /** Points contributed to the final 0..100 score. */
  points: number;
}

export interface FinancialNeedResult {
  score: number;
  band: NeedBand;
  bandLabel: string;
  /** True when any factor was unavailable and weights were renormalised. */
  provisional: boolean;
  /** Share of total weight that had real data, 0..1. */
  inputCoverage: number;
  missing: FactorCode[];
  contributions: FactorContribution[];
  /** Non-stigmatising, eligibility-framed copy. */
  headline: string;
  weightSetVersion: number;
}

export interface ComputeFinancialNeedOptions {
  weightSet: WeightSet;
  incomeBands: IncomeBand[];
}

const FACTOR_LABELS: Record<FactorCode, string> = {
  INCOME: "Household income",
  DEPENDENTS: "People supported at home",
  EARNERS: "Family earning members",
  TUITION_BURDEN: "Tuition burden",
  ACCOMMODATION: "Accommodation costs",
  EXISTING_AID: "Support already received",
};

const AID_NEED: Record<AidCoverage, number> = {
  NONE: 1,
  PARTIAL: 0.5,
  FULL: 0,
};

/** Midpoint of an income band; open-ended top band resolves to `highAnchor`. */
export function resolveBandMidpoint(
  code: string,
  bands: IncomeBand[],
  anchors: NormalisationAnchors,
): number | null {
  const band = bands.find((b) => b.code === code);
  if (!band) return null;
  if (band.max === null) return anchors.incomeHighAnchor;
  return (band.min + band.max) / 2;
}

interface NormalisedFactor {
  available: boolean;
  normalised: number;
}

/**
 * Each factor answers: "how much does this input indicate financial need?"
 * Monotonic direction differs per factor (more earners ⇒ less need), so the
 * inverted helper is used where appropriate.
 */
function normaliseFactors(
  input: FinancialProfileInput,
  anchors: NormalisationAnchors,
  bands: IncomeBand[],
): Record<FactorCode, NormalisedFactor> {
  const midpoint =
    input.incomeBandCode != null
      ? resolveBandMidpoint(input.incomeBandCode, bands, anchors)
      : null;

  const accommodationIsFree =
    input.accommodationStatus === "FAMILY_HOME" || input.accommodationStatus === "FREE";

  return {
    INCOME: {
      available: midpoint !== null,
      normalised:
        midpoint === null
          ? 0
          : piecewiseInverted(midpoint, anchors.incomeLowAnchor, anchors.incomeHighAnchor),
    },
    DEPENDENTS: {
      available: typeof input.dependents === "number",
      normalised:
        typeof input.dependents === "number"
          ? piecewise(input.dependents, anchors.minDependents, anchors.maxDependents)
          : 0,
    },
    EARNERS: {
      available: typeof input.earners === "number",
      normalised:
        typeof input.earners === "number"
          ? piecewiseInverted(input.earners, anchors.maxEarners, anchors.minEarners)
          : 0,
    },
    TUITION_BURDEN: {
      available: typeof input.annualTuition === "number",
      normalised:
        typeof input.annualTuition === "number"
          ? piecewise(input.annualTuition, anchors.tuitionBurdenLo, anchors.tuitionBurdenHi)
          : 0,
    },
    ACCOMMODATION: {
      // Living free at home genuinely removes this burden — that is 0.0, not "missing".
      available:
        accommodationIsFree ||
        (input.accommodationStatus != null &&
          typeof input.annualAccommodationCost === "number"),
      normalised: accommodationIsFree
        ? 0
        : typeof input.annualAccommodationCost === "number"
          ? piecewise(input.annualAccommodationCost, 0, anchors.accommodationCostHi)
          : 0,
    },
    EXISTING_AID: {
      available: input.existingAidCoverage != null,
      normalised:
        input.existingAidCoverage != null ? AID_NEED[input.existingAidCoverage] : 0,
    },
  };
}

export function bandForScore(score: number, weightSet: WeightSet): NeedBand {
  const { low, moderate, high } = weightSet.bands;
  if (score < low) return "LOW";
  if (score < moderate) return "MODERATE";
  if (score < high) return "HIGH";
  return "CRITICAL";
}

const BAND_LABELS: Record<NeedBand, string> = {
  LOW: "Low estimated need",
  MODERATE: "Moderate estimated need",
  HIGH: "High estimated need",
  CRITICAL: "Very high estimated need",
};

/**
 * Copy is written from the student's point of view and always frames the result
 * as *possible access to funding*. The words "poor", "deserving", "low-income"
 * and any clinical term must never appear in user-facing output (test-enforced
 * in tests/unit/financial-score.test.ts).
 */
function headlineFor(band: NeedBand, provisional: boolean, hasData: boolean): string {
  if (!hasData) {
    return "Add a few financial details to see which need-based funding you may qualify for.";
  }
  const base: Record<NeedBand, string> = {
    LOW: "You may still qualify for merit-based and general funding — those are listed for you too.",
    MODERATE:
      "Some need-based opportunities may fit your profile. Here is what to check and apply for.",
    HIGH:
      "Based on your household profile, you may qualify for need-based financial assistance.",
    CRITICAL:
      "Based on your household profile, you appear to qualify for several need-based financial assistance options.",
  };
  return provisional
    ? `${base[band]} (Provisional — add the missing details for a more accurate score.)`
    : base[band];
}

export function computeFinancialNeed(
  input: FinancialProfileInput,
  options: ComputeFinancialNeedOptions,
): FinancialNeedResult {
  const { weightSet, incomeBands } = options;
  const factors = normaliseFactors(input, weightSet.anchors, incomeBands);

  const codes = Object.keys(weightSet.weights) as FactorCode[];
  const totalWeight = codes.reduce((sum, code) => sum + weightSet.weights[code], 0);
  const availableWeight = codes.reduce(
    (sum, code) => sum + (factors[code].available ? weightSet.weights[code] : 0),
    0,
  );

  const hasData = availableWeight > 0;
  const contributions: FactorContribution[] = codes.map((code) => {
    const weight = weightSet.weights[code];
    const normalised = clamp01(factors[code].normalised);
    return {
      code,
      label: FACTOR_LABELS[code],
      weight,
      normalised: round1(normalised),
      points: hasData ? round1((100 * weight * normalised) / availableWeight) : 0,
    };
  });

  const weightedSum = codes.reduce(
    (sum, code) => sum + (factors[code].available ? weightSet.weights[code] * factors[code].normalised : 0),
    0,
  );
  const score = hasData ? Math.round((100 * weightedSum) / availableWeight) : 0;
  const band = bandForScore(score, weightSet);
  const missing = codes.filter((code) => !factors[code].available);

  return {
    score,
    band,
    bandLabel: BAND_LABELS[band],
    provisional: missing.length > 0,
    inputCoverage: totalWeight === 0 ? 0 : round1(availableWeight / totalWeight),
    missing,
    contributions,
    headline: headlineFor(band, missing.length > 0, hasData),
    weightSetVersion: weightSet.version,
  };
}
