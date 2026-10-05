/**
 * Scholarship/opportunity eligibility + matching engine.
 *
 * Architecture from docs/PLAN.md §4.3 — two stages, in this order:
 *   Stage A  hard filters (binary, must pass)   ⇒ eligible | disqualified + reasons
 *   Stage B  soft scoring (weighted, explainable) ⇒ 0..100 with full breakdown
 *
 * AI/LLM never participates in this decision. It may only rewrite the prose
 * that these functions produce (see §4.2 / §4.3). That is what makes the
 * matching defensible and what guarantees we never recommend an ineligible
 * scholarship — risk R4 in docs/PLAN.md.
 *
 * Pure module. No I/O, no framework imports.
 */

import { clamp01, round1 } from "../shared/math";
import {
  daysUntil,
  deadlineState,
  formatDeadline,
  pkrInstant,
} from "../shared/dates";

export type CriterionCode =
  | "MIN_CGPA"
  | "MIN_HAT"
  | "MAX_AGE"
  | "MIN_AGE"
  | "COUNTRY"
  | "NATIONALITY"
  | "DEGREE_LEVEL"
  | "FIELD"
  | "INCOME_NEED"
  | "MAX_HOUSEHOLD_INCOME"
  | "ENROLLMENT_STATUS"
  | "GENDER"
  | "NO_PRIOR_SCHOLARSHIP";

export type CriterionOperator =
  | "GTE"
  | "LTE"
  | "BETWEEN"
  | "IN"
  | "NOT_IN"
  | "CONTAINS_ANY"
  | "EQ";

export interface Criterion {
  code: CriterionCode;
  operator: CriterionOperator;
  /** Operand shape depends on `code`; documented per criterion below. */
  value: Record<string, unknown>;
  /** required = true ⇒ hard filter. false ⇒ soft scoring component. */
  required: boolean;
  /** Soft-component weight, used when required = false. */
  weight?: number;
  label?: string;
}

export interface StudentMatchInput {
  age?: number | null;
  countryCode?: string | null;
  nationality?: string | null;
  cgpa?: number | null;
  cgpaScale?: number | null;
  /// HAT test score out of 100. Gates nearly every HEC foreign scholarship
  /// nomination in Pakistan (minimum 60).
  hatScore?: number | null;
  degreeLevel?: string | null;
  field?: string | null;
  gender?: string | null;
  enrollmentStatus?: string | null;
  /** Financial Need Score 0..100 (higher = greater need). */
  financialNeedScore?: number | null;
  /** Financial Need Score band as computed by the financial domain. */
  financialNeedBand?: string | null;
  /** Annual tuition in local currency — used to judge coverage value. */
  annualTuition?: number | null;
  /**
   * Resolved monthly household income in PKR, from the student's income band
   * midpoint. Needed for programmes that publish a hard rupee ceiling
   * (HEC need-based scholarships cap monthly family income at Rs 45,000).
   */
  monthlyHouseholdIncome?: number | null;
  documentsOnHand?: string[];
  holdsPriorScholarship?: boolean | null;
}

export type OpportunityType =
  | "SCHOLARSHIP"
  | "INTERNSHIP"
  | "COMPETITION"
  | "FELLOWSHIP"
  | "EXCHANGE"
  | "COURSE";

export interface OpportunityForMatching {
  id: string;
  title: string;
  type: OpportunityType;
  criteria: Criterion[];
  isNeedBased?: boolean;
  isMeritBased?: boolean;
  tuitionCoverage?: "FULL" | "PARTIAL" | "PERCENT" | null;
  tuitionCoveragePercent?: number | null;
  coversLiving?: boolean;
  coversTravel?: boolean;
  stipendAmount?: number | null;
  requiredDocuments?: string[];
  /** ISO date, e.g. "2026-11-15". */
  deadline?: string | null;
  verificationStatus?:
    | "UNVERIFIED"
    | "VERIFIED"
    | "OVERDUE"
    | "DISPUTED"
    | "CLOSED";
  lastVerifiedAt?: string | null;
}

