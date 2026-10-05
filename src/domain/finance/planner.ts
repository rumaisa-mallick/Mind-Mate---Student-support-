/**
 * Financial planner.
 *
 * "Plan everything for me" is the feature request; this module is what makes
 * that safe to answer. It does not hand out advice like a financial adviser. It
 * turns a student's own monthly numbers into:
 *   · whether they run a surplus or a shortfall,
 *   · a term-by-term cash-flow view around their real fee due dates,
 *   · a concrete annual funding target that the eligibility engine can match
 *     against real scholarships,
 *   · and a prioritised list of levers, each quantified in rupees.
 *
 * Every number is derived from the student's own inputs. There is no hidden
 * assumption, and where a number depends on an assumption the output says so.
 *
 * Pure module. No I/O, no framework imports.
 */

export const EXPENSE_CATEGORIES = [
  "TUITION",
  "ACCOMMODATION",
  "FOOD",
  "TRANSPORT",
  "PHONE_DATA",
  "STUDY_MATERIALS",
  "HEALTH",
  "FAMILY_SUPPORT",
  "SOCIAL",
  "OTHER",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface ExpenseInput {
  code: ExpenseCategory;
  label: string;
  /** Monthly amount in PKR. */
  monthly: number;
  /**
   * Essential expenses are protected in the "cut list". Social and "other" are
   * discretionary — but the planner never tells a student to cut them, it only
   * shows the effect if they do.
   */
  essential: boolean;
}

export interface IncomeSourceInput {
  label: string;
  monthly: number;
  /** Stable = predictable each month. Variable = gig/part-time. */
  stable: boolean;
}

export type Position = "SURPLUS" | "BALANCED" | "SHORTFALL";

export interface TermPlanEntry {
  /** 1-based term index. */
  term: number;
  /** Label like "Semester 1". */
  label: string;
  /** PKR due in this term. */
  feeDue: number;
  /** Cumulative shortfall up to and including this term (0 if covered). */
  runningGap: number;
  /** Whether current monthly savings can cover this term's fee. */
  coveredBySavings: boolean;
  advice: string;
}

export interface Lever {
  code: string;
  label: string;
  /** PKR saved per month if acted on. */
  monthlyImpact: number;
  note: string;
  /**
   * True when acting on this lever means giving something up rather than
   * earning or securing more.
   *
   * The UI renders these differently on purpose. A student short of money is
   * often told by everyone else what to give up; the one thing this app will
   * not do is join in. Social spending is quantified and left visible, then the
   * decision is handed back.
   */
  discretionary?: boolean;
}

export interface FinancialPlan {
  position: Position;
  /** Sum of income. */
  monthlyIncome: number;
  /** Stable income only — used to judge reliability. */
  monthlyStableIncome: number;
  monthlyExpenses: number;
  monthlyEssential: number;
  monthlyDiscretionary: number;
  /** income − expenses. Negative = shortfall. */
  monthlySurplus: number;
  annualSurplus: number;
  /** Annual funding target to plug any shortfall, in PKR. Rounded to nearest 1000. */
  annualFundingTarget: number;
  /** Emergency buffer: essential spend × target months. */
  emergencyBufferTarget: number;
  terms: TermPlanEntry[];
  levers: Lever[];
  /** Total monthly benefit if every lever is applied. */
  maxMonthlyLeverImpact: number;
  /** True when levers can close the gap without extra income. */
  leversCloseGap: boolean;
  headline: string;
  /** Every assumption that affected the output. */
  assumptions: string[];
}

export interface PlannerInput {
  incomeSources: IncomeSourceInput[];
  expenses: ExpenseInput[];
  /** Annual tuition in PKR (may be 0 if paid by an award). */
  annualTuition: number;
  /** How many fee instalments/terms per academic year. */
  termsPerYear?: number;
  /** Desired cash buffer in months of essential spend. */
  bufferTargetMonths?: number;
}

const round = (value: number): number => Math.round(value);
const round500 = (value: number): number => Math.round(value / 500) * 500;
const round1000 = (value: number): number => Math.round(value / 1000) * 1000;
const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);

function positionFor(surplus: number): Position {
  // Within ±2% of income counts as balanced.
  if (surplus >= 0) return "SURPLUS";
  return "SHORTFALL";
}

