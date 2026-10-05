/** Personalisation engine: prioritisation, tone, budgets, transparency. */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildPersonalisation,
  goalLabel,
  type PersonalisationAnswers,
  type PersonalisationContext,
  type PriorityCode,
} from "../../src/domain/personalisation/profile.ts";

const base: PersonalisationAnswers = { primaryGoal: "FINANCE" };

const rankOf = (
  codes: { code: PriorityCode; emphasis: number }[],
  code: PriorityCode,
): number => codes.findIndex((entry) => entry.code === code);

test("a stated goal always produces a lead priority", () => {
  for (const goal of ["FINANCE", "ACADEMIC", "CAREER", "WELLBEING"] as const) {
    const result = buildPersonalisation({ primaryGoal: goal });
    assert.equal(result.primaryGoal, goal);
    assert.ok(result.priorities.length > 0, "expected at least one priority");
    assert.ok(result.priorities[0].emphasis > 0);
  }
});

test("every priority carries a plain-language justification", () => {
  const result = buildPersonalisation({
    primaryGoal: "ACADEMIC",
    secondaryGoals: ["CAREER"],
    stressTriggers: ["MONEY", "SLEEP"],
    caresForOthers: true,
  });
  for (const priority of result.priorities) {
    assert.ok(priority.why.length > 10, `missing explanation for ${priority.code}`);
    assert.ok(priority.label.length > 0);
  }
});

test("measured high need overrides a stated academic goal", () => {
  const result = buildPersonalisation(
    { primaryGoal: "ACADEMIC" },
    { needScore: 78, needBand: "HIGH" },
  );
  assert.equal(result.priorities[0].code, "FUNDING");
  assert.ok(result.priorities[0].why.includes("78/100"));
  assert.ok(result.influences.some((entry) => entry.answer === "Financial need score"));
});

test("low measured need does not override the stated goal", () => {
  const result = buildPersonalisation({ primaryGoal: "CAREER" }, { needScore: 22 });
  assert.equal(result.priorities[0].code, "CAREER_PATHWAY");
  assert.ok(
    result.influences.some(
      (entry) => entry.answer === "Financial need score" && entry.effect.includes("Did not override"),
    ),
    "expected the non-override to be disclosed",
  );
});

test("an unknown need score never reorders priorities", () => {
  const withNull = buildPersonalisation({ primaryGoal: "WELLBEING" }, { needScore: null });
  const withoutContext = buildPersonalisation({ primaryGoal: "WELLBEING" });
  assert.deepEqual(
    withNull.priorities.map((p) => p.code),
    withoutContext.priorities.map((p) => p.code),
  );
});

test("the latest check-in concern adds or boosts a priority", () => {
  const result = buildPersonalisation(
    { primaryGoal: "FINANCE" },
    { topConcern: "career" },
  );
  const careerIndex = rankOf(result.priorities, "CAREER_PATHWAY");
  assert.ok(careerIndex >= 0, "career priority should exist");
  // Stated goal still leads: measured context boosts, never replaces.
  assert.equal(result.priorities[0].code, "FUNDING");
  assert.ok(result.influences.some((entry) => entry.answer === "Latest check-in"));
});

test("a generic 'other' concern changes nothing", () => {
  const result = buildPersonalisation({ primaryGoal: "FINANCE" }, { topConcern: "other" });
  assert.equal(result.priorities.length, 1);
  assert.ok(!result.influences.some((entry) => entry.answer === "Latest check-in"));
});

test("priorities are sorted by descending emphasis", () => {
  const result = buildPersonalisation({
    primaryGoal: "WELLBEING",
    secondaryGoals: ["FINANCE", "ACADEMIC", "CAREER"],
    stressTriggers: ["MONEY", "FAMILY", "SLEEP"],
    caresForOthers: true,
  });
  const emphases = result.priorities.map((p) => p.emphasis);
  assert.deepEqual(emphases, [...emphases].sort((a, b) => b - a));
});

test("emphasis never exceeds 1 and is rounded to 2dp", () => {
  const result = buildPersonalisation({
    primaryGoal: "FINANCE",
    secondaryGoals: ["FINANCE"],
    stressTriggers: ["MONEY"],
  });
  for (const priority of result.priorities) {
    assert.ok(priority.emphasis <= 1);
    assert.equal(priority.emphasis, Math.round(priority.emphasis * 100) / 100);
  }
});

test("every goal produces a distinct label", () => {
  const labels = (["FINANCE", "ACADEMIC", "CAREER", "WELLBEING"] as const).map(goalLabel);
  assert.equal(new Set(labels).size, 4);
});

test("no weekly budget is invented when hours are unknown", () => {
  const result = buildPersonalisation({ primaryGoal: "FINANCE" });
  assert.equal(result.weeklyBudget, null);
  assert.equal(result.studyPlan, null);
});

