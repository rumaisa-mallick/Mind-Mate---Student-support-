/** Financial planner: arithmetic, term cash flow, funding target, levers. */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  planFinances,
  pkrLabel,
  defaultExpenses,
  type ExpenseInput,
  type PlannerInput,
} from "../../src/domain/finance/planner.ts";

const expenses = (pairs: [ExpenseInput["code"], number, boolean?][]): ExpenseInput[] =>
  pairs.map(([code, monthly, essential]) => ({
    code,
    label: code,
    monthly,
    essential: essential ?? true,
  }));

const input = (over: Partial<PlannerInput> = {}): PlannerInput => ({
  incomeSources: [{ label: "Family support", monthly: 30_000, stable: true }],
  expenses: expenses([
    ["FOOD", 12_000],
    ["TRANSPORT", 5_000],
    ["ACCOMMODATION", 8_000],
  ]),
  annualTuition: 120_000,
  ...over,
});

test("monthly income is the sum of all sources", () => {
  const plan = planFinances(
    input({
      incomeSources: [
        { label: "Family", monthly: 30_000, stable: true },
        { label: "Tutoring", monthly: 10_000, stable: false },
      ],
    }),
  );
  assert.equal(plan.monthlyIncome, 40_000);
  assert.equal(plan.monthlyStableIncome, 30_000);
});

test("essential and discretionary spend are split correctly", () => {
  const plan = planFinances(
    input({
      expenses: expenses([
        ["FOOD", 10_000, true],
        ["TRANSPORT", 4_000, true],
        ["SOCIAL", 3_000, false],
      ]),
    }),
  );
  assert.equal(plan.monthlyEssential, 14_000);
  assert.equal(plan.monthlyDiscretionary, 3_000);
  assert.equal(plan.monthlyExpenses, 17_000);
});

test("a surplus is reported as surplus, annualised", () => {
  const plan = planFinances(input());
  // 30,000 income − 25,000 expenses = +5,000
  assert.equal(plan.monthlySurplus, 5_000);
  assert.equal(plan.annualSurplus, 60_000);
  assert.equal(plan.position, "SURPLUS");
});

test("a shortfall is reported with its true sign and annual value", () => {
  const plan = planFinances(
    input({
      incomeSources: [{ label: "Family", monthly: 15_000, stable: true }],
    }),
  );
  assert.equal(plan.monthlySurplus, -10_000);
  assert.equal(plan.annualSurplus, -120_000);
  assert.equal(plan.position, "SHORTFALL");
  assert.ok(plan.headline.includes("Rs 10,000"));
});

test("the funding target covers the shortfall plus the unsaved buffer", () => {
  const plan = planFinances(
    input({
      incomeSources: [{ label: "Family", monthly: 15_000, stable: true }],
      bufferTargetMonths: 3,
    }),
  );
  // Shortfall 120,000/yr + unsaved buffer (25,000 essential × 3 = 75,000)
  // ⇒ 195,000 rounded to the nearest 1,000.
  assert.equal(plan.annualFundingTarget, 195_000);
});

test("no funding target is asserted when there is no shortfall", () => {
  const plan = planFinances(input());
  assert.equal(plan.annualFundingTarget, 0);
});

test("tuition is split across terms and the cash flow runs cumulatively", () => {
  const plan = planFinances(input({ annualTuition: 240_000, termsPerYear: 2 }));
  assert.equal(plan.terms.length, 2);
  assert.equal(plan.terms[0].feeDue, 120_000);
  assert.equal(plan.terms[1].feeDue, 120_000);
  // 6 months of 5,000 surplus saves 30,000, so term 1 runs short by 90,000.
  assert.equal(plan.terms[0].runningGap, 90_000);
  // Term 2 adds another 120,000 fee against another 30,000 saved.
  assert.equal(plan.terms[1].runningGap, 180_000);
  assert.equal(plan.terms[0].coveredBySavings, false);
});

test("a large monthly surplus covers the fee instalment", () => {
  const plan = planFinances(
    input({
      incomeSources: [{ label: "Family", monthly: 200_000, stable: true }],
      annualTuition: 240_000,
    }),
  );
  assert.equal(plan.terms[0].coveredBySavings, true);
  assert.equal(plan.terms[0].runningGap, 0);
  assert.ok(plan.terms[0].advice.includes("no action needed"));
});

test("zero tuition produces zero fee terms rather than division errors", () => {
  const plan = planFinances(input({ annualTuition: 0 }));
  assert.equal(plan.terms.length, 2);
  for (const term of plan.terms) assert.equal(term.feeDue, 0);
});

