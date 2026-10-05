/**
 * Personalisation engine.
 *
 * The question the product has to answer: *given everything this student told
 * us, what should we show them first, and why?* Personalisation must never
 * change eligibility — it only changes ordering, tone and depth. That boundary
 * is deliberate: if taste could change whether a student is told they qualify,
 * the rule engine's guarantees would be worthless.
 *
 * Pure module. No I/O, no framework imports.
 */

export const PRIMARY_GOALS = ["FINANCE", "ACADEMIC", "CAREER", "WELLBEING"] as const;
export type PrimaryGoal = (typeof PRIMARY_GOALS)[number];

export const SUPPORT_PREFERENCES = ["SELF_GUIDED", "PEER", "PROFESSIONAL"] as const;
export type SupportPreference = (typeof SUPPORT_PREFERENCES)[number];

export const STUDY_STYLES = ["INTENSIVE", "STEADY", "SPACED"] as const;
export type StudyStyle = (typeof STUDY_STYLES)[number];

export const WORK_COMMITMENTS = ["NONE", "PART_TIME", "FULL_TIME"] as const;
export type WorkCommitment = (typeof WORK_COMMITMENTS)[number];

export const TONE_PREFERENCES = ["DIRECT", "GENTLE", "DETAILED"] as const;
export type TonePreference = (typeof TONE_PREFERENCES)[number];

export interface PersonalisationAnswers {
  primaryGoal: PrimaryGoal;
  secondaryGoals?: PrimaryGoal[];
  stressTriggers?: string[];
  supportPreference?: SupportPreference;
  availableHoursPerWeek?: number | null;
  studyStyle?: StudyStyle | null;
  commuteMinutes?: number | null;
  workCommitment?: WorkCommitment | null;
  caresForOthers?: boolean | null;
  preferredLanguage?: "en" | "ur" | null;
  tonePreference?: TonePreference | null;
}

export interface PersonalisationContext {
  /** Financial Need Score 0..100, if known. */
  needScore?: number | null;
  needBand?: string | null;
  /** Dominant concern from the most recent check-in. */
  topConcern?: string | null;
  /** Eligible opportunity count from the rule engine. */
  eligibleCount?: number | null;
}

export type PriorityCode =
  | "FUNDING"
  | "ACADEMIC_STABILITY"
  | "CAREER_PATHWAY"
  | "EMOTIONAL_WELLBEING"
  | "TIME_AND_ENERGY"
  | "CARING_RESPONSIBILITIES";

export interface Priority {
  code: PriorityCode;
  label: string;
  /** 0..1 relative emphasis. Sums to <= 1; not normalised, gaps are intentional. */
  emphasis: number;
  /** Plain-language justification, shown to the student. */
  why: string;
}

export interface WeeklyTimeBudget {
  totalHours: number;
  /** Hours per week allocated to each bucket. */
  study: number;
  wellbeing: number;
  work: number;
  commute: number;
  admin: number;
}

export interface PersonalisationResult {
  primaryGoal: PrimaryGoal;
  tone: TonePreference;
  detailLevel: "SUMMARY" | "DETAILED";
  language: "en" | "ur";
  priorities: Priority[];
  /** Which matching score components to lead with on the dashboard. */
  matchEmphasis: string[];
  weeklyBudget: WeeklyTimeBudget | null;
  studyPlan: { headline: string; steps: string[] } | null;
  supportRoute: { label: string; detail: string } | null;
  /** Every answer that actually changed the output — for transparency. */
  influences: { answer: string; effect: string }[];
}

const GOAL_LABELS: Record<PrimaryGoal, string> = {
  FINANCE: "Pay for my studies",
  ACADEMIC: "Do better academically",
  CAREER: "Prepare for a career",
  WELLBEING: "Feel steadier",
};