export interface Disqualifier {
  code: CriterionCode | "DEADLINE_CLOSED" | "VERIFICATION";
  label: string;
  /** Shown to the student. Always explains, never scolds. */
  humanText: string;
  /** Small closable gap ⇒ surfaced as a near-miss instead of a dead end. */
  nearMissGap?: number;
}

export type ReasonCode =
  | "CGPA_ABOVE_MIN"
  | "HAT_SCORE_MET"
  | "NEED_CRITERION_MET"
  | "INCOME_WITHIN_LIMIT"
  | "FIELD_ELIGIBLE"
  | "AGE_ELIGIBLE"
  | "COVERAGE_FULL_FEE"
  | "STIPEND_INCLUDED"
  | "DEADLINE_NEAR"
  | "DOCUMENTS_READY"
  | "MERIT_BASED"
  | "NEED_BASED"
  | "UNVERIFIED_SOURCE"
  | "STALE_DATA";

export interface MatchComponentBreakdown {
  code: "NEED_FIT" | "COVERAGE_VALUE" | "ACADEMIC_FIT" | "FIELD_FIT" | "URGENCY" | "EFFORT";
  weight: number;
  /** 0..1 raw component value before weighting. */
  value: number;
  /** Points contributed to the 0..100 score. */
  points: number;
}

export interface MatchResult {
  opportunityId: string;
  eligible: boolean;
  nearMiss: boolean;
  score: number | null;
  breakdown: MatchComponentBreakdown[];
  reasons: ReasonCode[];
  disqualifiers: Disqualifier[];
  /** Required criteria we could not evaluate (student has not provided the input). */
  unverifiedCriteria: CriterionCode[];
  freshnessFactor: number;
  confidenceFactor: number;
}

export interface MatchSummary {
  engineVersion: string;
  evaluatedOn: string;
  totalCandidates: number;
  eligibleCount: number;
  disqualifiedCount: number;
  results: MatchResult[];
  /** Sorted, score desc. */
  eligible: MatchResult[];
  nearMisses: MatchResult[];
  /** True if any candidate had to be assumed-eligible due to missing inputs. */
  usedAssumptions: boolean;
}

export const ENGINE_VERSION = "matching-v1";

export interface MatchPolicy {
  requireVerifiedForMatch: boolean;
  confidencePenaltyPerMissingField: number;
  maxConfidencePenalty: number;
}

export const DEFAULT_POLICY: MatchPolicy = {
  requireVerifiedForMatch: false,
  confidencePenaltyPerMissingField: 0.15,
  maxConfidencePenalty: 0.45,
};

const MS_PER_DAY = 86_400_000;

// ── helpers ────────────────────────────────────────────────────────────────

const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

const DAY_MS = MS_PER_DAY;

/**
 * Turns the `YYYY-MM-DD` "today" the engine is driven with back into an instant
 * so `deadlineState` has something to compare against. Midday in Pakistan is
 * used rather than midnight: at 00:00 a deadline closing at 16:00 the same day
 * would read as still open for a further sixteen hours of nothing.
 */
function todayAsInstant(today: string): Date {
  return pkrInstant(today, 12, 0) ?? new Date();
}

export function freshnessFactor(
  verificationStatus: OpportunityForMatching["verificationStatus"],
  lastVerifiedAt: string | null,
  today: string,
): number {
  switch (verificationStatus ?? "UNVERIFIED") {
    case "VERIFIED": {
      const ageDays = daysBetween(lastVerifiedAt, today);
      if (ageDays === null) return 0.8;
      if (ageDays <= 30) return 1;
      if (ageDays <= 90) return 0.95;
      if (ageDays <= 180) return 0.85;
      return 0.7;
    }
    case "OVERDUE":
      return 0.7;
    case "DISPUTED":
      return 0.4;
    case "CLOSED":
      return 0.3;
    default:
      return 0.75;
  }
}