test("terms per year is forced to at least one", () => {
  const plan = planFinances(input({ termsPerYear: 0 }));
  assert.equal(plan.terms.length, 1);
  assert.ok(plan.assumptions.some((line) => line.includes("term")));
});

test("a non-standard term count is disclosed as an assumption", () => {
  const plan = planFinances(input({ termsPerYear: 3 }));
  assert.ok(plan.assumptions.some((line) => line.includes("3 term")));
});

test("variable income is disclosed as a risk", () => {
  const quiet = planFinances(input());
  assert.ok(!quiet.assumptions.some((line) => line.includes("variable")));
  const risky = planFinances(
    input({
      incomeSources: [{ label: "Gig", monthly: 30_000, stable: false }],
    }),
  );
  assert.ok(risky.assumptions.some((line) => line.includes("variable")));
});

test("the emergency buffer is essential spend times the target months", () => {
  const plan = planFinances(input({ bufferTargetMonths: 4 }));
  assert.equal(plan.emergencyBufferTarget, 25_000 * 4);
});

test("the discretionary lever excludes social, so the two cannot double-count", () => {
  // Regression guard. SOCIAL was once a lever worth a third of itself *and*
  // was also inside the 20% non-essential trim, so the same rupees were counted
  // twice and `leversCloseGap` over-promised.
  const plan = planFinances(
    input({
      expenses: expenses([
        ["FOOD", 10_000, true],
        ["SOCIAL", 4_000, false],
        ["OTHER", 1_000, false],
      ]),
    }),
  );
  // Only OTHER (1,000) is eligible for the trim; SOCIAL (4,000) is excluded.
  const trim = plan.levers.find((lever) => lever.code === "DISC_TRIM")!;
  assert.equal(trim.monthlyImpact, Math.round(1_000 * 0.2));
});

test("no lever ever claims the same rupees twice", () => {
  // A general invariant over a realistic budget: every lever with a rupee
  // figure must map to spend that no other lever also counts.
  const plan = planFinances(
    input({
      incomeSources: [{ label: "Family", monthly: 20_000, stable: true }],
      expenses: expenses([
        ["FOOD", 10_000, true],
        ["ACCOMMODATION", 15_000, true],
        ["TRANSPORT", 3_000, false],
        ["SOCIAL", 5_000, false],
        ["OTHER", 2_000, false],
      ]),
    }),
  );
  const social = plan.levers.find((lever) => lever.code === "SOCIAL")!;
  assert.equal(social.monthlyImpact, 0, "social contributes nothing to the achievable total");
  assert.equal(
    plan.maxMonthlyLeverImpact,
    plan.levers.reduce((total, lever) => total + lever.monthlyImpact, 0),
    "the total is exactly the sum of the parts, with nothing counted twice",
  );
});

test("the planner never instructs a student to cut social spending", () => {
  // The product rule, enforced rather than trusted. A student short of money is
  // told by everyone else what to give up; this app refuses to join in. It
  // quantifies the spend so the budget adds up, then hands the decision back.
  const plan = planFinances(
    input({
      expenses: expenses([
        ["FOOD", 10_000, true],
        ["SOCIAL", 4_000, false],
      ]),
    }),
  );
  const social = plan.levers.find((lever) => lever.code === "SOCIAL")!;
  assert.ok(social, "social spend is shown, not hidden");
  assert.equal(social.discretionary, true);
  assert.match(social.note, /not going to tell you to cut it/i);

  // No lever anywhere may use instruction language about giving something up.
  const instructive = /\b(cut|trim|reduce|stop giving up|eliminate)\b/i;
  for (const lever of plan.levers) {
    if (lever.code === "SOCIAL") continue;
    assert.doesNotMatch(lever.label, instructive, `lever "${lever.code}" reads as an instruction`);
  }
  // And the summary prose must not instruct either.
  assert.doesNotMatch(plan.headline, /cut your|trim your|stop social/i);
});

test("a housing lever appears only when there is housing cost", () => {
  const withRent = planFinances(input());
  assert.ok(withRent.levers.some((lever) => lever.code === "HOUSING"));
  const noRent = planFinances(
    input({ expenses: expenses([["FOOD", 12_000], ["TRANSPORT", 5_000]]) }),
  );
  assert.ok(!noRent.levers.some((lever) => lever.code === "HOUSING"));
});