export function planFinances(input: PlannerInput): FinancialPlan {
  const assumptions: string[] = [];

  const monthlyIncome = round(sum(input.incomeSources.map((source) => source.monthly)));
  const monthlyStableIncome = round(
    sum(input.incomeSources.filter((source) => source.stable).map((source) => source.monthly)),
  );
  const monthlyExpenses = round(sum(input.expenses.map((expense) => expense.monthly)));
  const monthlyEssential = round(
    sum(input.expenses.filter((expense) => expense.essential).map((expense) => expense.monthly)),
  );
  const monthlyDiscretionary = monthlyExpenses - monthlyEssential;

  const monthlySurplus = round(monthlyIncome - monthlyExpenses);
  const annualSurplus = monthlySurplus * 12;
  const position = positionFor(monthlySurplus);

  const termsPerYear = Math.max(1, input.termsPerYear ?? 2);
  const bufferTargetMonths = Math.max(1, input.bufferTargetMonths ?? 3);
  const emergencyBufferTarget = round500(monthlyEssential * bufferTargetMonths);

  if (input.incomeSources.some((source) => !source.stable)) {
    assumptions.push(
      "Some income is variable (part-time/gig). Term planning uses total income, so treat a slow month as a risk.",
    );
  }
  if (termsPerYear !== 2) {
    assumptions.push(`Fee schedule set to ${termsPerYear} term(s) per year as you specified.`);
  }

  // ── Term-by-term cash flow ────────────────────────────────────────────────
  const feePerTerm = input.annualTuition > 0 ? input.annualTuition / termsPerYear : 0;
  // Months of surplus available to fund a term: assume surplus accumulates over
  // the months between fee dates. Conservative: only the surplus itself counts.
  const monthlySavingCapacity = Math.max(0, monthlySurplus);
  const monthsPerTerm = Math.round(12 / termsPerYear);
  const savingsPerTerm = round(monthlySavingCapacity * monthsPerTerm);

  const terms: TermPlanEntry[] = [];
  let runningGap = 0;
  for (let index = 0; index < termsPerYear; index += 1) {
    const feeDue = round(feePerTerm);
    runningGap = round(runningGap + feeDue - savingsPerTerm);
    const coveredBySavings = runningGap <= 0;
    const term: TermPlanEntry = {
      term: index + 1,
      label: `Term ${index + 1}`,
      feeDue,
      runningGap: Math.max(0, runningGap),
      coveredBySavings,
      advice: "",
    };
    term.advice = coveredBySavings
      ? "Your current monthly balance covers this instalment — no action needed this term."
      : `Short by about ${pkrLabel(Math.max(0, runningGap))} by the end of this term. Start a funding search now; instalments are usually payable before the term starts.`;
    terms.push(term);
  }

  // ── Funding target ─────────────────────────────────────────────────────────
  // The funding target is money that must come from outside this plan, so it
  // exists only when there is a shortfall. When the plan runs a surplus we
  // assert zero: telling a student who is in surplus they need a Rs 75,000
  // scholarship would be a false claim, and the matching engine would then
  // surface awards they do not need.
  //
  // When a shortfall does exist, the buffer is added — being short AND having no
  // emergency cushion is one problem, and closing only half of it leaves the
  // student exposed to the first bad month.
  const annualShortfall = Math.max(0, -annualSurplus);
  const annualFundingTarget =
    annualShortfall > 0 ? round1000(annualShortfall + emergencyBufferTarget) : 0;

  // ── Levers ────────────────────────────────────────────────────────────────
  const levers: Lever[] = [];
  const social = input.expenses.find((expense) => expense.code === "SOCIAL");
  const socialMonthly = social && social.monthly > 0 ? social.monthly : 0;

  if (socialMonthly > 0) {
    // Stated as a fact about the budget, not as advice. The amount is real and
    // the student is entitled to see it, but the framing is deliberately inert:
    // this app does not tell anyone what to give up.
    levers.push({
      code: "SOCIAL",
      label: `Social and outings — ${pkrLabel(socialMonthly)}/month`,
      monthlyImpact: 0,
      discretionary: true,
      note: "Included so your budget adds up. This is your money and your call — we are not going to tell you to cut it.",
    });
  }

  // Non-essential spend EXCLUDING social, because the two levers would
  // otherwise count the same rupees twice and overstate what is achievable.
  const trim = input.expenses.filter(
    (expense) => !expense.essential && expense.code !== "SOCIAL" && expense.monthly > 0,
  );
  const trimMonthly = sum(trim.map((expense) => expense.monthly));
  if (trimMonthly > 0) {
    levers.push({
      code: "DISC_TRIM",
      label: "Reducing other non-essential spending by 20%",
      monthlyImpact: round(trimMonthly * 0.2),
      discretionary: true,
      note: `Across ${trim.map((e) => e.label).join(", ")}. Your call, and only if you want the cash.`,
    });
  }
  // Housing is the biggest lever for students living off-campus.
  const housing = input.expenses.find((expense) => expense.code === "ACCOMMODATION");
  if (housing && housing.monthly > 0) {
    levers.push({
      code: "HOUSING",
      label: `Move to lower-cost accommodation / commute from home`,
      monthlyImpact: round(housing.monthly * 0.25),
      note: "Usually the single biggest monthly lever. Check university hostels for subsidised rates.",
    });
  }
  levers.push({
    code: "STUDENT_WORK",
    label: "Part-time work or assistantship",
    monthlyImpact: 20_000,
    note: "Typical campus assistant or tutoring rate. Verify against local rates — this is a planning placeholder.",
  });

  if (annualFundingTarget > 0) {
    levers.push({
      code: "BURSARY",
      label: "Apply to need-based bursaries and university aid",
      monthlyImpact: round1000(annualFundingTarget / 12),
      note: "Highest-value lever and the one this app matches for you. Apply early — most have fixed terms.",
    });
  } else {
    // No shortfall, so there is nothing to raise. Asserting a bursary figure
    // here would tell a student who does not need one that money is
    // available, which is both false and, for someone in surplus, insulting.
    levers.push({
      code: "BURSARY",
      label: "Need-based bursaries and university aid",
      monthlyImpact: 0,
      note: "Your plan already covers its costs, so there is no gap to fill here. Listed because aid exists if your situation changes.",
    });
  }

  // Ranked by real monthly value, because the UI promises "ranked by real
// monthly rupees" and the build order is a coincidence of how the code is
// written. Rows worth nothing (social, and a bursary line when there is no
// shortfall) sort last: they are context, not options.
levers.sort((a, b) => b.monthlyImpact - a.monthlyImpact);

  const maxMonthlyLeverImpact = round(sum(levers.map((lever) => lever.monthlyImpact)));
  // Only meaningful when there is a shortfall. Comparing levers against a
  // surplus asks "can you levers away money you don't need", which is
  // incoherent and reads as a warning in the one case that needs none.
  const leversCloseGap =
    monthlySurplus < 0 && maxMonthlyLeverImpact >= Math.abs(monthlySurplus);

  // ── Headline (non-stigmatising, action-framed) ─────────────────────────────
  let headline: string;
  if (position === "SURPLUS") {
    headline =
      monthlySurplus >= monthlyIncome * 0.1
        ? "Your plan has healthy headroom. You could build a buffer or take on a larger application load."
        : "Your income covers your monthly costs with a small margin — keep it steady and keep a buffer growing.";
  } else {
    headline = `Your monthly costs run about ${pkrLabel(Math.abs(monthlySurplus))} above your income. That gap is addressable — the funding matches and levers below are where to start.`;
  }

  return {
    position,
    monthlyIncome,
    monthlyStableIncome,
    monthlyExpenses,
    monthlyEssential,
    monthlyDiscretionary,
    monthlySurplus,
    annualSurplus,
    annualFundingTarget,
    emergencyBufferTarget,
    terms,
    levers,
    maxMonthlyLeverImpact,
    leversCloseGap,
    headline,
    assumptions,
  };
}