/** Positive when `a` is later than `b`. */
function daysBetween(a: string | null, b: string): number | null {
  if (!a) return null;
  const aMs = Date.parse(a);
  const bMs = Date.parse(b);
  if (Number.isNaN(aMs) || Number.isNaN(bMs)) return null;
  return Math.floor((bMs - aMs) / DAY_MS);
}

// ── Stage A: hard filters ──────────────────────────────────────────────────

const CRITERION_LABELS: Record<CriterionCode, string> = {
  MIN_CGPA: "Minimum academic result",
  MIN_HAT: "HAT test score",
  MAX_AGE: "Maximum age",
  MIN_AGE: "Minimum age",
  COUNTRY: "Country of residence",
  NATIONALITY: "Nationality",
  DEGREE_LEVEL: "Degree level",
  FIELD: "Field of study",
  INCOME_NEED: "Financial-need requirement",
  MAX_HOUSEHOLD_INCOME: "Maximum household income",
  ENROLLMENT_STATUS: "Enrolment status",
  GENDER: "Gender eligibility",
  NO_PRIOR_SCHOLARSHIP: "Prior scholarship",
};

export function criterionLabel(code: CriterionCode): string {
  return CRITERION_LABELS[code] ?? code;
}

interface CriterionOutcome {
  passed: boolean;
  evaluable: boolean;
  disqualifier?: Disqualifier;
  passedReason?: ReasonCode;
}

const normaliseField = (value: string): string => value.trim().toLowerCase();

/**
 * Trims float noise for user-facing text: 2.95 must not be shown as "3".
 * (A student reading "your profile shows 3" would be told the wrong thing.)
 */
export const formatNumber = (value: number): string =>
  String(Math.round(value * 100) / 100);

/**
 * Rupee amounts in criteria text are grouped for legibility: "Rs 45,000"
 * reads as a real number at a glance, "Rs 45000" reads as a typo.
 */
export const formatMoney = (value: number): string =>
  String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** Near-miss gaps are compared in normalised space, so keep 3dp of precision. */
const round3 = (value: number): number => Math.round(value * 1000) / 1000;