test("levers are ordered by real monthly value, highest first", () => {
  const plan = planFinances(
    input({
      incomeSources: [{ label: "Family", monthly: 10_000, stable: true }],
      expenses: expenses([
        ["FOOD", 10_000, true],
        ["ACCOMMODATION", 20_000, true],
        ["SOCIAL", 6_000, false],
      ]),
    }),
  );
  assert.ok(plan.levers.length >= 4);
  const impacts = plan.levers.map((lever) => lever.monthlyImpact);

  // The section is titled "ranked by real monthly rupees", so it has to be
  // true. Rows worth nothing sort last rather than pretending to be options.
  assert.deepEqual(
    [...impacts].sort((a, b) => b - a),
    impacts,
    "levers must be ordered highest-value first",
  );
  assert.ok(
    plan.levers.some((lever) => lever.monthlyImpact > 0),
    "at least one lever must quantify a real amount",
  );
  assert.equal(
    plan.levers[0].monthlyImpact,
    Math.max(...impacts),
    "the top lever is the highest-value one",
  );
  assert.equal(
    plan.maxMonthlyLeverImpact,
    impacts.reduce((total, value) => total + value, 0),
  );
});

test("leversCloseGap is false in surplus, where there is no gap to close", () => {
  // Regression guard. The comparison used `Math.abs(monthlySurplus)`, so in
  // surplus it asked "can spending changes remove money you don't need" — an
  // incoherent question that rendered as a warning in the one case needing none.
  const rich = planFinances(
    input({
      incomeSources: [{ label: "Family", monthly: 200_000, stable: true }],
      expenses: expenses([["FOOD", 10_000, true], ["ACCOMMODATION", 5_000, true]]),
    }),
  );
  assert.equal(rich.position, "SURPLUS");
  assert.equal(rich.leversCloseGap, false);
});

test("no bursary figure is asserted when the plan already covers its costs", () => {
  // Regression guard. `round1000(target / 12) || 5_000` invented a Rs 5,000
  // monthly aid figure for a student with no shortfall, telling someone who
  // does not need money that money is available.
  const rich = planFinances(
    input({
      incomeSources: [{ label: "Family", monthly: 200_000, stable: true }],
      expenses: expenses([["FOOD", 10_000, true]]),
    }),
  );
  assert.equal(rich.annualFundingTarget, 0);
  const bursary = rich.levers.find((lever) => lever.code === "BURSARY")!;
  assert.equal(bursary.monthlyImpact, 0);
  assert.match(bursary.note, /no gap to fill/i);
});

test("leversCloseGap is true when levers exceed the shortfall", () => {
  const plan = planFinances(
    input({ incomeSources: [{ label: "Family", monthly: 10_000, stable: true }] }),
  );
  assert.equal(plan.position, "SHORTFALL");
  assert.equal(plan.leversCloseGap, true);
});

test("an empty budget is handled without NaN or Infinity", () => {
  const plan = planFinances({
    incomeSources: [],
    expenses: [],
    annualTuition: 0,
  });
  for (const [key, value] of Object.entries(plan)) {
    if (typeof value === "number") {
      assert.ok(Number.isFinite(value), `${key} was ${value}`);
    }
  }
  assert.equal(plan.monthlyIncome, 0);
  assert.equal(plan.monthlySurplus, 0);
});

test("negative expense amounts are not possible through the input contract", () => {
  // The service narrows these out before the planner sees them; here we assert
  // the planner still produces finite output if one slips through.
  const plan = planFinances(input({ expenses: expenses([["FOOD", -5_000]]) }));
  assert.ok(Number.isFinite(plan.monthlyExpenses));
  assert.ok(Number.isFinite(plan.monthlySurplus));
});

test("the default expense scaffold covers the essentials a student has", () => {
  const defaults = defaultExpenses();
  const codes = defaults.map((expense) => expense.code);
  for (const essential of ["FOOD", "TRANSPORT", "ACCOMMODATION", "PHONE_DATA"] as const) {
    assert.ok(codes.includes(essential), `missing ${essential}`);
  }
  const food = defaults.find((expense) => expense.code === "FOOD")!;
  assert.equal(food.essential, true);
  assert.ok(food.monthly > 0);
});

test("rupee formatting groups thousands and keeps the sign outside", () => {
  assert.equal(pkrLabel(45_000), "Rs 45,000");
  assert.equal(pkrLabel(-12_500), "-Rs 12,500");
  assert.equal(pkrLabel(0), "Rs 0");
  assert.equal(pkrLabel(1_250_000), "Rs 1,250,000");
});