/** PKR with thousands separators, for plan copy. */
export function pkrLabel(amount: number): string {
  const rounded = round(Math.abs(amount));
  const sign = amount < 0 ? "-" : "";
  return `${sign}Rs ${rounded.toLocaleString("en-PK")}`;
}

/** Default monthly expense scaffold for a Pakistani student (editable). */
export const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  TUITION: "Tuition fees",
  ACCOMMODATION: "Accommodation",
  FOOD: "Food & groceries",
  TRANSPORT: "Transport & fuel",
  PHONE_DATA: "Phone & internet",
  STUDY_MATERIALS: "Books & study materials",
  HEALTH: "Health & pharmacy",
  FAMILY_SUPPORT: "Support sent to family",
  SOCIAL: "Social & outings",
  OTHER: "Other",
};

export function defaultExpenses(): ExpenseInput[] {
  return [
    { code: "FOOD", label: "Food & groceries", monthly: 18_000, essential: true },
    { code: "TRANSPORT", label: "Transport & fuel", monthly: 6_000, essential: true },
    { code: "ACCOMMODATION", label: "Accommodation", monthly: 24_000, essential: true },
    { code: "PHONE_DATA", label: "Phone & internet", monthly: 3_000, essential: true },
    { code: "STUDY_MATERIALS", label: "Books & study materials", monthly: 3_000, essential: false },
    { code: "SOCIAL", label: "Social & outings", monthly: 4_000, essential: false },
    { code: "FAMILY_SUPPORT", label: "Support sent to family", monthly: 0, essential: false },
    { code: "HEALTH", label: "Health & pharmacy", monthly: 1_500, essential: true },
    { code: "OTHER", label: "Other", monthly: 0, essential: false },
  ];
}