/** Evaluates a single criterion against the student profile. */
export function evaluateCriterion(
  criterion: Criterion,
  student: StudentMatchInput,
): CriterionOutcome {
  const { code, operator, value } = criterion;
  const label = criterion.label ?? criterionLabel(code);

  switch (code) {
    case "MIN_CGPA": {
      const gte = asNumber(value.gte);
      const scale = asNumber(value.scale) ?? student.cgpaScale ?? 4.0;
      if (gte === null || student.cgpa == null || !scale) {
        return { passed: true, evaluable: false };
      }
      const normalised = student.cgpa / scale;
      const threshold = gte / scale;
      const passed = operator === "GTE" ? normalised >= threshold : normalised <= threshold;
      return passed
        ? { passed: true, evaluable: true, passedReason: "CGPA_ABOVE_MIN" }
        : {
            passed: false,
            evaluable: true,
            disqualifier: {
              code,
              label,
              humanText: `Requires a result of ${formatNumber(gte)} or above on a ${formatNumber(scale)} scale — your profile shows ${formatNumber(student.cgpa)} on ${formatNumber(scale)}.`,
              // Normalised gap decides near-miss, not raw CGPA points.
              nearMissGap: round3(threshold - normalised),
            },
          };
    }

    case "MIN_HAT": {
      const gte = asNumber(value.gte);
      const scale = asNumber(value.scale) ?? 100;
      if (gte === null || student.hatScore == null || !scale) {
        return { passed: true, evaluable: false };
      }
      const passed = operator === "GTE" ? student.hatScore >= gte : student.hatScore <= gte;
      return passed
        ? { passed: true, evaluable: true, passedReason: "HAT_SCORE_MET" }
        : {
            passed: false,
            evaluable: true,
            disqualifier: {
              code,
              label,
              humanText: `Requires a HAT test score of at least ${formatNumber(gte)} out of ${formatNumber(scale)} — add yours if you have taken the test. A re-sit closes this gap, so it is worth treating as closable.`,
              nearMissGap: round3((gte - student.hatScore) / scale),
            },
          };
    }

    case "MAX_AGE": {
      const lte = asNumber(value.lte);
      if (lte === null || student.age == null) return { passed: true, evaluable: false };
      const passed = student.age <= lte;
      return passed
        ? { passed: true, evaluable: true, passedReason: "AGE_ELIGIBLE" }
        : {
            passed: false,
            evaluable: true,
            disqualifier: {
              code,
              label,
              humanText: `Age limit is ${lte} — you are ${student.age}.`,
              nearMissGap: student.age - lte,
            },
          };
    }

    case "MIN_AGE": {
      const gte = asNumber(value.gte);
      if (gte === null || student.age == null) return { passed: true, evaluable: false };
      return student.age >= gte
        ? { passed: true, evaluable: true, passedReason: "AGE_ELIGIBLE" }
        : {
            passed: false,
            evaluable: true,
            disqualifier: {
              code,
              label,
              humanText: `Open to applicants aged ${gte} and above.`,
              nearMissGap: gte - student.age,
            },
          };
    }

    case "COUNTRY":
    case "NATIONALITY": {
      const list = asStringList(value.in);
      if (list.length === 0) return { passed: true, evaluable: true };
      const actual = code === "COUNTRY" ? student.countryCode : student.nationality;
      if (actual == null) return { passed: true, evaluable: false };
      const passed = list.some((entry) => entry.toUpperCase() === actual.toUpperCase());
      const fieldName = code === "COUNTRY" ? "residence" : "nationality";
      return passed
        ? { passed: true, evaluable: true }
        : {
            passed: false,
            evaluable: true,
            disqualifier: {
              code,
              label,
              humanText: `Limited to applicants from ${list.join(", ")}. Your ${fieldName} is not on the list.`,
            },
          };
    }

    case "DEGREE_LEVEL": {
      const list = asStringList(value.in);
      if (list.length === 0 || student.degreeLevel == null) {
        return { passed: true, evaluable: student.degreeLevel != null };
      }
      const passed = list.some((entry) => entry.toUpperCase() === student.degreeLevel!.toUpperCase());
      return passed
        ? { passed: true, evaluable: true }
        : {
            passed: false,
            evaluable: true,
            disqualifier: {
              code,
              label,
              humanText: `Open to ${list.join(" and ")} students.`,
            },
          };
    }

    case "FIELD": {
      const list = asStringList(value.in);
      if (list.length === 0 || student.field == null) {
        return { passed: true, evaluable: student.field != null };
      }
      const actual = normaliseField(student.field);
      const passed = list.some((entry) => {
        const candidate = normaliseField(entry);
        // Tolerate "Software Engineering" vs "engineering" style containment.
        return actual === candidate || actual.includes(candidate) || candidate.includes(actual);
      });
      return passed
        ? { passed: true, evaluable: true, passedReason: "FIELD_ELIGIBLE" }
        : {
            passed: false,
            evaluable: true,
            disqualifier: {
              code,
              label,
              humanText: `Eligible fields: ${list.join(", ")}.`,
            },
          };
    }

    case "INCOME_NEED": {
      const gte = asNumber(value.gte);
      const scale = asNumber(value.scale) ?? 100;
      if (gte === null || student.financialNeedScore == null || !scale) {
        return { passed: true, evaluable: false };
      }
      const passed = student.financialNeedScore >= gte;
      return passed
        ? { passed: true, evaluable: true, passedReason: "NEED_CRITERION_MET" }
        : {
            passed: false,
            evaluable: true,
            disqualifier: {
              code,
              label,
              humanText:
                "Reserved for students above a higher financial-need threshold than your current profile.",
              nearMissGap: gte - student.financialNeedScore,
            },
          };
    }

    case "MAX_HOUSEHOLD_INCOME": {
      const lte = asNumber(value.lte);
      if (lte === null || student.monthlyHouseholdIncome == null) {
        return { passed: true, evaluable: false };
      }
      const passed = student.monthlyHouseholdIncome <= lte;
      return passed
        ? { passed: true, evaluable: true, passedReason: "INCOME_WITHIN_LIMIT" }
        : {
            passed: false,
            evaluable: true,
            disqualifier: {
              code,
              label,
              humanText: `Limited to households earning Rs ${formatMoney(lte)} or less per month — your income band sits above that.`,
              // Not closable by effort: the income band is a fact, not a target.
              nearMissGap: undefined,
            },
          };
    }

    case "ENROLLMENT_STATUS": {
      const list = asStringList(value.in);
      if (list.length === 0 || student.enrollmentStatus == null) {
        return { passed: true, evaluable: student.enrollmentStatus != null };
      }
      const passed = list.some(
        (entry) => entry.toUpperCase() === student.enrollmentStatus!.toUpperCase(),
      );
      return passed
        ? { passed: true, evaluable: true }
        : {
            passed: false,
            evaluable: true,
            disqualifier: {
              code,
              label,
              humanText: `Open to ${list.join(", ").toLowerCase()} students.`,
            },
          };
    }

    case "GENDER": {
      const expected = typeof value.eq === "string" ? value.eq : null;
      // "UNDISCLOSED" is an absent answer, not an answer. Treating it as a real
      // value would tell a student who declined to state their gender that they
      // fail a women-only award they may well be eligible for.
      const known =
        typeof student.gender === "string" &&
        student.gender.length > 0 &&
        student.gender.toUpperCase() !== "UNDISCLOSED";
      if (!expected || !known) return { passed: true, evaluable: false };
      const passed = String(student.gender).toUpperCase() === expected.toUpperCase();
      return passed
        ? { passed: true, evaluable: true }
        : {
            passed: false,
            evaluable: true,
            disqualifier: { code, label, humanText: "This programme has a gender eligibility criterion." },
          };
    }

    case "NO_PRIOR_SCHOLARSHIP": {
      if (student.holdsPriorScholarship == null) return { passed: true, evaluable: false };
      return student.holdsPriorScholarship
        ? {
            passed: false,
            evaluable: true,
            disqualifier: {
              code,
              label,
              humanText: "Not available to students already holding a scholarship.",
            },
          }
        : { passed: true, evaluable: true };
    }

    default:
      return { passed: true, evaluable: false };
  }
}