export function goalLabel(goal: PrimaryGoal): string {
  return GOAL_LABELS[goal] ?? goal;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Builds the priority stack. Every contribution is explicit so the UI can show
 * a "why you're seeing this" line — a ranking a student can't interrogate is
 * indistinguishable from a ranking that's biased.
 */
function buildPriorities(
  answers: PersonalisationAnswers,
  context: PersonalisationContext,
): Priority[] {
  const priorities: Priority[] = [];
  const influences: { answer: string; effect: string }[] = [];
  const triggers = new Set(answers.stressTriggers ?? []);

  // 1. Stated goal.
  const goalWeights: Record<PrimaryGoal, PriorityCode> = {
    FINANCE: "FUNDING",
    ACADEMIC: "ACADEMIC_STABILITY",
    CAREER: "CAREER_PATHWAY",
    WELLBEING: "EMOTIONAL_WELLBEING",
  };
  priorities.push({
    code: goalWeights[answers.primaryGoal],
    label: goalWeights[answers.primaryGoal]
      .split("_")
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(" "),
    emphasis: 0.34,
    why: `You told us your main goal is “${goalLabel(answers.primaryGoal).toLowerCase()}”.`,
  });
  influences.push({
    answer: "Main goal",
    effect: `Set “${goalLabel(answers.primaryGoal)}” as the lead priority.`,
  });

  // 2. Measured need overrides stated preference when they disagree.
  if (typeof context.needScore === "number") {
    const highNeed = context.needScore >= 60;
    const existing = priorities.find((p) => p.code === "FUNDING");
    if (highNeed) {
      if (existing) {
        existing.emphasis = 0.45;
        existing.label = "Funding you can actually access";
        existing.why = `Your financial profile scores ${context.needScore}/100, so funding is surfaced first regardless of what you picked.`;
      } else {
        priorities.push({
          code: "FUNDING",
          label: "Funding you can actually access",
          emphasis: 0.45,
          why: `Your financial profile scores ${context.needScore}/100, so funding is surfaced first regardless of what you picked.`,
        });
      }
      influences.push({
        answer: "Financial need score",
        effect: `Raised funding to the top priority (score ${context.needScore}/100).`,
      });
    } else if (existing && existing.emphasis === 0.34) {
      influences.push({
        answer: "Financial need score",
        effect: `Left funding below your stated goal (score ${context.needScore}/100).`,
      });
    }
  }

  // 3. Latest check-in concern.
  if (context.topConcern && context.topConcern !== "other") {
    const map: Record<string, PriorityCode> = {
      financial: "FUNDING",
      academic: "ACADEMIC_STABILITY",
      career: "CAREER_PATHWAY",
      family: "CARING_RESPONSIBILITIES",
      relationships: "EMOTIONAL_WELLBEING",
      loneliness: "EMOTIONAL_WELLBEING",
      sleep: "TIME_AND_ENERGY",
      health: "EMOTIONAL_WELLBEING",
    };
    const code = map[context.topConcern];
    if (code) {
      const existing = priorities.find((p) => p.code === code);
      if (existing) {
        existing.emphasis = clamp01(existing.emphasis + 0.18);
        existing.why = `${existing.why} Your latest check-in also points at ${context.topConcern}.`;
      } else {
        priorities.push({
          code,
          label:
            code === "FUNDING"
              ? "Funding you can actually access"
              : code === "ACADEMIC_STABILITY"
                ? "Academic stability"
                : code === "CAREER_PATHWAY"
                  ? "Career pathway"
                  : code === "CARING_RESPONSIBILITIES"
                    ? "Caring responsibilities"
                    : code === "TIME_AND_ENERGY"
                      ? "Time and energy"
                      : "Emotional wellbeing",
          emphasis: 0.28,
          why: `Your latest check-in's top concern was ${context.topConcern}.`,
        });
      }
      influences.push({
        answer: "Latest check-in",
        effect: `Boosted “${context.topConcern}” priority from your most recent check-in.`,
      });
    }
  }

  // 4. Explicit triggers.
  if (triggers.has("MONEY")) {
    const funding = priorities.find((p) => p.code === "FUNDING");
    if (funding) funding.emphasis = clamp01(funding.emphasis + 0.1);
    else
      priorities.push({
        code: "FUNDING",
        label: "Funding you can actually access",
        emphasis: 0.25,
        why: "You listed money as a recurring pressure.",
      });
    influences.push({ answer: "Money is a pressure", effect: "Boosted funding priority." });
  }
  if (triggers.has("FAMILY") || answers.caresForOthers) {
    priorities.push({
      code: "CARING_RESPONSIBILITIES",
      label: "Caring responsibilities",
      emphasis: 0.16,
      why: "You look after other people, so plans assume you have less slack in a week.",
    });
    influences.push({
      answer: answers.caresForOthers ? "You care for others" : "Family pressure",
      effect: "Reduced the slack assumed in your weekly plan.",
    });
  }
  if (triggers.has("SLEEP")) {
    priorities.push({
      code: "TIME_AND_ENERGY",
      label: "Time and energy",
      emphasis: 0.14,
      why: "Sleep is one of your listed pressures, so rest is scheduled before study.",
    });
    influences.push({ answer: "Sleep is a pressure", effect: "Scheduled rest before study time." });
  }

  // Secondary goals add a floor so they stay visible.
  for (const secondary of answers.secondaryGoals ?? []) {
    const code = goalWeights[secondary];
    if (!code) continue;
    const existing = priorities.find((p) => p.code === code);
    if (existing) continue;
    priorities.push({
      code,
      label: code.split("_").map((p) => p.charAt(0) + p.slice(1).toLowerCase()).join(" "),
      emphasis: 0.12,
      why: `You also listed “${goalLabel(secondary).toLowerCase()}” as a goal.`,
    });
    influences.push({ answer: `Secondary goal: ${goalLabel(secondary)}`, effect: "Kept it visible below the main goal." });
  }

  return priorities
    .map((priority) => ({ ...priority, emphasis: round2(clamp01(priority.emphasis)) }))
    .sort((a, b) => b.emphasis - a.emphasis);
}

/**
 * Weekly time budget. Deliberately reserves wellbeing time *before* study time
 * and never allocates more than the student actually has.
 */
function buildWeeklyBudget(answers: PersonalisationAnswers): {
  budget: WeeklyTimeBudget | null;
  influences: { answer: string; effect: string }[];
} {
  const influences: { answer: string; effect: string }[] = [];
  const declared = answers.availableHoursPerWeek;
  const commuteHours = Math.round(((answers.commuteMinutes ?? 0) / 60) * 10) / 10;
  if (declared == null) {
    if (commuteHours > 0) {
      influences.push({
        answer: "Commute time",
        effect: `Recorded ${commuteHours}h/week of travel, but a full plan needs your available hours.`,
      });
    }
    return { budget: null, influences };
  }

  const total = Math.max(1, Math.min(80, declared));
  const style = answers.studyStyle ?? "STEADY";

  // Fixed demands first.
  const work = answers.workCommitment === "FULL_TIME" ? total * 0.55
    : answers.workCommitment === "PART_TIME" ? total * 0.2
    : 0;
  const caring = answers.caresForOthers ? total * 0.12 : 0;
  const admin = 1;
  const commute = Math.min(commuteHours, Math.max(0, total * 0.25));

  // Remaining is split study / wellbeing. Wellbeing gets a floor of 15%.
  const remaining = Math.max(1, total - work - caring - commute - admin);
  const wellbeingShare = style === "INTENSIVE" ? 0.12 : style === "SPACED" ? 0.25 : 0.2;
  const wellbeing = Math.max(2, round2(remaining * wellbeingShare));
  const study = round2(Math.max(1, remaining - wellbeing));

  influences.push({
    answer: "Hours available per week",
    effect: `Built a ${total}h week around your other commitments.`,
  });
  if (answers.workCommitment && answers.workCommitment !== "NONE") {
    influences.push({
      answer: "Work commitment",
      effect: `Reserved ${Math.round(work)}h/week for paid work before planning study.`,
    });
  }
  if (commute > 0) {
    influences.push({ answer: "Commute time", effect: `Reserved ${commute}h/week for travel.` });
  }
  if (answers.caresForOthers) {
    influences.push({
      answer: "You care for others",
      effect: `Reserved ${Math.round(caring)}h/week for caring responsibilities.`,
    });
  }

  return {
    budget: { totalHours: total, study, wellbeing, work: round2(work), commute, admin },
    influences,
  };
}

function buildStudyPlan(
  answers: PersonalisationAnswers,
  budget: WeeklyTimeBudget | null,
): PersonalisationResult["studyPlan"] {
  const style = answers.studyStyle ?? "STEADY";
  if (!budget) return null;

  if (style === "INTENSIVE") {
    return {
      headline: `${round2(budget.study)}h/week of study, in long blocks`,
      steps: [
        "Two protected blocks of 90 minutes, five days a week.",
        `Keep ${budget.wellbeing}h of rest and recovery — cutting it is what makes this style fail.`,
        "One weekly review of what is not working. Intensive does not mean more hours, it means fewer switches.",
      ],
    };
  }
  if (style === "SPACED") {
    return {
      headline: `${round2(budget.study)}h/week, spread across the week`,
      steps: [
        "Five short sessions of 30–40 minutes rather than one long one.",
        "Review the previous session at the start of each one — spacing beats cramming for retention.",
        "Keep one day with no study target at all.",
      ],
    };
  }
  return {
    headline: `${round2(budget.study)}h/week, steady`,
    steps: [
      "Three sessions of about 60 minutes across the week.",
      "Start each session by writing the one thing you will finish.",
      `Protect ${budget.wellbeing}h of the week for rest, people or movement.`,
    ],
  };
}

function buildSupportRoute(answers: PersonalisationAnswers): PersonalisationResult["supportRoute"] {
  switch (answers.supportPreference) {
    case "SELF_GUIDED":
      return {
        label: "Self-guided first",
        detail:
          "You will get reading, exercises and checklists before any suggestion to see a person. You can ask for a person at any time.",
      };
    case "PEER":
      return {
        label: "Peer support first",
        detail:
          "We will point you to student societies and peer groups before formal services, because that is what you said works for you.",
      };
    case "PROFESSIONAL":
      return {
        label: "Professional support first",
        detail:
          "Counsellor, advisor and financial aid office contacts will appear at the top, with self-guided material underneath.",
      };
    default:
      return null;
  }
}

const EMPHASIS: Record<PriorityCode, string[]> = {
  FUNDING: ["NEED_FIT", "COVERAGE_VALUE"],
  ACADEMIC_STABILITY: ["ACADEMIC_FIT", "URGENCY"],
  CAREER_PATHWAY: ["FIELD_FIT", "EFFORT"],
  EMOTIONAL_WELLBEING: ["EFFORT", "URGENCY"],
  TIME_AND_ENERGY: ["EFFORT", "URGENCY"],
  CARING_RESPONSIBILITIES: ["COVERAGE_VALUE", "EFFORT"],
};

export function buildPersonalisation(
  answers: PersonalisationAnswers,
  context: PersonalisationContext = {},
): PersonalisationResult {
  const { budget, influences: budgetInfluences } = buildWeeklyBudget(answers);
  const priorities = buildPriorities(answers, context);
  const tone: TonePreference = answers.tonePreference ?? "DIRECT";

  return {
    primaryGoal: answers.primaryGoal,
    tone,
    detailLevel: tone === "DETAILED" ? "DETAILED" : "SUMMARY",
    language: answers.preferredLanguage ?? "en",
    priorities,
    matchEmphasis: EMPHASIS[priorities[0]?.code ?? "FUNDING"],
    weeklyBudget: budget,
    studyPlan: buildStudyPlan(answers, budget),
    supportRoute: buildSupportRoute(answers),
    influences: [...collectInfluences(answers, context), ...budgetInfluences],
  };
}

/** Single source of truth for the transparency list. */
function collectInfluences(
  answers: PersonalisationAnswers,
  context: PersonalisationContext,
): { answer: string; effect: string }[] {
  const out: { answer: string; effect: string }[] = [];
  out.push({
    answer: "Main goal",
    effect: `Set “${goalLabel(answers.primaryGoal)}” as the lead priority.`,
  });
  if (typeof context.needScore === "number") {
    out.push({
      answer: "Financial need score",
      effect:
        context.needScore >= 60
          ? `Raised funding to the top priority (score ${context.needScore}/100).`
          : `Did not override your goal — funding stayed below it (score ${context.needScore}/100).`,
    });
  }
  if (context.topConcern && context.topConcern !== "other") {
    out.push({
      answer: "Latest check-in",
      effect: `Boosted the “${context.topConcern}” priority.`,
    });
  }
  const triggers = answers.stressTriggers ?? [];
  for (const trigger of triggers) {
    if (["MONEY", "FAMILY", "SLEEP"].includes(trigger)) {
      out.push({ answer: `Pressure: ${trigger.toLowerCase()}`, effect: "Increased that priority." });
    }
  }
  for (const secondary of answers.secondaryGoals ?? []) {
    out.push({
      answer: `Secondary goal: ${goalLabel(secondary)}`,
      effect: "Kept it visible below the main goal.",
    });
  }
  if (answers.caresForOthers) {
    out.push({ answer: "You care for others", effect: "Reduced the slack assumed in your weekly plan." });
  }
  return out;
}

export const PRIORITY_LABELS: Record<PriorityCode, string> = {
  FUNDING: "Funding you can actually access",
  ACADEMIC_STABILITY: "Academic stability",
  CAREER_PATHWAY: "Career pathway",
  EMOTIONAL_WELLBEING: "Emotional wellbeing",
  TIME_AND_ENERGY: "Time and energy",
  CARING_RESPONSIBILITIES: "Caring responsibilities",
};
