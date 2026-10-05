/**
 * Planning service — loads a student's onboarding answers and budget inputs and
 * hands them to the pure engines.
 *
 * Same seam rule as `matching.service`: this file does I/O and shape-mapping
 * only. All decisions live in `src/domain`.
 */

import { prisma } from "@/server/db/client";
import {
  buildPersonalisation,
  type PersonalisationAnswers,
  type PersonalisationContext,
  type PersonalisationResult,
  type PrimaryGoal,
  type SupportPreference,
  type StudyStyle,
  type TonePreference,
  type WorkCommitment,
} from "@/domain/personalisation/profile";
import {
  planFinances,
  EXPENSE_CATEGORIES,
  EXPENSE_LABELS,
  type ExpenseCategory,
  type ExpenseInput,
  type FinancialPlan,
  type IncomeSourceInput,
  type PlannerInput,
} from "@/domain/finance/planner";
import type { FinancialNeedResult } from "@/domain/financial/score";

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const asOneOf = <T extends string>(value: unknown, allowed: readonly T[]): T | null =>
  typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;

/** Column values are plain strings in SQLite; narrow them or drop them. */
function narrowAnswers(row: {
  primaryGoal: string;
  secondaryGoals: string | null;
  stressTriggers: string | null;
  supportPreference: string | null;
  availableHoursPerWeek: number | null;
  studyStyle: string | null;
  commuteMinutes: number | null;
  workCommitment: string | null;
  caresForOthers: boolean;
  preferredLanguage: string;
  tonePreference: string;
}): PersonalisationAnswers {
  const goals = parseJson<string[]>(row.secondaryGoals, []);
  return {
    primaryGoal: (asOneOf(row.primaryGoal, [
      "FINANCE",
      "ACADEMIC",
      "CAREER",
      "WELLBEING",
    ] as const) ?? "FINANCE") as PrimaryGoal,
    secondaryGoals: goals.filter((goal): goal is PrimaryGoal =>
      (["FINANCE", "ACADEMIC", "CAREER", "WELLBEING"] as string[]).includes(goal),
    ),
    stressTriggers: parseJson<string[]>(row.stressTriggers, []),
    supportPreference:
      (asOneOf(row.supportPreference, [
        "SELF_GUIDED",
        "PEER",
        "PROFESSIONAL",
      ] as const) as SupportPreference | undefined) ?? undefined,
    availableHoursPerWeek: row.availableHoursPerWeek,
    studyStyle: asOneOf(row.studyStyle, ["INTENSIVE", "STEADY", "SPACED"] as const) as
      | StudyStyle
      | null,
    commuteMinutes: row.commuteMinutes,
    workCommitment: asOneOf(row.workCommitment, [
      "NONE",
      "PART_TIME",
      "FULL_TIME",
    ] as const) as WorkCommitment | null,
    caresForOthers: row.caresForOthers,
    preferredLanguage: row.preferredLanguage === "ur" ? "ur" : "en",
    tonePreference: (asOneOf(row.tonePreference, [
      "DIRECT",
      "GENTLE",
      "DETAILED",
    ] as const) ?? "DIRECT") as TonePreference,
  };
}

const EXPENSE_CODES = EXPENSE_CATEGORIES;

export { EXPENSE_CODES, EXPENSE_LABELS };

/** Drops anything that is not a well-formed expense row. */
function narrowExpenses(raw: unknown): ExpenseInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry): ExpenseInput | null => {
      if (typeof entry !== "object" || entry === null) return null;
      const record = entry as Record<string, unknown>;
      const code = asOneOf(record.code, EXPENSE_CODES);
      const monthly = Number(record.monthly);
      if (!code || !Number.isFinite(monthly) || monthly < 0) return null;
      return {
        code,
        label:
          typeof record.label === "string" && record.label.trim()
            ? record.label.trim().slice(0, 60)
            : EXPENSE_LABELS[code],
        monthly,
        essential: record.essential === true,
      };
    })
    .filter((entry): entry is ExpenseInput => entry !== null);
}

function narrowIncomeSources(raw: unknown): IncomeSourceInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry): IncomeSourceInput | null => {
      if (typeof entry !== "object" || entry === null) return null;
      const record = entry as Record<string, unknown>;
      const monthly = Number(record.monthly);
      if (!Number.isFinite(monthly) || monthly < 0) return null;
      return {
        label:
          typeof record.label === "string" && record.label.trim()
            ? record.label.trim().slice(0, 60)
            : "Income",
        monthly,
        stable: record.stable === true,
      };
    })
    .filter((entry): entry is IncomeSourceInput => entry !== null);
}

export interface PlanningView {
  personalisation: PersonalisationResult | null;
  plan: FinancialPlan | null;
  answers: PersonalisationAnswers | null;
  plannerInput: PlannerInput | null;
  budgetUpdatedAt: string | null;
  onboardingComplete: boolean;
}

export async function getPlanningView(
  email: string,
  need: FinancialNeedResult,
  topConcern: string | null,
): Promise<PlanningView> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { personalisationProfile: true, budgetPlan: true },
  });

  const profile = user?.personalisationProfile ?? null;
  const budget = user?.budgetPlan ?? null;

  const answers = profile ? narrowAnswers(profile) : null;
  const personalisation = answers
    ? buildPersonalisation(answers, {
        needScore: need.score,
        needBand: need.band,
        topConcern,
      } satisfies PersonalisationContext)
    : null;

  const plannerInput: PlannerInput | null = budget
    ? {
        incomeSources: narrowIncomeSources(parseJson(budget.incomeSources, [])),
        expenses: narrowExpenses(parseJson(budget.expenses, [])),
        annualTuition: budget.annualTuition,
        termsPerYear: budget.termsPerYear,
        bufferTargetMonths: budget.bufferTargetMonths,
      }
    : null;

  return {
    personalisation,
    plan: plannerInput ? planFinances(plannerInput) : null,
    answers,
    plannerInput,
    budgetUpdatedAt: budget ? budget.updatedAt.toISOString() : null,
    onboardingComplete: Boolean(profile?.completedAt),
  };
}