// ── Stage B: soft scoring ──────────────────────────────────────────────────

export interface SoftWeights {
  NEED_FIT: number;
  COVERAGE_VALUE: number;
  ACADEMIC_FIT: number;
  FIELD_FIT: number;
  URGENCY: number;
  EFFORT: number;
}

/**
 * Weights shift by opportunity type. Need-based funding is dominated by need;
 * pure merit funding is dominated by academics. This is also the fairness
 * control from docs/PLAN.md risk R11 — merit students are not permanently
 * ranked below need-based students for merit opportunities.
 */
export function weightsFor(opportunity: OpportunityForMatching): SoftWeights {
  const pureMerit = opportunity.isMeritBased && !opportunity.isNeedBased;
  if (pureMerit) {
    return {
      NEED_FIT: 8,
      COVERAGE_VALUE: 15,
      ACADEMIC_FIT: 35,
      FIELD_FIT: 20,
      URGENCY: 12,
      EFFORT: 10,
    };
  }
  if (opportunity.isNeedBased) {
    return {
      NEED_FIT: 35,
      COVERAGE_VALUE: 20,
      ACADEMIC_FIT: 15,
      FIELD_FIT: 10,
      URGENCY: 12,
      EFFORT: 8,
    };
  }
  return {
    NEED_FIT: 20,
    COVERAGE_VALUE: 20,
    ACADEMIC_FIT: 20,
    FIELD_FIT: 15,
    URGENCY: 15,
    EFFORT: 10,
  };
}

