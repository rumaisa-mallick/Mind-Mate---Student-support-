/**
 * Pakistan launch configuration.
 *
 * Everything here is DATA, not logic — the domain engines read it. Income
 * bands, normalisation anchors and weights are versioned in the database
 * (ScoringWeightSet) at runtime; this file is the seed/preset for v1.
 *
 * Monetary values are PKR. Income is stored as a monthly band; tuition and
 * accommodation are annual. `period: "MONTHLY"` is declared explicitly so a
 * future multi-country launch cannot silently mix monthly and annual figures.
 */

export type IncomePeriod = "MONTHLY" | "ANNUAL";

export interface IncomeBand {
  code: string;
  label: string;
  /** Lower bound inclusive, in the declared period. */
  min: number;
  /** Upper bound exclusive. `null` = open-ended top band. */
  max: number | null;
}

export interface NormalisationAnchors {
  /** Income at/below which income need factor = 1.0 (highest need). */
  incomeLowAnchor: number;
  /** Income at/above which income need factor = 0.0. */
  incomeHighAnchor: number;
  minDependents: number;
  maxDependents: number;
  /** Earning members at/below which the earner factor = 1.0. */
  minEarners: number;
  maxEarners: number;
  /** Annual tuition at which the tuition-burden factor = 0. */
  tuitionBurdenLo: number;
  /** Annual tuition at which the tuition-burden factor = 1. */
  tuitionBurdenHi: number;
  /** Accommodation cost (annual, self-funded) treated as maximum burden. */
  accommodationCostHi: number;
}

export type FactorCode =
  | "INCOME"
  | "DEPENDENTS"
  | "EARNERS"
  | "TUITION_BURDEN"
  | "ACCOMMODATION"
  | "EXISTING_AID";

export interface WeightSet {
  version: number;
  /** Weights need not sum to 100 — they are normalised over *available* inputs. */
  weights: Record<FactorCode, number>;
  anchors: NormalisationAnchors;
  /** Score cut-offs for the four need bands. */
  bands: { low: number; moderate: number; high: number };
}

export const PK = {
  countryCode: "PK",
  countryName: "Pakistan",
  currency: "PKR",
  currencySymbol: "Rs",
  defaultLocale: "en",
  /** Approximate PKR per USD, used only to display foreign stipend amounts. */
  usdToPkr: 280,
} as const;

export const PK_INCOME_BANDS_MONTHLY: IncomeBand[] = [
  { code: "PK_B1", label: "Under 25,000 / month", min: 0, max: 25_000 },
  { code: "PK_B2", label: "25,000 – 50,000 / month", min: 25_000, max: 50_000 },
  { code: "PK_B3", label: "50,000 – 100,000 / month", min: 50_000, max: 100_000 },
  { code: "PK_B4", label: "100,000 – 200,000 / month", min: 100_000, max: 200_000 },
  { code: "PK_B5", label: "200,000+ / month", min: 200_000, max: null },
];

/**
 * Household monthly income. Open-ended top band resolves to `incomeHighAnchor`
 * so the factor bottoms out at 0.0 rather than dividing by `max - min = null`.
 */
export const PK_WEIGHT_SET_V1: WeightSet = {
  version: 1,
  weights: {
    INCOME: 30,
    DEPENDENTS: 20,
    EARNERS: 15,
    TUITION_BURDEN: 20,
    ACCOMMODATION: 10,
    EXISTING_AID: 5,
  },
  anchors: {
    incomeLowAnchor: 25_000,
    incomeHighAnchor: 400_000,
    minDependents: 1,
    maxDependents: 8,
    minEarners: 4,
    maxEarners: 0,
    tuitionBurdenLo: 50_000,
    tuitionBurdenHi: 600_000,
    accommodationCostHi: 120_000,
  },
  bands: { low: 35, moderate: 60, high: 80 },
};

/**
 * Demo-time matching policy.
 *
 * Public scholarship data cannot be hand-verified at launch, so UNVERIFIED
 * rows are still matchable — but they are demoted by the freshness factor and
 * labelled in the UI. Set `requireVerifiedForMatch: true` once the admin
 * verification queue has cleared the back catalogue (docs/PLAN.md risk R1).
 */
export const PK_MATCH_POLICY = {
  requireVerifiedForMatch: false,
  /** Profile inputs missing ⇒ confidence penalty (docs/PLAN.md §4.3). */
  confidencePenaltyPerMissingField: 0.15,
  maxConfidencePenalty: 0.45,
} as const;

/**
 * Emergency / crisis contacts.
 *
 * ⚠️ EVERY ROW MUST BE VERIFIED BY A HUMAN BEFORE THE PRODUCT IS PUBLIC.
 * Numbers are seeded UNVERIFIED on purpose: an unverified crisis number is
 * worse than no number at all, and the UI refuses to surface unverified
 * emergency contacts as the primary recommendation (docs/PLAN.md §6.3).
 */
export const PK_EMERGENCY_SERVICES = [
  {
    type: "CRISIS_HOTLINE",
    name: "Punjab Rescue 1123",
    org: "Punjab Rescue & Emergency Services",
    countryCode: "PK",
    phone: "1123",
    website: "https://1123.punjab.gov.pk/",
    openingHours: "24/7",
    languages: ["Urdu", "English", "Punjabi"],
    coverageNote: "Punjab province only — confirm national coverage before launch",
  },
  {
    type: "CRISIS_HOTLINE",
    name: "Police Emergency 15",
    org: "Police / Rescue 1122",
    countryCode: "PK",
    phone: "15",
    website: null,
    openingHours: "24/7",
    languages: ["Urdu", "English"],
    coverageNote: "Immediate danger / emergency services",
  },
] as const;