test("a declared weekly hour budget is fully allocated", () => {
  const result = buildPersonalisation({
    ...base,
    availableHoursPerWeek: 20,
    commuteMinutes: 60,
  });
  const budget = result.weeklyBudget!;
  assert.ok(budget);
  const allocated =
    budget.study + budget.wellbeing + budget.work + budget.commute + budget.admin;
  assert.ok(
    Math.abs(allocated - budget.totalHours) < 0.2,
    `allocated ${allocated} vs ${budget.totalHours}`,
  );
  assert.equal(budget.commute, 1);
});

test("full-time work reserves the majority of the week before study", () => {
  const result = buildPersonalisation({
    ...base,
    availableHoursPerWeek: 40,
    workCommitment: "FULL_TIME",
  });
  const budget = result.weeklyBudget!;
  assert.ok(budget.work >= 22, `expected ~22h of work, got ${budget.work}`);
  assert.ok(budget.study > 0);
});

test("intensive study style yields fewer, longer study hours than spaced", () => {
  const intensive = buildPersonalisation({
    ...base,
    availableHoursPerWeek: 30,
    studyStyle: "INTENSIVE",
  });
  const spaced = buildPersonalisation({
    ...base,
    availableHoursPerWeek: 30,
    studyStyle: "SPACED",
  });
  assert.ok(intensive.studyPlan!.headline.includes("long blocks"));
  assert.ok(spaced.studyPlan!.headline.includes("spread"));
  assert.ok(intensive.weeklyBudget!.wellbeing < spaced.weeklyBudget!.wellbeing);
});

test("absurd hour inputs are clamped, not trusted", () => {
  const result = buildPersonalisation({ ...base, availableHoursPerWeek: 900 });
  assert.equal(result.weeklyBudget!.totalHours, 80);
});

test("a study plan is never built from an invalid hour count", () => {
  const zero = buildPersonalisation({ ...base, availableHoursPerWeek: 0 });
  assert.equal(zero.weeklyBudget!.totalHours, 1);
  assert.ok(zero.studyPlan);
});

test("support preference picks the routing, and is disclosed", () => {
  const professional = buildPersonalisation({
    ...base,
    supportPreference: "PROFESSIONAL",
  });
  assert.equal(professional.supportRoute!.label, "Professional support first");
  const selfGuided = buildPersonalisation({ ...base, supportPreference: "SELF_GUIDED" });
  assert.equal(selfGuided.supportRoute!.label, "Self-guided first");
  assert.equal(buildPersonalisation(base).supportRoute, null);
});

test("tone drives the detail level", () => {
  assert.equal(buildPersonalisation({ ...base, tonePreference: "DETAILED" }).detailLevel, "DETAILED");
  assert.equal(buildPersonalisation({ ...base, tonePreference: "GENTLE" }).detailLevel, "SUMMARY");
});

test("language defaults to English and respects Urdu", () => {
  assert.equal(buildPersonalisation(base).language, "en");
  assert.equal(buildPersonalisation({ ...base, preferredLanguage: "ur" }).language, "ur");
});

test("match emphasis always resolves to real score components", () => {
  const valid = ["NEED_FIT", "COVERAGE_VALUE", "ACADEMIC_FIT", "FIELD_FIT", "EFFORT", "URGENCY"];
  for (const goal of ["FINANCE", "ACADEMIC", "CAREER", "WELLBEING"] as const) {
    const result = buildPersonalisation({ primaryGoal: goal });
    assert.ok(result.matchEmphasis.length > 0);
    for (const component of result.matchEmphasis) {
      assert.ok(valid.includes(component), `unknown component ${component}`);
    }
  }
});

test("every influence line names the answer and the effect", () => {
  const result = buildPersonalisation({
    primaryGoal: "FINANCE",
    secondaryGoals: ["CAREER"],
    stressTriggers: ["MONEY", "FAMILY"],
    supportPreference: "PEER",
    availableHoursPerWeek: 24,
    commuteMinutes: 45,
    workCommitment: "PART_TIME",
    caresForOthers: true,
  });
  assert.ok(result.influences.length >= 5);
  for (const influence of result.influences) {
    assert.ok(influence.answer.length > 0);
    assert.ok(influence.effect.length > 0);
  }
});

test("the result is deterministic", () => {
  const input: PersonalisationAnswers = {
    ...base,
    secondaryGoals: ["ACADEMIC"],
    stressTriggers: ["MONEY"],
    availableHoursPerWeek: 18,
  };
  const context: PersonalisationContext = { needScore: 71, topConcern: "financial" };
  assert.deepEqual(buildPersonalisation(input, context), buildPersonalisation(input, context));
});

test("personalisation never changes the underlying answers it was given", () => {
  const input: PersonalisationAnswers = {
    ...base,
    secondaryGoals: ["ACADEMIC"],
    stressTriggers: ["SLEEP"],
    availableHoursPerWeek: 15,
  };
  const snapshot = JSON.parse(JSON.stringify(input));
  buildPersonalisation(input, { needScore: 90, topConcern: "money" });
  assert.deepEqual(input, snapshot);
});