function needFitValue(opportunity: OpportunityForMatching, student: StudentMatchInput): number | null {
  if (student.financialNeedScore == null) return null;
  const needScore = student.financialNeedScore;
  const needCriterion = opportunity.criteria.find((c) => c.code === "INCOME_NEED");

  if (needCriterion) {
    const threshold = (asNumber(needCriterion.value.gte) ?? 0) / (asNumber(needCriterion.value.scale) ?? 100);
    if (needScore >= threshold) {
      const headroom = Math.max(1, 100 - threshold);
      return round1(0.4 + 0.6 * clamp01((needScore - threshold) / headroom));
    }
    return round1(0.4 * (threshold === 0 ? 0 : clamp01(needScore / threshold)));
  }

  if (opportunity.isNeedBased) return round1(clamp01(needScore / 100));
  // Merit-only funding: need is irrelevant, so contribute a neutral 0.5 rather
  // than penalising students who happen to need support.
  return 0.5;
}

function coverageValue(opportunity: OpportunityForMatching): number {
  if (opportunity.type !== "SCHOLARSHIP") return 0.4;
  let value = 0;
  switch (opportunity.tuitionCoverage) {
    case "FULL":
      value = 1;
      break;
    case "PERCENT":
      value = ((opportunity.tuitionCoveragePercent ?? 0) / 100) * 0.8;
      break;
    case "PARTIAL":
      value = 0.4;
      break;
    default:
      value = 0;
  }
  if (opportunity.coversLiving) value += 0.15;
  if (opportunity.coversTravel) value += 0.05;
  if ((opportunity.stipendAmount ?? 0) > 0) value += 0.05;
  return round1(clamp01(value));
}

function academicFitValue(opportunity: OpportunityForMatching, student: StudentMatchInput): number | null {
  const criterion = opportunity.criteria.find((c) => c.code === "MIN_CGPA");
  if (student.cgpa == null) return null;
  const scale = asNumber(student.cgpaScale) ?? 4.0;
  if (!criterion) return 0.5;
  const minCgpa = asNumber(criterion.value.gte);
  const criterionScale = asNumber(criterion.value.scale) ?? scale;
  if (minCgpa === null || !scale || !criterionScale) return 0.5;
  const margin = student.cgpa / scale - minCgpa / criterionScale;
  // Beyond ~0.5 (on a normalised scale) extra marks add no eligibility value.
  return round1(clamp01(0.5 + margin / 0.5));
}

function fieldFitValue(opportunity: OpportunityForMatching, student: StudentMatchInput): number | null {
  const criterion = opportunity.criteria.find((c) => c.code === "FIELD");
  if (!criterion) return 0.5;
  if (student.field == null) return null;
  const outcome = evaluateCriterion(criterion, student);
  return outcome.passed ? 1 : 0.1;
}

/** Deadlines further away are not more valuable, so this is not monotonic in "soon". */
function urgencyValue(days: number | null): number | null {
  if (days === null) return 0.5;
  if (days <= 0) return 0;
  if (days <= 14) return 0.95;
  if (days <= 30) return 1;
  if (days <= 60) return 0.8;
  if (days <= 120) return 0.55;
  return 0.35;
}

function effortValue(opportunity: OpportunityForMatching, student: StudentMatchInput): number | null {
  const required = opportunity.requiredDocuments ?? [];
  if (required.length === 0) return 0.6;
  const onHand = new Set((student.documentsOnHand ?? []).map((d) => d.toUpperCase()));
  const missing = required.filter((doc) => !onHand.has(doc.toUpperCase())).length;
  return round1(clamp01((required.length - missing) / required.length));
}

// ── Orchestration ──────────────────────────────────────────────────────────

const PROFILE_FIELDS_FOR_CONFIDENCE = [
  "age",
  "countryCode",
  "cgpa",
  "degreeLevel",
  "field",
  "financialNeedScore",
] as const;

export function confidenceFactor(student: StudentMatchInput, policy: MatchPolicy): number {
  const missing = PROFILE_FIELDS_FOR_CONFIDENCE.filter((field) => student[field] == null).length;
  const penalty = Math.min(
    policy.maxConfidencePenalty,
    policy.confidencePenaltyPerMissingField * missing,
  );
  return round1(1 - penalty);
}

