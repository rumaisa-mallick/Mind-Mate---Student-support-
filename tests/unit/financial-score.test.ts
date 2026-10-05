import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  computeFinancialNeed,
  resolveBandMidpoint,
  type FinancialProfileInput,
} from "../../src/domain/financial/score.ts";
import {
  PK_INCOME_BANDS_MONTHLY,
  PK_WEIGHT_SET_V1,
} from "../../src/config/pakistan.ts";

const options = { weightSet: PK_WEIGHT_SET_V1, incomeBands: PK_INCOME_BANDS_MONTHLY };

/** A financially stretched profile: low income, many dependents, high tuition. */
const HIGH_NEED: FinancialProfileInput = {
  incomeBandCode: "PK_B1",
  earners: 1,
  dependents: 6,
  annualTuition: 400_000,
  accommodationStatus: "RENTED",
  annualAccommodationCost: 90_000,
  existingAidCoverage: "NONE",
};

/** A comfortable profile. */
const LOW_NEED: FinancialProfileInput = {
  incomeBandCode: "PK_B5",
  earners: 3,
  dependents: 1,
  annualTuition: 100_000,
  accommodationStatus: "FAMILY_HOME",
  annualAccommodationCost: null,
  existingAidCoverage: "PARTIAL",
};

describe("financial need score", () => {
  test("score is always within 0..100", () => {
    for (const input of [HIGH_NEED, LOW_NEED, {}, { incomeBandCode: "PK_B3" }]) {
      const { score } = computeFinancialNeed(input, options);
      assert.ok(score >= 0 && score <= 100, `score out of range: ${score}`);
    }
  });

  test("high-need profile scores far above low-need profile", () => {
    const high = computeFinancialNeed(HIGH_NEED, options);
    const low = computeFinancialNeed(LOW_NEED, options);
    assert.ok(
      high.score > low.score,
      `expected ${high.score} > ${low.score}`,
    );
    assert.ok(high.band === "HIGH" || high.band === "CRITICAL", `band was ${high.band}`);
    assert.ok(low.band === "LOW", `band was ${low.band}`);
  });

  test("more earning members never increases need (monotonicity)", () => {
    const withOne = computeFinancialNeed({ ...HIGH_NEED, earners: 1 }, options);
    const withThree = computeFinancialNeed({ ...HIGH_NEED, earners: 3 }, options);
    assert.ok(withThree.score < withOne.score);
  });

  test("higher tuition never decreases need (monotonicity)", () => {
    const cheap = computeFinancialNeed({ ...HIGH_NEED, annualTuition: 100_000 }, options);
    const expensive = computeFinancialNeed({ ...HIGH_NEED, annualTuition: 600_000 }, options);
    assert.ok(expensive.score > cheap.score);
  });

  test("open-ended top income band resolves to the high anchor", () => {
    const midpoint = resolveBandMidpoint("PK_B5", PK_INCOME_BANDS_MONTHLY, PK_WEIGHT_SET_V1.anchors);
    assert.equal(midpoint, PK_WEIGHT_SET_V1.anchors.incomeHighAnchor);
  });

  test("living free at home scores zero accommodation burden, not 'missing'", () => {
    const result = computeFinancialNeed(LOW_NEED, options);
    const accommodation = result.contributions.find((c) => c.code === "ACCOMMODATION");
    assert.ok(accommodation, "accommodation contribution missing");
    assert.equal(accommodation.normalised, 0);
    assert.equal(result.missing.includes("ACCOMMODATION"), false);
  });

  test("missing inputs renormalise weights instead of guessing", () => {
    const partial = computeFinancialNeed({ incomeBandCode: "PK_B1" }, options);
    assert.equal(partial.provisional, true);
    assert.ok(partial.missing.includes("EARNERS"));
    assert.ok(partial.score > 0, "a known factor must still produce a score");
    assert.ok(partial.inputCoverage < 1 && partial.inputCoverage > 0);
    // Renormalisation means the single known factor drives the score to ~max need.
    assert.ok(partial.headline.includes("Provisional"));
  });

  test("a completely empty profile does not crash and asks for data", () => {
    const empty = computeFinancialNeed({}, options);
    assert.equal(empty.score, 0);
    assert.equal(empty.inputCoverage, 0);
    assert.match(empty.headline, /Add a few financial details/);
  });

  test("contributions sum to the reported score", () => {
    const result = computeFinancialNeed(HIGH_NEED, options);
    const summed = result.contributions.reduce((total, c) => total + c.points, 0);
    // Points are rounded to 1dp, so allow a small tolerance.
    assert.ok(Math.abs(summed - result.score) <= 1.5, `${summed} vs ${result.score}`);
  });

  test("result carries the weight-set version for auditability", () => {
    const result = computeFinancialNeed(HIGH_NEED, options);
    assert.equal(result.weightSetVersion, PK_WEIGHT_SET_V1.version);
  });

  test("headline copy is never stigmatising (product invariant)", () => {
    const forbidden = ["poor", "deserving", "low-income", "depression", "anxiety disorder"];
    for (const input of [HIGH_NEED, LOW_NEED, {}]) {
      const { headline } = computeFinancialNeed(input, options);
      const lowered = headline.toLowerCase();
      for (const word of forbidden) {
        assert.equal(
          lowered.includes(word),
          false,
          `headline contains "${word}": ${headline}`,
        );
      }
    }
  });
});