/** Small, closable gaps are shown as near-misses rather than dead ends. */
function isNearMiss(disqualifiers: Disqualifier[]): boolean {
  if (disqualifiers.length !== 1) return false;
  const gap = disqualifiers[0].nearMissGap;
  if (gap == null) return false;
  switch (disqualifiers[0].code) {
    case "MIN_CGPA":
      return gap <= 0.08; // ~8% of the scale away
    case "MIN_HAT":
      // Normalised to a 100-point scale, so 0.08 ≈ 8 HAT points. A re-sit is
      // a realistic route to closing that, so it is shown as closable.
      return gap <= 0.08;
    case "MAX_AGE":
    case "MIN_AGE":
      return gap <= 3;
    case "INCOME_NEED":
      return gap <= 15;
    default:
      return false;
  }
}

export function matchOpportunity(
  opportunity: OpportunityForMatching,
  student: StudentMatchInput,
  today: string,
  policy: MatchPolicy = DEFAULT_POLICY,
  /**
   * Real clock, used only to tell "closes in four hours" from "already closed"
   * on the final day. Omit it and the engine assumes midday in Pakistan, which
   * keeps the function deterministic for tests.
   */
  now: Date = todayAsInstant(today),
): MatchResult {
  const reasons: ReasonCode[] = [];
  const disqualifiers: Disqualifier[] = [];
  const unverifiedCriteria: CriterionCode[] = [];

  const verificationStatus = opportunity.verificationStatus ?? "UNVERIFIED";
  if (policy.requireVerifiedForMatch && verificationStatus !== "VERIFIED") {
    disqualifiers.push({
      code: "VERIFICATION",
      label: "Verification status",
      humanText: "This listing has not been verified by a MindMate administrator yet.",
    });
  }

  // Deadline maths runs in Asia/Karachi — see src/domain/shared/dates.ts. A
  // deadline is a wall-clock moment in the awarding body's country, and HEC
  // closes at 16:00 PKT, so truncating in UTC shows the wrong day.
  const deadline = opportunity.deadline ?? null;
  const state = deadlineState(deadline, now);
  const days = daysUntil(deadline, today);

  // Only a genuinely past instant closes an opportunity. A deadline that is
  // still ahead of the clock is NOT a disqualifier even when it closes today:
  // the student can still apply, and reporting "not eligible" for something
  // they can submit in four hours is exactly the false negative this engine is
  // built to avoid. Urgency is carried by the DEADLINE_NEAR reason instead.
  if (state.status === "CLOSED") {
    disqualifiers.push({
      code: "DEADLINE_CLOSED",
      label: "Applications closed",
      humanText: `Applications closed ${formatDeadline(deadline)}.`,
    });
  }

  for (const criterion of opportunity.criteria.filter((c) => c.required)) {
    const outcome = evaluateCriterion(criterion, student);
    if (!outcome.evaluable) unverifiedCriteria.push(criterion.code);
    if (!outcome.passed && outcome.disqualifier) disqualifiers.push(outcome.disqualifier);
    if (outcome.passed && outcome.passedReason && !reasons.includes(outcome.passedReason)) {
      reasons.push(outcome.passedReason);
    }
  }

  const nearMiss = disqualifiers.length > 0 && isNearMiss(disqualifiers);

  if (disqualifiers.length > 0) {
    return {
      opportunityId: opportunity.id,
      eligible: false,
      nearMiss,
      score: null,
      breakdown: [],
      reasons,
      disqualifiers,
      unverifiedCriteria,
      freshnessFactor: freshnessFactor(verificationStatus, opportunity.lastVerifiedAt ?? null, today),
      confidenceFactor: confidenceFactor(student, policy),
    };
  }

  const weights = weightsFor(opportunity);
  const raw: { code: keyof SoftWeights; weight: number; value: number | null }[] = [
    { code: "NEED_FIT", weight: weights.NEED_FIT, value: needFitValue(opportunity, student) },
    { code: "COVERAGE_VALUE", weight: weights.COVERAGE_VALUE, value: coverageValue(opportunity) },
    { code: "ACADEMIC_FIT", weight: weights.ACADEMIC_FIT, value: academicFitValue(opportunity, student) },
    { code: "FIELD_FIT", weight: weights.FIELD_FIT, value: fieldFitValue(opportunity, student) },
    { code: "URGENCY", weight: weights.URGENCY, value: urgencyValue(days) },
    { code: "EFFORT", weight: weights.EFFORT, value: effortValue(opportunity, student) },
  ];

  const available = raw.filter((component): component is typeof component & { value: number } =>
    component.value !== null,
  );
  const availableWeight = available.reduce((sum, component) => sum + component.weight, 0);

  const breakdown: MatchComponentBreakdown[] = available.map((component) => ({
    code: component.code,
    weight: component.weight,
    value: component.value,
    points:
      availableWeight > 0
        ? round1((100 * component.weight * component.value) / availableWeight)
        : 0,
  }));

  const weightedSum = available.reduce(
    (sum, component) => sum + component.weight * component.value,
    0,
  );
  const base = availableWeight > 0 ? (100 * weightedSum) / availableWeight : 0;

  const fresh = freshnessFactor(verificationStatus, opportunity.lastVerifiedAt ?? null, today);
  const confidence = confidenceFactor(student, policy);
  const score = Math.max(0, Math.min(100, Math.round(base * fresh * confidence)));

  if (opportunity.isNeedBased && !reasons.includes("NEED_BASED")) reasons.push("NEED_BASED");
  if (opportunity.isMeritBased && !reasons.includes("MERIT_BASED")) reasons.push("MERIT_BASED");
  if (opportunity.tuitionCoverage === "FULL" && !reasons.includes("COVERAGE_FULL_FEE")) {
    reasons.push("COVERAGE_FULL_FEE");
  }
  if ((opportunity.stipendAmount ?? 0) > 0 && !reasons.includes("STIPEND_INCLUDED")) {
    reasons.push("STIPEND_INCLUDED");
  }
  if (
    state.status === "CLOSING_TODAY" ||
    (days !== null && days > 0 && days <= 30)
  ) {
    if (!reasons.includes("DEADLINE_NEAR")) reasons.push("DEADLINE_NEAR");
  }
  const requiredDocs = opportunity.requiredDocuments ?? [];
  if (
    requiredDocs.length > 0 &&
    requiredDocs.every((doc) => (student.documentsOnHand ?? []).map((d) => d.toUpperCase()).includes(doc.toUpperCase())) &&
    !reasons.includes("DOCUMENTS_READY")
  ) {
    reasons.push("DOCUMENTS_READY");
  }
  if (verificationStatus === "UNVERIFIED" && !reasons.includes("UNVERIFIED_SOURCE")) {
    reasons.push("UNVERIFIED_SOURCE");
  }
  if (fresh < 0.85 && !reasons.includes("STALE_DATA")) reasons.push("STALE_DATA");

  return {
    opportunityId: opportunity.id,
    eligible: true,
    nearMiss: false,
    score,
    breakdown,
    reasons,
    disqualifiers: [],
    unverifiedCriteria,
    freshnessFactor: fresh,
    confidenceFactor: confidence,
  };
}

export function matchOpportunities(
  opportunities: OpportunityForMatching[],
  student: StudentMatchInput,
  today: string,
  policy: MatchPolicy = DEFAULT_POLICY,
  now: Date = todayAsInstant(today),
): MatchSummary {
  const results = opportunities.map((opportunity) =>
    matchOpportunity(opportunity, student, today, policy, now),
  );
  const eligible = results
    .filter((result) => result.eligible)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const nearMisses = results
    .filter((result) => !result.eligible && result.nearMiss)
    .sort((a, b) => a.disqualifiers[0].nearMissGap! - b.disqualifiers[0].nearMissGap!);

  return {
    engineVersion: ENGINE_VERSION,
    evaluatedOn: today,
    totalCandidates: results.length,
    eligibleCount: eligible.length,
    disqualifiedCount: results.length - eligible.length,
    results,
    eligible,
    nearMisses,
    usedAssumptions: results.some((result) => result.unverifiedCriteria.length > 0),
  };
}
